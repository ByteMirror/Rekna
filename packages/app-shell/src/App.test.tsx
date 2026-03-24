import { describe, expect, mock, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost",
});

const { window } = dom;

Object.assign(globalThis, {
  CustomEvent: window.CustomEvent,
  document: window.document,
  DocumentFragment: window.DocumentFragment,
  Element: window.Element,
  Event: window.Event,
  getComputedStyle: window.getComputedStyle.bind(window),
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  HTMLTextAreaElement: window.HTMLTextAreaElement,
  MutationObserver: window.MutationObserver,
  Node: window.Node,
  NodeFilter: window.NodeFilter,
  navigator: window.navigator,
  SVGElement: window.SVGElement,
  window,
  Window: window.Window,
});
globalThis.getSelection = window.getSelection.bind(window);
globalThis.self = window;

Object.assign(window.HTMLElement.prototype, {
  attachEvent() {},
  detachEvent() {},
});

describe("shared App shell", () => {
  test("shows a visible error when bootstrap fails", async () => {
    const bootstrap = mock(async () => {
      throw new Error("bootstrap failed");
    });
    const request = {
      bootstrap,
      createSheet: mock(async () => {
        throw new Error("not used");
      }),
      markSheetOpened: mock(async () => {
        throw new Error("not used");
      }),
      searchSheets: mock(async () => []),
      updateSheet: mock(async () => {
        throw new Error("not used");
      }),
    };

    try {
      const { App } = await import("./components/App");
      const { getByText } = render(<App request={request} />, {
        container: window.document.body,
      });

      await waitFor(() => {
        expect(getByText("Rekna couldn’t finish opening.")).toBeDefined();
        expect(getByText("bootstrap failed")).toBeDefined();
      });
      expect(bootstrap).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("retries bootstrap after an RPC timeout and eventually opens", async () => {
    let attempts = 0;
    const bootstrap = mock(async () => {
      attempts += 1;

      if (attempts === 1) {
        throw new Error("RPC request timed out.");
      }

      return {
        activeSheet: {
          body: "",
          createdAt: "2026-03-24T12:00:00.000Z",
          filePath: "/tmp/sheet-1.md",
          id: "sheet-1",
          lastOpenedAt: "2026-03-24T12:00:00.000Z",
          plainText: "",
          tags: [],
          title: "Untitled",
          updatedAt: "2026-03-24T12:00:00.000Z",
        },
        sheets: [
          {
            body: "",
            createdAt: "2026-03-24T12:00:00.000Z",
            filePath: "/tmp/sheet-1.md",
            id: "sheet-1",
            lastOpenedAt: "2026-03-24T12:00:00.000Z",
            plainText: "",
            tags: [],
            title: "Untitled",
            updatedAt: "2026-03-24T12:00:00.000Z",
          },
        ],
      };
    });
    const request = {
      bootstrap,
      createSheet: mock(async () => ({
        body: "",
        createdAt: "2026-03-24T12:00:00.000Z",
        filePath: "/tmp/sheet-2.md",
        id: "sheet-2",
        lastOpenedAt: "2026-03-24T12:00:01.000Z",
        plainText: "",
        tags: [],
        title: "Untitled",
        updatedAt: "2026-03-24T12:00:01.000Z",
      })),
      markSheetOpened: mock(async ({ id }: { id: string }) => ({
        body: "",
        createdAt: "2026-03-24T12:00:00.000Z",
        filePath: `/tmp/${id}.md`,
        id,
        lastOpenedAt: "2026-03-24T12:00:01.000Z",
        plainText: "",
        tags: [],
        title: "Untitled",
        updatedAt: "2026-03-24T12:00:01.000Z",
      })),
      searchSheets: mock(async () => []),
      updateSheet: mock(
        async ({
          body,
          id,
          title,
        }: { body: string; id: string; title?: string }) => ({
          body,
          createdAt: "2026-03-24T12:00:00.000Z",
          filePath: `/tmp/${id}.md`,
          id,
          lastOpenedAt: "2026-03-24T12:00:01.000Z",
          plainText: body,
          tags: [],
          title: title ?? "Untitled",
          updatedAt: "2026-03-24T12:00:01.000Z",
        })
      ),
    };

    try {
      const { App } = await import("./components/App");
      const { getByRole, queryByText } = render(<App request={request} />, {
        container: window.document.body,
      });

      await waitFor(() => {
        expect(getByRole("button", { name: "Open library" })).toBeDefined();
      });

      expect(bootstrap).toHaveBeenCalledTimes(2);
      expect(queryByText("Rekna couldn’t finish opening.")).toBeNull();
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("boots from an injected request and renders the shared header controls", async () => {
    const request = {
      bootstrap: mock(async () => ({
        activeSheet: {
          body: "",
          createdAt: "2026-03-22T12:00:00.000Z",
          filePath: "/tmp/sheet-1.md",
          id: "sheet-1",
          lastOpenedAt: "2026-03-22T12:00:00.000Z",
          plainText: "",
          tags: [],
          title: "Untitled",
          updatedAt: "2026-03-22T12:00:00.000Z",
        },
        sheets: [
          {
            body: "",
            createdAt: "2026-03-22T12:00:00.000Z",
            filePath: "/tmp/sheet-1.md",
            id: "sheet-1",
            lastOpenedAt: "2026-03-22T12:00:00.000Z",
            plainText: "",
            tags: [],
            title: "Untitled",
            updatedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
      })),
      createSheet: mock(async () => ({
        body: "",
        createdAt: "2026-03-22T12:00:00.000Z",
        filePath: "/tmp/sheet-2.md",
        id: "sheet-2",
        lastOpenedAt: "2026-03-22T12:00:01.000Z",
        plainText: "",
        tags: [],
        title: "Untitled",
        updatedAt: "2026-03-22T12:00:01.000Z",
      })),
      markSheetOpened: mock(async ({ id }: { id: string }) => ({
        body: "",
        createdAt: "2026-03-22T12:00:00.000Z",
        filePath: `/tmp/${id}.md`,
        id,
        lastOpenedAt: "2026-03-22T12:00:01.000Z",
        plainText: "",
        tags: [],
        title: "Untitled",
        updatedAt: "2026-03-22T12:00:01.000Z",
      })),
      searchSheets: mock(async () => []),
      updateSheet: mock(
        async ({
          body,
          id,
          title,
        }: { body: string; id: string; title?: string }) => ({
          body,
          createdAt: "2026-03-22T12:00:00.000Z",
          filePath: `/tmp/${id}.md`,
          id,
          lastOpenedAt: "2026-03-22T12:00:01.000Z",
          plainText: body,
          tags: [],
          title: title ?? "Untitled",
          updatedAt: "2026-03-22T12:00:01.000Z",
        })
      ),
    };

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      onScrollStateChange?: (isScrolled: boolean) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./components/App");
      const { getByRole, getByTestId } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() =>
        expect(getByRole("button", { name: "Open library" })).toBeDefined()
      );

      expect(getByRole("button", { name: "Create new sheet" })).toBeDefined();
      expect(getByRole("textbox", { name: "Sheet title" })).toBeDefined();
      expect(getByTestId("document-id").textContent).toBe("sheet-1");
      expect(getByTestId("draft-value").textContent).toBe("");
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });
});
