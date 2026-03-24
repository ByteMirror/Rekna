import { describe, expect, mock, test } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
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
  Range: window.Range,
  SVGElement: window.SVGElement,
  window,
  Window: window.Window,
});
globalThis.getSelection = window.getSelection.bind(window);
globalThis.self = window;

type MatchMediaController = {
  setDarkMode: (isDarkMode: boolean) => void;
};

Object.assign(window.HTMLElement.prototype, {
  attachEvent() {},
  detachEvent() {},
});

if (typeof window.Range?.prototype.getClientRects !== "function") {
  window.Range.prototype.getClientRects = function getClientRects() {
    return {
      [Symbol.iterator]: function* iterator() {},
      item: () => null,
      length: 0,
    } as DOMRectList;
  };
}

if (typeof window.Range?.prototype.getBoundingClientRect !== "function") {
  window.Range.prototype.getBoundingClientRect =
    function getBoundingClientRect() {
      return {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        toJSON: () => ({}),
        top: 0,
        width: 0,
        x: 0,
        y: 0,
      } as DOMRect;
    };
}

function installMatchMedia(initialDarkMode = true): MatchMediaController {
  let matches = initialDarkMode;
  const listeners = new Set<EventListenerOrEventListenerObject>();
  const media = "(prefers-color-scheme: dark)";
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media,
    onchange: null as
      | ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown)
      | null,
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null
    ) {
      if (type === "change" && listener) {
        listeners.add(listener);
      }
    },
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null
    ) {
      if (type === "change" && listener) {
        listeners.delete(listener);
      }
    },
    addListener(
      listener:
        | ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown)
        | null
    ) {
      if (listener) {
        listeners.add(listener as EventListener);
      }
    },
    removeListener(
      listener:
        | ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown)
        | null
    ) {
      if (listener) {
        listeners.delete(listener as EventListener);
      }
    },
    dispatchEvent() {
      return true;
    },
  } as unknown as MediaQueryList;

  const matchMedia = mock((query: string) => {
    if (query !== media) {
      throw new Error(`Unexpected media query: ${query}`);
    }

    return mediaQueryList as MediaQueryList;
  });

  Object.assign(window, { matchMedia });
  Object.assign(globalThis, { matchMedia });

  return {
    setDarkMode(isDarkMode: boolean) {
      matches = isDarkMode;
      const event = Object.assign(new window.Event("change"), {
        matches,
        media,
      }) as MediaQueryListEvent;
      for (const listener of listeners) {
        if (typeof listener === "function") {
          listener.call(mediaQueryList, event);
        } else {
          listener.handleEvent(event);
        }
      }
      mediaQueryList.onchange?.call(mediaQueryList, event);
    },
  };
}

describe("App", () => {
  test("renders swapped ghost icon controls in the header", async () => {
    const bootstrap = mock(async () => ({
      activeSheet: {
        body: "",
        createdAt: "2026-03-21T12:00:00.000Z",
        filePath: "/tmp/sheet-1.md",
        folderId: null,
        id: "sheet-1",
        lastOpenedAt: "2026-03-21T12:00:00.000Z",
        plainText: "",
        tags: [],
        title: "Untitled",
        updatedAt: "2026-03-21T12:00:00.000Z",
      },
      folders: [],
      sheets: [
        {
          body: "",
          createdAt: "2026-03-21T12:00:00.000Z",
          filePath: "/tmp/sheet-1.md",
          folderId: null,
          id: "sheet-1",
          lastOpenedAt: "2026-03-21T12:00:00.000Z",
          plainText: "",
          tags: [],
          title: "Untitled",
          updatedAt: "2026-03-21T12:00:00.000Z",
        },
      ],
    }));

    const request = {
      bootstrap: () => bootstrap(),
      createFolder: mock(async () => ({
        createdAt: "2026-03-21T12:00:00.000Z",
        id: "folder-1",
        name: "Folder",
        parentId: null,
        updatedAt: "2026-03-21T12:00:00.000Z",
      })),
      createSheet: mock(async () => ({
        body: "",
        createdAt: "2026-03-21T12:00:00.000Z",
        filePath: "/tmp/sheet-2.md",
        folderId: null,
        id: "sheet-2",
        lastOpenedAt: "2026-03-21T12:00:00.000Z",
        plainText: "",
        tags: [],
        title: "Untitled",
        updatedAt: "2026-03-21T12:00:00.000Z",
      })),
      markSheetOpened: mock(async ({ id }: { id: string }) => ({
        body: id === "sheet-1" ? "3\n2+2" : "",
        createdAt: "2026-03-21T12:00:00.000Z",
        filePath: `/tmp/${id}.md`,
        folderId: null,
        id,
        lastOpenedAt: "2026-03-21T12:00:01.000Z",
        plainText: id === "sheet-1" ? "3\n2+2" : "",
        tags: [],
        title: "Untitled",
        updatedAt: "2026-03-21T12:00:00.000Z",
      })),
      searchSheets: mock(async () => []),
      updateSheet: mock(
        async ({
          body,
          id,
          title,
        }: { body: string; id: string; title?: string }) => ({
          body,
          createdAt: "2026-03-21T12:00:00.000Z",
          filePath: `/tmp/${id}.md`,
          folderId: null,
          id,
          lastOpenedAt: "2026-03-21T12:00:01.000Z",
          plainText: body,
          tags: [],
          title: title ?? "Untitled",
          updatedAt: "2026-03-21T12:00:01.000Z",
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
      const { App } = await import("./App");
      const { container, getAllByRole, getByRole, queryByText } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      const libraryButton = await waitFor(
        () =>
          getByRole("button", {
            name: "Open library",
          }) as HTMLButtonElement
      );
      const createButton = getByRole("button", {
        name: "Create new sheet",
      }) as HTMLButtonElement;
      const titleInput = getByRole("textbox", {
        name: "Sheet title",
      }) as HTMLInputElement;
      const toolbar = getByRole("toolbar", { name: "Sheet controls" });
      const titleOverlay = toolbar.querySelector("div.pointer-events-none");
      const appRoot = container.querySelector("[data-theme]") as HTMLDivElement;
      const main = container.querySelector("main") as HTMLElement;
      const buttons = Array.from(
        toolbar.querySelectorAll<HTMLButtonElement>("button")
      );

      expect(libraryButton.getAttribute("data-variant")).toBe("ghost");
      expect(libraryButton.getAttribute("data-size")).toBe("icon-sm");
      expect(libraryButton.textContent).toBe("");
      expect(createButton.getAttribute("data-variant")).toBe("ghost");
      expect(createButton.getAttribute("data-size")).toBe("icon-sm");
      expect(buttons[0]).toBe(createButton);
      expect(buttons[1]).toBe(libraryButton);
      expect(titleInput.getAttribute("data-chrome")).toBe("ghost");
      expect(titleInput.className.includes("bg-transparent")).toBe(true);
      expect(titleInput.className.includes("border-transparent")).toBe(true);
      expect(titleInput.className.includes("shadow-none")).toBe(true);
      expect(toolbar.className.includes("window-drag-region")).toBe(true);
      expect(toolbar.className.includes("absolute")).toBe(false);
      expect(toolbar.className.includes("h-10")).toBe(true);
      expect(toolbar.className.includes("shrink-0")).toBe(true);
      expect(toolbar.className.includes("items-center")).toBe(true);
      expect(toolbar.className.includes("pl-4")).toBe(true);
      expect(toolbar.className.includes("pr-1.5")).toBe(true);
      expect(toolbar.className.includes("px-4")).toBe(false);
      expect(toolbar.className.includes("pt-4")).toBe(false);
      expect(toolbar.className.includes("z-30")).toBe(true);
      expect(toolbar.className.includes("bg-background")).toBe(true);
      expect(titleOverlay).not.toBeNull();
      expect(titleOverlay?.className.includes("inset-y-0")).toBe(true);
      expect(titleOverlay?.className.includes("items-center")).toBe(true);
      expect(titleOverlay?.className.includes("top-3")).toBe(false);
      expect(appRoot.className.includes("relative")).toBe(true);
      expect(appRoot.className.includes("grid")).toBe(true);
      expect(
        appRoot.className.includes("grid-rows-[2.5rem_minmax(0,1fr)_auto]")
      ).toBe(true);
      expect(appRoot.className.includes("overflow-hidden")).toBe(true);
      expect(main.className.includes("z-0")).toBe(true);
      expect(main.className.includes("min-h-0")).toBe(true);
      expect(main.className.includes("overflow-hidden")).toBe(true);
      expect(main.className.includes("h-full")).toBe(false);
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("renders a thinner footer with compact shortcut pills and a syntax guide trigger", async () => {
    try {
      const { App } = await import("./App");
      const { getByRole, getByTestId } = render(
        <App EditorComponent={createFakeEditor()} request={createRequest()} />,
        {
          container: window.document.body,
        }
      );

      const footer = await waitFor(
        () => getByTestId("shortcut-footer") as HTMLElement
      );
      const footerAccent = getByTestId("shortcut-footer-accent");
      const footerContent = footer.querySelector(
        '[data-testid="shortcut-footer-content"]'
      ) as HTMLElement;
      const footerShortcutKey = footer.querySelector("kbd") as HTMLElement;
      const searchButton = getByRole("button", {
        name: "Open sheet search",
      });
      const syntaxButton = getByRole("button", {
        name: "Open syntax guide",
      });

      expect(footer.className.includes("shrink-0")).toBe(true);
      expect(footer.className.includes("w-full")).toBe(true);
      expect(footer.className.includes("max-w-full")).toBe(true);
      expect(footer.className.includes("p-2.5")).toBe(true);
      expect(footerContent.className.includes("w-full")).toBe(true);
      expect(footerContent.className.includes("flex")).toBe(true);
      expect(footerContent.className.includes("justify-between")).toBe(true);
      expect(footerContent.className.includes("items-center")).toBe(true);
      expect(footerAccent.className.includes("bg-gradient-to-r")).toBe(true);
      expect(footerAccent.className.includes("from-transparent")).toBe(true);
      expect(footerAccent.className.includes("via-foreground/22")).toBe(true);
      expect(footerAccent.className.includes("to-transparent")).toBe(true);
      expect(footerShortcutKey.className.includes("p-1")).toBe(true);
      expect(footerShortcutKey.className.includes("px-")).toBe(false);
      expect(footerShortcutKey.className.includes("py-")).toBe(false);
      expect(footer.textContent).not.toContain("Library");
      expect(footer.textContent).not.toContain("Editor");
      expect(footer.textContent).toContain("Search");
      expect(footer.textContent).toContain("New sheet");
      expect(footer.textContent).toContain("Settings");
      expect(footer.textContent).toContain("Comment");
      expect(footer.textContent).toContain("Autocomplete");
      expect(footer.textContent).toContain("Syntax");
      expect(footer.querySelectorAll("kbd").length).toBeGreaterThan(0);
      expect(searchButton.textContent).toContain("Cmd");
      expect(searchButton.textContent).toContain("F");
      expect(syntaxButton.textContent).toContain("Cmd");
      expect(syntaxButton.textContent).toContain("?");
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("opens the syntax guide with the primary question mark shortcut", async () => {
    try {
      const { App } = await import("./App");
      const { getByRole, getByTestId, getByText } = render(
        <App EditorComponent={createFakeEditor()} request={createRequest()} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByRole("button", { name: "Open library" })).not.toBeNull();
      });

      await act(async () => {
        fireEvent.keyDown(window, {
          code: "Slash",
          key: "?",
          metaKey: true,
          shiftKey: true,
        });
      });

      const dialog = await waitFor(
        () => getByRole("dialog", { name: "Syntax guide" }) as HTMLElement
      );
      const dialogBody = getByTestId("syntax-guide-dialog-body");

      expect(dialog.className.includes("max-h-[calc(100vh-3rem)]")).toBe(true);
      expect(dialog.className.includes("w-[min(calc(100vw-2rem),44rem)]")).toBe(
        true
      );
      expect(dialog.className.includes("overflow-hidden")).toBe(true);
      expect(dialogBody.className.includes("overflow-y-auto")).toBe(true);
      expect(getByText("Syntax guide")).not.toBeNull();
      expect(getByText("Import subscriptions")).not.toBeNull();
      expect(getByText("sqrt 16")).not.toBeNull();
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("opens the library search when the footer search button is clicked", async () => {
    try {
      const { App } = await import("./App");
      const { getByPlaceholderText, getByRole } = render(
        <App EditorComponent={createFakeEditor()} request={createRequest()} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(
          getByRole("button", { name: "Open sheet search" })
        ).not.toBeNull();
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Open sheet search" }));
      });

      await waitFor(() => {
        const searchInput = getByPlaceholderText("Search...");
        expect(searchInput).toBe(window.document.activeElement);
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("does not open the syntax guide without the primary modifier", async () => {
    try {
      const { App } = await import("./App");
      const { getByRole, queryByRole } = render(
        <App EditorComponent={createFakeEditor()} request={createRequest()} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByRole("button", { name: "Open library" })).not.toBeNull();
      });

      await act(async () => {
        fireEvent.keyDown(window, {
          code: "Slash",
          key: "?",
          shiftKey: true,
        });
      });

      expect(queryByRole("dialog", { name: "Syntax guide" })).toBeNull();
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("does not open the syntax guide while typing in an editable field", async () => {
    const FakeEditor = () => (
      <div
        contentEditable
        data-testid="editable-editor"
        suppressContentEditableWarning
      />
    );

    try {
      const { App } = await import("./App");
      const { getByRole, getByTestId, queryByRole } = render(
        <App EditorComponent={FakeEditor} request={createRequest()} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByRole("button", { name: "Open library" })).not.toBeNull();
      });

      const editor = getByTestId("editable-editor");
      editor.focus();

      await act(async () => {
        fireEvent.keyDown(editor, {
          code: "Slash",
          key: "?",
          metaKey: true,
          shiftKey: true,
        });
      });

      expect(queryByRole("dialog", { name: "Syntax guide" })).toBeNull();
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("opens the syntax guide while the sheet editor is focused", async () => {
    const FakeCodeMirrorEditor = () => (
      <div className="cm-editor">
        <div
          className="cm-content"
          contentEditable
          data-testid="sheet-editor-content"
          role="textbox"
          tabIndex={0}
          suppressContentEditableWarning
        />
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByRole, getByTestId } = render(
        <App
          EditorComponent={FakeCodeMirrorEditor}
          request={createRequest()}
        />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByRole("button", { name: "Open library" })).not.toBeNull();
      });

      const editorContent = getByTestId("sheet-editor-content");
      editorContent.focus();

      await act(async () => {
        fireEvent.keyDown(editorContent, {
          code: "Slash",
          key: "?",
          metaKey: true,
          shiftKey: true,
        });
      });

      await waitFor(() => {
        expect(getByRole("dialog", { name: "Syntax guide" })).not.toBeNull();
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("does not re-bootstrap and reset the sheet when the draft changes", async () => {
    const bootstrap = mock(async () => ({
      activeSheet: {
        body: "",
        createdAt: "2026-03-21T12:00:00.000Z",
        filePath: "/tmp/sheet-1.md",
        folderId: null,
        id: "sheet-1",
        lastOpenedAt: "2026-03-21T12:00:00.000Z",
        plainText: "",
        tags: [],
        title: "Untitled",
        updatedAt: "2026-03-21T12:00:00.000Z",
      },
      folders: [],
      sheets: [
        {
          body: "",
          createdAt: "2026-03-21T12:00:00.000Z",
          filePath: "/tmp/sheet-1.md",
          folderId: null,
          id: "sheet-1",
          lastOpenedAt: "2026-03-21T12:00:00.000Z",
          plainText: "",
          tags: [],
          title: "Untitled",
          updatedAt: "2026-03-21T12:00:00.000Z",
        },
      ],
    }));

    const request = {
      get bootstrap() {
        return () => bootstrap();
      },
      get createFolder() {
        return mock(async () => ({
          createdAt: "2026-03-21T12:00:00.000Z",
          id: "folder-1",
          name: "Folder",
          parentId: null,
          updatedAt: "2026-03-21T12:00:00.000Z",
        }));
      },
      get createSheet() {
        return mock(async () => ({
          body: "",
          createdAt: "2026-03-21T12:00:00.000Z",
          filePath: "/tmp/sheet-2.md",
          folderId: null,
          id: "sheet-2",
          lastOpenedAt: "2026-03-21T12:00:00.000Z",
          plainText: "",
          tags: [],
          title: "Untitled",
          updatedAt: "2026-03-21T12:00:00.000Z",
        }));
      },
      get markSheetOpened() {
        return mock(async ({ id }: { id: string }) => ({
          body: "",
          createdAt: "2026-03-21T12:00:00.000Z",
          filePath: `/tmp/${id}.md`,
          folderId: null,
          id,
          lastOpenedAt: "2026-03-21T12:00:01.000Z",
          plainText: "",
          tags: [],
          title: "Untitled",
          updatedAt: "2026-03-21T12:00:00.000Z",
        }));
      },
      get searchSheets() {
        return mock(async () => []);
      },
      get updateSheet() {
        return mock(
          async ({
            body,
            id,
            title,
          }: {
            body: string;
            id: string;
            title?: string;
          }) => ({
            body,
            createdAt: "2026-03-21T12:00:00.000Z",
            filePath: `/tmp/${id}.md`,
            folderId: null,
            id,
            lastOpenedAt: "2026-03-21T12:00:01.000Z",
            plainText: body,
            tags: [],
            title: title ?? "Untitled",
            updatedAt: "2026-03-21T12:00:01.000Z",
          })
        );
      },
    };

    const FakeEditor = ({
      documentId,
      onChange,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
        <button onClick={() => onChange("3 + 5")} type="button">
          Type text
        </button>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByRole, getByTestId } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(bootstrap).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Type text" }));
      });

      await waitFor(() => {
        expect(getByTestId("draft-value").textContent).toBe("3 + 5");
      });

      expect(bootstrap).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("shows and renames the active sheet from the header", async () => {
    const renameSheet = mock(
      async ({ id, title }: { id: string; title: string }) =>
        createSheetRecord({
          id,
          title,
        })
    );
    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          id: "sheet-1",
          title: "Budget sheet",
        }),
        sheets: [
          createSheetRecord({
            id: "sheet-1",
            title: "Budget sheet",
          }),
          createSheetRecord({
            id: "sheet-2",
            title: "Travel notes",
          }),
        ],
      })),
      renameSheet,
    });

    try {
      const { App } = await import("./App");
      const { getByLabelText } = render(
        <App EditorComponent={createFakeEditor()} request={request} />,
        {
          container: window.document.body,
        }
      );

      const titleInput = await waitFor(
        () => getByLabelText("Sheet title") as HTMLInputElement
      );

      expect(titleInput.value).toBe("Budget sheet");

      await act(async () => {
        fireEvent.focus(titleInput);
      });

      await act(async () => {
        fireEvent.change(titleInput, {
          target: { value: "Budget 2026" },
        });
      });

      await waitFor(() => {
        expect(titleInput.value).toBe("Budget 2026");
      });

      await act(async () => {
        fireEvent.blur(titleInput);
      });

      await waitFor(() => {
        expect(renameSheet).toHaveBeenCalledWith({
          id: "sheet-1",
          title: "Budget 2026",
        });
      });

      expect(titleInput.value).toBe("Budget 2026");
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("adds header elevation only after the sheet reports scrolling", async () => {
    const bootstrap = mock(async () => ({
      activeSheet: {
        body: "",
        createdAt: "2026-03-21T12:00:00.000Z",
        filePath: "/tmp/sheet-1.md",
        folderId: null,
        id: "sheet-1",
        lastOpenedAt: "2026-03-21T12:00:00.000Z",
        plainText: "",
        tags: [],
        title: "Untitled",
        updatedAt: "2026-03-21T12:00:00.000Z",
      },
      folders: [],
      sheets: [
        {
          body: "",
          createdAt: "2026-03-21T12:00:00.000Z",
          filePath: "/tmp/sheet-1.md",
          folderId: null,
          id: "sheet-1",
          lastOpenedAt: "2026-03-21T12:00:00.000Z",
          plainText: "",
          tags: [],
          title: "Untitled",
          updatedAt: "2026-03-21T12:00:00.000Z",
        },
      ],
    }));

    const request = {
      bootstrap: () => bootstrap(),
      createSheet: mock(async () => ({
        body: "",
        createdAt: "2026-03-21T12:00:00.000Z",
        filePath: "/tmp/sheet-2.md",
        folderId: null,
        id: "sheet-2",
        lastOpenedAt: "2026-03-21T12:00:00.000Z",
        plainText: "",
        tags: [],
        title: "Untitled",
        updatedAt: "2026-03-21T12:00:00.000Z",
      })),
      markSheetOpened: mock(async ({ id }: { id: string }) => ({
        body: "",
        createdAt: "2026-03-21T12:00:00.000Z",
        filePath: `/tmp/${id}.md`,
        folderId: null,
        id,
        lastOpenedAt: "2026-03-21T12:00:01.000Z",
        plainText: "",
        tags: [],
        title: "Untitled",
        updatedAt: "2026-03-21T12:00:00.000Z",
      })),
      searchSheets: mock(async () => []),
      updateSheet: mock(
        async ({
          body,
          id,
          title,
        }: { body: string; id: string; title?: string }) => ({
          body,
          createdAt: "2026-03-21T12:00:00.000Z",
          filePath: `/tmp/${id}.md`,
          folderId: null,
          id,
          lastOpenedAt: "2026-03-21T12:00:01.000Z",
          plainText: body,
          tags: [],
          title: title ?? "Untitled",
          updatedAt: "2026-03-21T12:00:01.000Z",
        })
      ),
    };

    const FakeEditor = ({
      onScrollStateChange,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      onScrollStateChange?: (isScrolled: boolean) => void;
      value: string;
    }) => (
      <button onClick={() => onScrollStateChange?.(true)} type="button">
        Simulate scroll
      </button>
    );

    try {
      const { App } = await import("./App");
      const { getByRole } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      const toolbar = await waitFor(
        () => getByRole("toolbar", { name: "Sheet controls" }) as HTMLElement
      );

      expect(toolbar.className.includes("shadow-none")).toBe(true);

      fireEvent.click(getByRole("button", { name: "Simulate scroll" }));

      await waitFor(() => {
        expect(
          toolbar.className.includes("shadow-[0_10px_26px_rgba(0,0,0,0.22)]")
        ).toBe(true);
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("ignores stale save completions after the document is cleared", async () => {
    const bootstrap = mock(async () => ({
      activeSheet: {
        body: "3\n2+2",
        createdAt: "2026-03-21T12:00:00.000Z",
        filePath: "/tmp/sheet-1.md",
        folderId: null,
        id: "sheet-1",
        lastOpenedAt: "2026-03-21T12:00:00.000Z",
        plainText: "3\n2+2",
        tags: [],
        title: "Untitled",
        updatedAt: "2026-03-21T12:00:00.000Z",
      },
      folders: [],
      sheets: [
        {
          body: "3\n2+2",
          createdAt: "2026-03-21T12:00:00.000Z",
          filePath: "/tmp/sheet-1.md",
          folderId: null,
          id: "sheet-1",
          lastOpenedAt: "2026-03-21T12:00:00.000Z",
          plainText: "3\n2+2",
          tags: [],
          title: "Untitled",
          updatedAt: "2026-03-21T12:00:00.000Z",
        },
      ],
    }));

    const pendingSaves: Array<{
      body: string;
      resolve: (value: {
        body: string;
        createdAt: string;
        filePath: string;
        folderId: null;
        id: string;
        lastOpenedAt: string;
        plainText: string;
        tags: string[];
        title: string;
        updatedAt: string;
      }) => void;
    }> = [];

    const request = {
      bootstrap: () => bootstrap(),
      createFolder: mock(async () => ({
        createdAt: "2026-03-21T12:00:00.000Z",
        id: "folder-1",
        name: "Folder",
        parentId: null,
        updatedAt: "2026-03-21T12:00:00.000Z",
      })),
      createSheet: mock(async () => ({
        body: "",
        createdAt: "2026-03-21T12:00:00.000Z",
        filePath: "/tmp/sheet-2.md",
        folderId: null,
        id: "sheet-2",
        lastOpenedAt: "2026-03-21T12:00:00.000Z",
        plainText: "",
        tags: [],
        title: "Untitled",
        updatedAt: "2026-03-21T12:00:00.000Z",
      })),
      markSheetOpened: mock(async ({ id }: { id: string }) => ({
        body: "3\n2+2",
        createdAt: "2026-03-21T12:00:00.000Z",
        filePath: `/tmp/${id}.md`,
        folderId: null,
        id,
        lastOpenedAt: "2026-03-21T12:00:01.000Z",
        plainText: "3\n2+2",
        tags: [],
        title: "Untitled",
        updatedAt: "2026-03-21T12:00:00.000Z",
      })),
      searchSheets: mock(async () => []),
      updateSheet: mock(
        ({ body, id, title }: { body: string; id: string; title?: string }) =>
          new Promise<{
            body: string;
            createdAt: string;
            filePath: string;
            folderId: null;
            id: string;
            lastOpenedAt: string;
            plainText: string;
            tags: string[];
            title: string;
            updatedAt: string;
          }>((resolve) => {
            pendingSaves.push({
              body,
              resolve: (value) => resolve(value),
            });
          })
      ),
    };

    const FakeEditor = ({
      onChange,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="draft-value">{value}</div>
        <button onClick={() => onChange("3\n2+2\n9")} type="button">
          Extend
        </button>
        <button onClick={() => onChange("")} type="button">
          Clear
        </button>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByRole, getByTestId } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByTestId("draft-value").textContent).toBe("3\n2+2");
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Extend" }));
        await delay(450);
      });
      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Clear" }));
        await delay(450);
      });

      expect(pendingSaves).toHaveLength(2);

      await act(async () => {
        pendingSaves[0]?.resolve({
          body: "3\n2+2\n9",
          createdAt: "2026-03-21T12:00:00.000Z",
          filePath: "/tmp/sheet-1.md",
          folderId: null,
          id: "sheet-1",
          lastOpenedAt: "2026-03-21T12:00:01.000Z",
          plainText: "3\n2+2\n9",
          tags: [],
          title: "Untitled",
          updatedAt: "2026-03-21T12:00:01.000Z",
        });
        pendingSaves[1]?.resolve({
          body: "",
          createdAt: "2026-03-21T12:00:00.000Z",
          filePath: "/tmp/sheet-1.md",
          folderId: null,
          id: "sheet-1",
          lastOpenedAt: "2026-03-21T12:00:02.000Z",
          plainText: "",
          tags: [],
          title: "Untitled",
          updatedAt: "2026-03-21T12:00:02.000Z",
        });
      });

      await waitFor(() => {
        expect(getByTestId("draft-value").textContent).toBe("");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("renders the library as a floating sheet and lets it close cleanly", async () => {
    const request = createRequest();

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getAllByRole, getByRole, queryAllByRole, queryByText } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      const openButton = await waitFor(() =>
        getByRole("button", { name: "Open library" })
      );

      await act(async () => {
        fireEvent.click(openButton);
      });

      const sheetContent = await waitFor(() => {
        const element = window.document.body.querySelector(
          '[data-slot="sheet-content"]'
        );
        expect(element).not.toBeNull();
        return element as HTMLElement;
      });

      expect(sheetContent.getAttribute("data-state")).toBe("open");
      expect(sheetContent.className).toContain("top-3");
      expect(sheetContent.className).toContain("bottom-3");
      expect(sheetContent.className).toContain("right-3");
      expect(sheetContent.className).toContain("rounded-2xl");

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Close" }));
      });

      await waitFor(() => {
        expect(sheetContent.getAttribute("data-state")).toBe("closed");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("closes the library when clicking outside the floating sheet", async () => {
    const request = createRequest();

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getAllByRole, getByRole, queryAllByRole, queryByText } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      const openButton = await waitFor(() =>
        getByRole("button", { name: "Open library" })
      );

      await act(async () => {
        fireEvent.click(openButton);
      });

      await act(async () => {
        fireEvent.pointerDown(window.document.body);
        fireEvent.click(window.document.body);
      });

      await waitFor(() => {
        const sheetContent = window.document.body.querySelector(
          '[data-slot="sheet-content"]'
        );
        expect(sheetContent?.getAttribute("data-state")).toBe("closed");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("opens settings from the library menu", async () => {
    const request = createRequest();

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getAllByRole, getByRole, queryAllByRole, queryByText } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      const openButton = await waitFor(() =>
        getByRole("button", { name: "Open library" })
      );

      await act(async () => {
        fireEvent.click(openButton);
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Open settings" }));
      });

      await waitFor(() => {
        expect(getByRole("spinbutton", { name: "Precision" })).not.toBeNull();
      });

      expect(getByRole("spinbutton", { name: "Precision" })).not.toBeNull();
      expect(
        getByRole("checkbox", { name: "Carry rounded values" })
      ).not.toBeNull();
      expect(getByRole("combobox", { name: "Theme mode" })).not.toBeNull();
      expect(queryAllByRole("checkbox", { name: "Always on top" }).length).toBe(
        0
      );
      expect(getByRole("checkbox", { name: "Launch on login" })).not.toBeNull();
      expect(
        getByRole("checkbox", {
          name: "Run in background",
        })
      ).not.toBeNull();
      expect(getByRole("combobox", { name: "Result font" })).not.toBeNull();
      expect(queryByText("Shortcut")).toBeNull();
      expect(queryByText("What these settings change")).toBeNull();
      expect(queryByText("Command + ,")).toBeNull();
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("chooses a workspace folder from settings and reboots into it", async () => {
    let bootstrapCallCount = 0;
    const bootstrap = mock(async () => {
      bootstrapCallCount += 1;

      return bootstrapCallCount === 1
        ? {
            activeSheet: createSheetRecord({
              id: "sheet-1",
              title: "Current workspace sheet",
            }),
            sheets: [
              createSheetRecord({
                id: "sheet-1",
                title: "Current workspace sheet",
              }),
            ],
          }
        : {
            activeSheet: createSheetRecord({
              id: "sheet-2",
              title: "New workspace sheet",
            }),
            sheets: [
              createSheetRecord({
                id: "sheet-2",
                title: "New workspace sheet",
              }),
            ],
          };
    });
    const openWorkspaceFolder = mock(async () => ({
      name: "Client work",
      path: "/tmp/client-work",
    }));
    const request = createRequest({
      bootstrap,
      getWorkspaceSelection: mock(async () => ({
        name: "Current workspace",
        path: "/tmp/current-workspace",
      })),
      openWorkspaceFolder,
    });

    try {
      const { App } = await import("./App");
      const { getByRole, getByTestId, queryByRole } = render(
        <App EditorComponent={createFakeEditor()} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByTestId("document-id").textContent).toBe("sheet-1");
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Open library" }));
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Open settings" }));
      });

      await waitFor(() => {
        expect(
          getByRole("button", { name: "Choose workspace folder" })
        ).not.toBeNull();
      });

      expect(queryByRole("textbox", { name: "New workspace name" })).toBeNull();
      expect(queryByRole("button", { name: "Create workspace" })).toBeNull();

      await act(async () => {
        fireEvent.click(
          getByRole("button", { name: "Choose workspace folder" })
        );
      });

      await waitFor(() => {
        expect(openWorkspaceFolder).toHaveBeenCalledWith({});
      });

      await waitFor(() => {
        expect(getByTestId("document-id").textContent).toBe("sheet-2");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("reboots into an existing workspace folder chosen from settings", async () => {
    let bootstrapCallCount = 0;
    const bootstrap = mock(async () => {
      bootstrapCallCount += 1;

      return bootstrapCallCount === 1
        ? {
            activeSheet: createSheetRecord({
              id: "sheet-1",
              title: "Current workspace sheet",
            }),
            sheets: [
              createSheetRecord({
                id: "sheet-1",
                title: "Current workspace sheet",
              }),
            ],
          }
        : {
            activeSheet: createSheetRecord({
              id: "sheet-3",
              title: "Opened workspace sheet",
            }),
            sheets: [
              createSheetRecord({
                id: "sheet-3",
                title: "Opened workspace sheet",
              }),
            ],
          };
    });
    const openWorkspaceFolder = mock(async () => ({
      name: "Archive workspace",
      path: "/tmp/archive-workspace",
    }));
    const request = createRequest({
      bootstrap,
      getWorkspaceSelection: mock(async () => ({
        name: "Current workspace",
        path: "/tmp/current-workspace",
      })),
      openWorkspaceFolder,
    });

    try {
      const { App } = await import("./App");
      const { getByRole, getByTestId } = render(
        <App EditorComponent={createFakeEditor()} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByTestId("document-id").textContent).toBe("sheet-1");
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Open library" }));
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Open settings" }));
      });

      await waitFor(() => {
        expect(
          getByRole("button", { name: "Choose workspace folder" })
        ).not.toBeNull();
      });

      await act(async () => {
        fireEvent.click(
          getByRole("button", { name: "Choose workspace folder" })
        );
      });

      await waitFor(() => {
        expect(openWorkspaceFolder).toHaveBeenCalledWith({});
      });

      await waitFor(() => {
        expect(getByTestId("document-id").textContent).toBe("sheet-3");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("renders icon-only ghost actions in the library header", async () => {
    const request = createRequest();

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByRole } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      const openButton = await waitFor(() =>
        getByRole("button", { name: "Open library" })
      );

      await act(async () => {
        fireEvent.click(openButton);
      });

      const createButton = await waitFor(
        () => getByRole("button", { name: "New sheet" }) as HTMLButtonElement
      );
      const settingsButton = getByRole("button", {
        name: "Open settings",
      }) as HTMLButtonElement;
      const closeButton = getByRole("button", {
        name: "Close",
      }) as HTMLButtonElement;

      expect(createButton.getAttribute("data-size")).toBe("icon-sm");
      expect(createButton.getAttribute("data-variant")).toBe("ghost");
      expect(createButton.textContent).toBe("");
      expect(settingsButton.getAttribute("data-size")).toBe("icon-sm");
      expect(settingsButton.getAttribute("data-variant")).toBe("ghost");
      expect(settingsButton.textContent).toBe("");
      expect(closeButton.getAttribute("data-size")).toBe("icon-sm");
      expect(closeButton.getAttribute("data-variant")).toBe("ghost");
      expect(closeButton.textContent).toBe("");
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("opens settings with the standard keyboard shortcut", async () => {
    const request = createRequest();

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getAllByRole, getByRole } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByRole("button", { name: "Open library" })).not.toBeNull();
      });

      await act(async () => {
        fireEvent.keyDown(window, {
          key: ",",
          metaKey: true,
        });
      });

      await waitFor(() => {
        expect(
          getAllByRole("heading", {
            name: "Settings",
          }).length
        ).toBeGreaterThan(0);
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("opens the library search with the standard keyboard shortcut", async () => {
    const request = createRequest();

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByPlaceholderText, getByRole } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByRole("button", { name: "Open library" })).not.toBeNull();
      });

      await act(async () => {
        fireEvent.keyDown(window, {
          key: "f",
          metaKey: true,
        });
      });

      await waitFor(() => {
        const searchInput = getByPlaceholderText("Search...");
        expect(searchInput).toBe(window.document.activeElement);
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("resets the library search query after the sidebar is closed", async () => {
    const request = createRequest();

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByPlaceholderText, getByRole } = render(
        <App
          EditorComponent={FakeEditor}
          initialLibraryQuery="travel"
          request={request}
        />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByRole("button", { name: "Open library" })).not.toBeNull();
      });

      await act(async () => {
        fireEvent.keyDown(window, {
          key: "f",
          metaKey: true,
        });
      });

      const searchInput = await waitFor(
        () => getByPlaceholderText("Search...") as HTMLInputElement
      );

      expect(searchInput.value).toBe("travel");

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Close" }));
      });

      await act(async () => {
        fireEvent.keyDown(window, {
          key: "f",
          metaKey: true,
        });
      });

      await waitFor(() => {
        expect(
          (getByPlaceholderText("Search...") as HTMLInputElement).value
        ).toBe("");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("opens the library search when the native sheet search event is dispatched", async () => {
    const request = createRequest();

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByPlaceholderText, getByRole } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByRole("button", { name: "Open library" })).not.toBeNull();
      });

      await act(async () => {
        window.dispatchEvent(new CustomEvent("linea:open-sheet-search"));
      });

      await waitFor(() => {
        const searchInput = getByPlaceholderText("Search...");
        expect(searchInput).toBe(window.document.activeElement);
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("shows a workspace chooser before bootstrapping when no workspace is selected", async () => {
    const bootstrap = mock(async () => ({
      activeSheet: createSheetRecord({
        id: "sheet-1",
      }),
      sheets: [
        createSheetRecord({
          id: "sheet-1",
        }),
      ],
    }));
    const request = createRequest({
      bootstrap,
      getWorkspaceSelection: mock(async () => null),
    });

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByRole, queryByLabelText, queryByRole, queryByText } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByRole("heading", { name: "Rekna" })).not.toBeNull();
      });

      expect(getByRole("img", { name: "Rekna app icon" })).not.toBeNull();
      expect(
        getByRole("button", { name: "Open Folder as Workspace" })
      ).not.toBeNull();
      expect(queryByRole("heading", { name: "Choose a workspace" })).toBeNull();
      expect(queryByRole("button", { name: "Create workspace" })).toBeNull();
      expect(queryByLabelText("Workspace name")).toBeNull();
      expect(queryByLabelText("Sheet title")).toBeNull();
      expect(queryByText("Stored locally")).toBeNull();
      expect(queryByText("Open existing folders")).toBeNull();
      expect(queryByText("Start fresh")).toBeNull();
      expect(bootstrap).not.toHaveBeenCalled();
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("chooses a workspace folder from the chooser and then bootstraps the app", async () => {
    const bootstrap = mock(async () => ({
      activeSheet: createSheetRecord({
        id: "sheet-1",
        title: "Trip budget",
      }),
      sheets: [
        createSheetRecord({
          id: "sheet-1",
          title: "Trip budget",
        }),
      ],
    }));
    const openWorkspaceFolder = mock(async () => ({
      name: "Client work",
      path: "/tmp/client-work",
    }));
    const request = createRequest({
      bootstrap,
      getWorkspaceSelection: mock(async () => null),
      openWorkspaceFolder,
    });

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const {
        getByLabelText,
        getByRole,
        getByTestId,
        queryByLabelText,
        queryByRole,
      } = render(<App EditorComponent={FakeEditor} request={request} />, {
        container: window.document.body,
      });

      await waitFor(() => {
        expect(getByRole("heading", { name: "Rekna" })).not.toBeNull();
      });

      expect(queryByLabelText("Workspace name")).toBeNull();
      expect(queryByRole("button", { name: "Create workspace" })).toBeNull();

      await act(async () => {
        fireEvent.click(
          getByRole("button", { name: "Open Folder as Workspace" })
        );
      });

      await waitFor(() => {
        expect(openWorkspaceFolder).toHaveBeenCalledWith({});
      });

      await waitFor(() => {
        expect(getByTestId("document-id").textContent).toBe("sheet-1");
        expect(getByLabelText("Sheet title")).not.toBeNull();
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("opens an existing workspace from the chooser and then bootstraps the app", async () => {
    const bootstrap = mock(async () => ({
      activeSheet: createSheetRecord({
        id: "sheet-1",
        title: "Ops notes",
      }),
      sheets: [
        createSheetRecord({
          id: "sheet-1",
          title: "Ops notes",
        }),
      ],
    }));
    const openWorkspaceFolder = mock(async () => ({
      name: "Client work",
      path: "/tmp/client-work",
    }));
    const request = createRequest({
      bootstrap,
      getWorkspaceSelection: mock(async () => null),
      openWorkspaceFolder,
    });

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByLabelText, getByRole, getByTestId } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByRole("heading", { name: "Rekna" })).not.toBeNull();
      });

      await act(async () => {
        fireEvent.click(
          getByRole("button", { name: "Open Folder as Workspace" })
        );
      });

      await waitFor(() => {
        expect(openWorkspaceFolder).toHaveBeenCalledWith({});
      });

      await waitFor(() => {
        expect(getByTestId("document-id").textContent).toBe("sheet-1");
        expect(getByLabelText("Sheet title")).not.toBeNull();
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("opens sheet search from Mod-f while the editor is focused", async () => {
    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          body: "1 + 2",
          id: "sheet-1",
          title: "Budget sheet",
        }),
        sheets: [
          createSheetRecord({
            body: "1 + 2",
            id: "sheet-1",
            title: "Budget sheet",
          }),
        ],
      })),
    });

    try {
      const { App } = await import("./App");
      const { container, getByPlaceholderText } = render(
        <App request={request} />,
        {
          container: window.document.body,
        }
      );

      const content = await waitFor(() => {
        const nextContent = container.querySelector(".cm-content");

        if (!(nextContent instanceof window.HTMLElement)) {
          throw new Error("Expected CodeMirror content element");
        }

        return nextContent;
      });

      content.focus();

      await act(async () => {
        fireEvent.keyDown(content, {
          code: "KeyF",
          key: "f",
          metaKey: true,
        });
      });

      await waitFor(() => {
        const searchInput = getByPlaceholderText("Search...");
        expect(searchInput).toBe(window.document.activeElement);
      });

      expect(
        window.document.querySelector('input[placeholder="Find"]')
      ).toBeNull();
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("creates a new sheet with the standard keyboard shortcut", async () => {
    const request = createRequest();

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByRole, getByTestId } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByRole("button", { name: "Open library" })).not.toBeNull();
      });

      await act(async () => {
        fireEvent.keyDown(window, {
          ctrlKey: true,
          key: "n",
        });
      });

      await waitFor(() => {
        expect(getByTestId("document-id").textContent).toBe("sheet-2");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps the library open while ArrowDown navigates through visible sheets without opening them", async () => {
    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          body: "First sheet",
          id: "sheet-1",
          title: "Budget sheet",
        }),
        sheets: [
          createSheetRecord({
            body: "First sheet",
            id: "sheet-1",
            title: "Budget sheet",
          }),
          createSheetRecord({
            body: "Second sheet",
            id: "sheet-2",
            title: "Travel notes",
          }),
          createSheetRecord({
            body: "Third sheet",
            id: "sheet-3",
            title: "Retirement plan",
          }),
        ],
      })),
    });

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByPlaceholderText, getByRole, getByTestId } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByRole("button", { name: "Open library" })).not.toBeNull();
      });

      await act(async () => {
        fireEvent.keyDown(window, {
          key: "f",
          metaKey: true,
        });
      });

      const searchInput = await waitFor(
        () => getByPlaceholderText("Search...") as HTMLInputElement
      );

      await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowDown" });
      });

      await waitFor(() => {
        expect(getByTestId("document-id").textContent).toBe("sheet-1");
        expect(getByPlaceholderText("Search...")).not.toBeNull();
      });

      expect(searchInput).toBe(window.document.activeElement);
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("opens the highlighted sheet only after Enter is pressed in the library", async () => {
    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          body: "First sheet",
          id: "sheet-1",
          title: "Budget sheet",
        }),
        sheets: [
          createSheetRecord({
            body: "First sheet",
            id: "sheet-1",
            title: "Budget sheet",
          }),
          createSheetRecord({
            body: "Second sheet",
            id: "sheet-2",
            title: "Travel notes",
          }),
          createSheetRecord({
            body: "Third sheet",
            id: "sheet-3",
            title: "Retirement plan",
          }),
        ],
      })),
    });

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByPlaceholderText, getByRole, getByTestId } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByRole("button", { name: "Open library" })).not.toBeNull();
      });

      await act(async () => {
        fireEvent.keyDown(window, {
          key: "f",
          metaKey: true,
        });
      });

      const sheetContent = await waitFor(() => {
        const element = window.document.body.querySelector(
          '[data-slot="sheet-content"]'
        );

        if (!(element instanceof window.HTMLElement)) {
          throw new Error("Expected floating sheet content");
        }

        return element;
      });

      await waitFor(() => {
        expect(getByPlaceholderText("Search...")).not.toBeNull();
      });

      await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowDown" });
      });

      expect(getByTestId("document-id").textContent).toBe("sheet-1");

      await act(async () => {
        fireEvent.keyDown(window, { key: "Enter" });
      });

      await waitFor(() => {
        expect(getByTestId("document-id").textContent).toBe("sheet-2");
        expect(sheetContent.getAttribute("data-state")).toBe("closed");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("defaults to the system theme and reacts to operating system theme changes", async () => {
    const matchMedia = installMatchMedia(false);

    try {
      const { App } = await import("./App");
      const { container } = render(
        <App EditorComponent={createFakeEditor()} request={createRequest()} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(
          (
            container.querySelector("[data-theme]") as HTMLElement | null
          )?.getAttribute("data-theme")
        ).toBe("light");
      });

      act(() => {
        matchMedia.setDarkMode(true);
      });

      await waitFor(() => {
        expect(
          (
            container.querySelector("[data-theme]") as HTMLElement | null
          )?.getAttribute("data-theme")
        ).toBe("dark");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("migrates persisted night mode settings to the new theme mode setting", async () => {
    installMatchMedia(true);
    window.sessionStorage.setItem(
      "linea:settings",
      JSON.stringify({
        fontMode: "dynamic",
        nightMode: false,
        precision: 2,
      })
    );

    try {
      const { App } = await import("./App");
      const { container } = render(
        <App EditorComponent={createFakeEditor()} request={createRequest()} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(
          (
            container.querySelector("[data-theme]") as HTMLElement | null
          )?.getAttribute("data-theme")
        ).toBe("light");
      });

      await waitFor(() => {
        const persistedSettings =
          window.sessionStorage.getItem("linea:settings");

        expect(persistedSettings).not.toBeNull();
        expect(JSON.parse(persistedSettings ?? "{}")).toMatchObject({
          themeMode: "light",
        });
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("applies precision settings to numeric values with currency suffixes", async () => {
    window.sessionStorage.setItem(
      "linea:settings",
      JSON.stringify({
        decimalSeparator: "dot",
        fontMode: "dynamic",
        nightMode: true,
        precision: 2,
      })
    );

    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          body: "Fee: 4.619781234529 EUR",
          id: "sheet-1",
        }),
        sheets: [
          createSheetRecord({
            body: "Fee: 4.619781234529 EUR",
            id: "sheet-1",
          }),
        ],
      })),
    });

    const FakeEditor = ({
      lines,
    }: {
      documentId: string;
      lines: Array<{ displayValue: string | null }>;
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="line-0-result">{lines[0]?.displayValue ?? null}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByTestId } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByTestId("line-0-result").textContent).toBe("4.62 EUR");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("formats numeric values with commas when the decimal separator is set to comma", async () => {
    window.sessionStorage.setItem(
      "linea:settings",
      JSON.stringify({
        decimalSeparator: "comma",
        fontMode: "dynamic",
        nightMode: true,
        precision: 2,
      })
    );

    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          body: "Fee: 4.619781234529 EUR",
          id: "sheet-1",
        }),
        sheets: [
          createSheetRecord({
            body: "Fee: 4.619781234529 EUR",
            id: "sheet-1",
          }),
        ],
      })),
    });

    const FakeEditor = ({
      lines,
    }: {
      documentId: string;
      lines: Array<{ displayValue: string | null }>;
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="line-0-result">{lines[0]?.displayValue ?? null}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByTestId } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByTestId("line-0-result").textContent).toBe("4,62 EUR");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("can carry rounded values through later app calculations when enabled", async () => {
    window.sessionStorage.setItem(
      "linea:settings",
      JSON.stringify({
        carryRoundedValues: true,
        decimalSeparator: "dot",
        fontMode: "dynamic",
        nightMode: true,
        precision: 2,
      })
    );

    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          body: "1.004\nprev + 1.004\nsum",
          id: "sheet-1",
        }),
        sheets: [
          createSheetRecord({
            body: "1.004\nprev + 1.004\nsum",
            id: "sheet-1",
          }),
        ],
      })),
    });

    const FakeEditor = ({
      lines,
    }: {
      documentId: string;
      lines: Array<{ displayValue: string | null }>;
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="line-0-result">{lines[0]?.displayValue ?? null}</div>
        <div data-testid="line-1-result">{lines[1]?.displayValue ?? null}</div>
        <div data-testid="line-2-result">{lines[2]?.displayValue ?? null}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByTestId } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByTestId("line-0-result").textContent).toBe("1");
        expect(getByTestId("line-1-result").textContent).toBe("2");
        expect(getByTestId("line-2-result").textContent).toBe("3");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("enabling launch on login also enables keeping the app running after close", async () => {
    const updateDesktopSettings = mock(
      async (settings: {
        keepRunningAfterWindowClose: boolean;
        launchOnLogin: boolean;
      }) => settings
    );
    const request = createRequest({
      getDesktopSettings: mock(async () => ({
        keepRunningAfterWindowClose: false,
        launchOnLogin: false,
      })),
      updateDesktopSettings,
    });

    const FakeEditor = ({
      documentId,
      value,
    }: {
      documentId: string;
      lines: unknown[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );

    try {
      const { App } = await import("./App");
      const { getByRole } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByRole("button", { name: "Open library" })).not.toBeNull();
      });

      await act(async () => {
        fireEvent.keyDown(window, {
          key: ",",
          metaKey: true,
        });
      });

      const launchOnLogin = await waitFor(
        () => getByRole("checkbox", { name: "Launch on login" }) as HTMLElement
      );
      const keepRunning = getByRole("checkbox", {
        name: "Run in background",
      }) as HTMLElement;

      await act(async () => {
        fireEvent.click(launchOnLogin);
      });

      await waitFor(() => {
        expect(updateDesktopSettings).toHaveBeenCalledWith({
          keepRunningAfterWindowClose: true,
          launchOnLogin: true,
        });
      });
      expect(keepRunning.getAttribute("data-state")).toBe("checked");
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("removes sidebar tag editing controls from the library", async () => {
    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          id: "sheet-1",
          tags: ["finance"],
          title: "Budget sheet",
        }),
        sheets: [
          createSheetRecord({
            id: "sheet-1",
            tags: ["finance"],
            title: "Budget sheet",
          }),
          createSheetRecord({
            id: "sheet-2",
            tags: ["finance"],
            title: "Travel notes",
          }),
        ],
      })),
    });

    try {
      const { App } = await import("./App");
      const { getByRole, queryByRole, queryByText } = render(
        <App EditorComponent={createFakeEditor()} request={request} />,
        {
          container: window.document.body,
        }
      );

      const openButton = await waitFor(() =>
        getByRole("button", { name: "Open library" })
      );

      await act(async () => {
        fireEvent.click(openButton);
      });

      expect(queryByRole("button", { name: "Folder" })).toBeNull();
      expect(queryByText("Folders")).toBeNull();

      expect(
        queryByRole("button", { name: "Tags for Budget sheet" })
      ).toBeNull();
      expect(
        queryByRole("button", { name: "Remove finance from Budget sheet" })
      ).toBeNull();
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("filters the library list by selected tags", async () => {
    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          id: "sheet-1",
          tags: ["finance"],
          title: "Budget sheet",
        }),
        sheets: [
          createSheetRecord({
            id: "sheet-1",
            tags: ["finance"],
            title: "Budget sheet",
          }),
          createSheetRecord({
            id: "sheet-2",
            tags: ["travel"],
            title: "Travel notes",
          }),
        ],
      })),
    });

    try {
      const { App } = await import("./App");
      const { getByRole, queryByText } = render(
        <App EditorComponent={createFakeEditor()} request={request} />,
        {
          container: window.document.body,
        }
      );

      const openButton = await waitFor(() =>
        getByRole("button", { name: "Open library" })
      );

      await act(async () => {
        fireEvent.click(openButton);
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Filter by tags" }));
      });

      const financeFilterButton = await waitFor(
        () => getByRole("button", { name: "finance" }) as HTMLElement
      );

      await act(async () => {
        fireEvent.click(financeFilterButton);
      });

      await waitFor(() => {
        expect(queryByText("Budget sheet")).not.toBeNull();
        expect(queryByText("Travel notes")).toBeNull();
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("highlights the active sheet across the full sidebar entry", async () => {
    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          id: "sheet-1",
          title: "Budget sheet",
        }),
        sheets: [
          createSheetRecord({
            id: "sheet-1",
            title: "Budget sheet",
          }),
          createSheetRecord({
            id: "sheet-2",
            title: "Travel notes",
          }),
        ],
      })),
    });

    try {
      const { App } = await import("./App");
      const { getByRole, getByText } = render(
        <App EditorComponent={createFakeEditor()} request={request} />,
        {
          container: window.document.body,
        }
      );

      const openButton = await waitFor(() =>
        getByRole("button", { name: "Open library" })
      );

      await act(async () => {
        fireEvent.click(openButton);
      });

      const activeSheetButton = await waitFor(
        () => getByText("Budget sheet").closest("button") as HTMLButtonElement
      );
      const activeSheetEntry = activeSheetButton.closest("div.rounded-2xl");

      expect(activeSheetEntry).not.toBeNull();
      expect(activeSheetEntry?.className.includes("border-primary/25")).toBe(
        true
      );
      expect(activeSheetEntry?.className.includes("bg-secondary/30")).toBe(
        true
      );
      expect(activeSheetButton.getAttribute("data-variant")).toBe("ghost");
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("uses full-entry hover styling instead of an inner button hover fill", async () => {
    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          id: "sheet-1",
          title: "Budget sheet",
        }),
        sheets: [
          createSheetRecord({
            id: "sheet-1",
            title: "Budget sheet",
          }),
          createSheetRecord({
            id: "sheet-2",
            title: "Travel notes",
          }),
        ],
      })),
    });

    try {
      const { App } = await import("./App");
      const { getByRole, getByText } = render(
        <App EditorComponent={createFakeEditor()} request={request} />,
        {
          container: window.document.body,
        }
      );

      const openButton = await waitFor(() =>
        getByRole("button", { name: "Open library" })
      );

      await act(async () => {
        fireEvent.click(openButton);
      });

      const activeSheetButton = await waitFor(
        () => getByText("Budget sheet").closest("button") as HTMLButtonElement
      );
      const activeSheetEntry = activeSheetButton.closest("div.rounded-2xl");

      expect(activeSheetEntry).not.toBeNull();
      expect(
        activeSheetEntry?.className.includes("hover:bg-secondary/35")
      ).toBe(true);
      expect(
        activeSheetEntry?.className.includes("hover:border-primary/30")
      ).toBe(true);
      expect(activeSheetEntry?.className.includes("transition-colors")).toBe(
        true
      );
      expect(activeSheetEntry?.className.includes("duration-150")).toBe(true);
      expect(activeSheetEntry?.className.includes("hover:duration-0")).toBe(
        true
      );
      expect(activeSheetButton.className.includes("hover:bg-transparent")).toBe(
        true
      );
      expect(
        activeSheetButton.className.includes("active:bg-transparent")
      ).toBe(true);
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("does not keep tag remove buttons visible through focus-within styling", async () => {
    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          id: "sheet-1",
          tags: ["work"],
          title: "Budget sheet",
        }),
        sheets: [
          createSheetRecord({
            id: "sheet-1",
            tags: ["work"],
            title: "Budget sheet",
          }),
        ],
      })),
    });

    try {
      const { App } = await import("./App");
      const { getByRole } = render(
        <App EditorComponent={createFakeEditor()} request={request} />,
        {
          container: window.document.body,
        }
      );

      const openButton = await waitFor(() =>
        getByRole("button", { name: "Open library" })
      );

      await act(async () => {
        fireEvent.click(openButton);
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Filter by tags" }));
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "work" }));
      });

      const removeButton = await waitFor(
        () =>
          getByRole("button", {
            name: "Remove work filter",
          }) as HTMLButtonElement
      );

      expect(removeButton.className.includes("group-hover:opacity-100")).toBe(
        true
      );
      expect(
        removeButton.className.includes("group-focus-within:opacity-100")
      ).toBe(false);
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("renames and deletes sheets from the sheet action menu", async () => {
    const renameSheet = mock(
      async ({ id, title }: { id: string; title: string }) =>
        createSheetRecord({
          id,
          title,
        })
    );
    const deleteSheet = mock(async ({ id }: { id: string }) => ({ id }));
    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          id: "sheet-1",
          title: "Budget sheet",
        }),
        sheets: [
          createSheetRecord({
            id: "sheet-1",
            title: "Budget sheet",
          }),
          createSheetRecord({
            id: "sheet-2",
            title: "Travel notes",
          }),
        ],
      })),
      deleteSheet,
      renameSheet,
    });

    try {
      const { App } = await import("./App");
      const { getByLabelText, getByRole } = render(
        <App EditorComponent={createFakeEditor()} request={request} />,
        {
          container: window.document.body,
        }
      );

      const openButton = await waitFor(() =>
        getByRole("button", { name: "Open library" })
      );

      await act(async () => {
        fireEvent.click(openButton);
      });

      await act(async () => {
        const actionsButton = getByRole("button", {
          name: "Sheet actions for Budget sheet",
        });
        fireEvent.pointerDown(actionsButton);
        fireEvent.click(actionsButton);
      });

      const renameMenuItem = await waitFor(
        () => getByRole("menuitem", { name: "Rename" }) as HTMLElement
      );

      await act(async () => {
        fireEvent.click(renameMenuItem);
      });

      const renameInput = await waitFor(
        () => getByLabelText("Rename Budget sheet") as HTMLInputElement
      );

      await act(async () => {
        fireEvent.change(renameInput, {
          target: { value: "Budget 2026" },
        });
      });

      await waitFor(() => {
        expect(renameInput.value).toBe("Budget 2026");
      });

      await act(async () => {
        fireEvent.blur(renameInput);
      });

      await waitFor(() => {
        expect(renameSheet).toHaveBeenCalledWith({
          id: "sheet-1",
          title: "Budget 2026",
        });
      });

      await act(async () => {
        const actionsButton = getByRole("button", {
          name: "Sheet actions for Travel notes",
        });
        fireEvent.pointerDown(actionsButton);
        fireEvent.click(actionsButton);
      });

      const deleteMenuItem = await waitFor(
        () => getByRole("menuitem", { name: "Delete" }) as HTMLElement
      );

      await act(async () => {
        fireEvent.click(deleteMenuItem);
      });

      const confirmDeleteButton = await waitFor(
        () => getByRole("button", { name: "Delete sheet" }) as HTMLElement
      );

      await act(async () => {
        fireEvent.click(confirmDeleteButton);
      });

      await waitFor(() => {
        expect(deleteSheet).toHaveBeenCalledWith({ id: "sheet-2" });
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("selects a contiguous range of sheets with shift click", async () => {
    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          id: "sheet-1",
          title: "Budget sheet",
        }),
        sheets: [
          createSheetRecord({
            id: "sheet-1",
            title: "Budget sheet",
          }),
          createSheetRecord({
            id: "sheet-2",
            title: "Travel notes",
          }),
          createSheetRecord({
            id: "sheet-3",
            title: "Work log",
          }),
        ],
      })),
    });

    try {
      const { App } = await import("./App");
      const { getByRole, getByText } = render(
        <App EditorComponent={createFakeEditor()} request={request} />,
        {
          container: window.document.body,
        }
      );

      const openButton = await waitFor(() =>
        getByRole("button", { name: "Open library" })
      );

      await act(async () => {
        fireEvent.click(openButton);
      });

      const firstCheckbox = await waitFor(
        () =>
          getByRole("checkbox", {
            name: "Select Budget sheet",
          }) as HTMLElement
      );
      const thirdCheckbox = getByRole("checkbox", {
        name: "Select Work log",
      });

      await act(async () => {
        fireEvent.click(firstCheckbox);
      });

      await act(async () => {
        fireEvent.click(thirdCheckbox, { shiftKey: true });
      });

      await waitFor(() => {
        expect(getByText("3 selected")).not.toBeNull();
        expect(
          getByRole("checkbox", {
            name: "Select Travel notes",
          }).getAttribute("data-state")
        ).toBe("checked");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("selects all visible sheets with command a and bulk deletes them", async () => {
    const deleteSheet = mock(async ({ id }: { id: string }) => ({ id }));
    const createSheet = mock(async () =>
      createSheetRecord({
        id: "sheet-4",
      })
    );
    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          id: "sheet-1",
          title: "Budget sheet",
        }),
        sheets: [
          createSheetRecord({
            id: "sheet-1",
            title: "Budget sheet",
          }),
          createSheetRecord({
            id: "sheet-2",
            title: "Travel notes",
          }),
          createSheetRecord({
            id: "sheet-3",
            title: "Work log",
          }),
        ],
      })),
      createSheet,
      deleteSheet,
    });

    try {
      const { App } = await import("./App");
      const { getByRole, getByText } = render(
        <App EditorComponent={createFakeEditor()} request={request} />,
        {
          container: window.document.body,
        }
      );

      const openButton = await waitFor(() =>
        getByRole("button", { name: "Open library" })
      );

      await act(async () => {
        fireEvent.click(openButton);
      });

      await act(async () => {
        fireEvent.keyDown(window, { key: "a", metaKey: true });
      });

      await waitFor(() => {
        expect(getByText("3 selected")).not.toBeNull();
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Delete selected" }));
      });

      const confirmDeleteButton = await waitFor(
        () => getByRole("button", { name: "Delete 3 sheets" }) as HTMLElement
      );

      await act(async () => {
        fireEvent.click(confirmDeleteButton);
      });

      await waitFor(() => {
        expect(deleteSheet).toHaveBeenCalledTimes(3);
        expect(deleteSheet).toHaveBeenCalledWith({ id: "sheet-1" });
        expect(deleteSheet).toHaveBeenCalledWith({ id: "sheet-2" });
        expect(deleteSheet).toHaveBeenCalledWith({ id: "sheet-3" });
        expect(createSheet).toHaveBeenCalledTimes(1);
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("imports exported symbols from other sheets into the active sheet", async () => {
    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          body: ["Import subscriptions", "subscriptions.total"].join("\n"),
          id: "sheet-1",
          title: "Summary",
        }),
        sheets: [
          createSheetRecord({
            body: ["Import subscriptions", "subscriptions.total"].join("\n"),
            id: "sheet-1",
            title: "Summary",
          }),
          createSheetRecord({
            body: [
              "subscriptions {",
              "  netflix = 10",
              "  amazon = 15",
              "  total = sum",
              "}",
              "Export subscriptions",
            ].join("\n"),
            id: "sheet-2",
            title: "Subscriptions",
          }),
        ],
      })),
    });

    function FakeEditor({
      lines,
    }: {
      completionSymbols?: Array<{ detail?: string; label: string }>;
      documentId: string;
      lines: Array<{ displayValue: string | null }>;
      onChange: (value: string) => void;
      value: string;
    }) {
      return (
        <div>
          <div data-testid="line-0">{lines[0]?.displayValue ?? ""}</div>
          <div data-testid="line-1">{lines[1]?.displayValue ?? ""}</div>
        </div>
      );
    }

    try {
      const { App } = await import("./App");
      const { getByTestId } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByTestId("line-0").textContent).toBe("Object");
        expect(getByTestId("line-1").textContent).toBe("25");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("ignores stale cached draft symbols when rebuilding autocomplete on startup", async () => {
    window.sessionStorage.setItem(
      "linea:draft:sheet-2",
      [
        "subscriptions {",
        "  netflix = 10",
        "  amazon = 15",
        "  total = sum",
        "}",
        "Export subscriptions",
      ].join("\n")
    );

    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          body: ["Import subscriptions", "subscriptions.total"].join("\n"),
          id: "sheet-1",
          title: "Summary",
        }),
        sheets: [
          createSheetRecord({
            body: ["Import subscriptions", "subscriptions.total"].join("\n"),
            id: "sheet-1",
            title: "Summary",
          }),
          createSheetRecord({
            body: [
              "subscriptions {",
              "  netflix = 10",
              "  total = sum",
              "}",
              "Export subscriptions",
            ].join("\n"),
            id: "sheet-2",
            title: "Subscriptions",
          }),
        ],
      })),
    });

    function FakeEditor({
      lines,
    }: {
      completionSymbols?: Array<{ detail?: string; label: string }>;
      documentId: string;
      lines: Array<{ displayValue: string | null }>;
      onChange: (value: string) => void;
      value: string;
    }) {
      return (
        <div>
          <div data-testid="line-0">{lines[0]?.displayValue ?? ""}</div>
          <div data-testid="line-1">{lines[1]?.displayValue ?? ""}</div>
        </div>
      );
    }

    try {
      const { App } = await import("./App");
      const { getByTestId } = render(
        <App EditorComponent={FakeEditor} request={request} />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(getByTestId("line-0").textContent).toBe("Object");
        expect(getByTestId("line-1").textContent).toBe("10");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps draft updates immediate while only the latest async evaluation result is applied", async () => {
    const evaluationResolvers: Array<
      (value: {
        completionSymbols: Array<{
          kind: "object" | "property" | "variable";
          label: string;
        }>;
        lines: Array<{
          displayValue: string | null;
          expression: string;
          kind:
            | "assignment"
            | "blank"
            | "comment"
            | "error"
            | "expression"
            | "heading";
          label: string | null;
          raw: string;
        }>;
      }) => void
    > = [];
    const evaluationDrafts: string[] = [];
    const evaluationService = {
      dispose: mock(() => {}),
      evaluate: mock(
        (request: {
          activeDraft: string;
          activeSheetId: string;
          carryRoundedValues: boolean;
          precision: number;
        }) => {
          evaluationDrafts.push(request.activeDraft);
          return new Promise<{
            completionSymbols: Array<{
              kind: "object" | "property" | "variable";
              label: string;
            }>;
            lines: Array<{
              displayValue: string | null;
              expression: string;
              kind:
                | "assignment"
                | "blank"
                | "comment"
                | "error"
                | "expression"
                | "heading";
              label: string | null;
              raw: string;
            }>;
          }>((resolve) => {
            evaluationResolvers.push(resolve);
          });
        }
      ),
      syncSheets: mock(() => {}),
    };
    const request = createRequest({
      bootstrap: mock(async () => ({
        activeSheet: createSheetRecord({
          body: "1",
          id: "sheet-1",
        }),
        sheets: [
          createSheetRecord({
            body: "1",
            id: "sheet-1",
          }),
        ],
      })),
    });

    function FakeEditor({
      lines,
      onChange,
      value,
    }: {
      completionSymbols?: Array<{ detail?: string; label: string }>;
      documentId: string;
      lines: Array<{ displayValue: string | null }>;
      onChange: (value: string) => void;
      value: string;
    }) {
      return (
        <div>
          <div data-testid="draft-value">{value}</div>
          <div data-testid="line-0">{lines[0]?.displayValue ?? ""}</div>
          <button onClick={() => onChange("2")} type="button">
            Type 2
          </button>
          <button onClick={() => onChange("3")} type="button">
            Type 3
          </button>
        </div>
      );
    }

    try {
      const { App } = await import("./App");
      const { getByRole, getByTestId } = render(
        <App
          EditorComponent={FakeEditor}
          evaluationService={evaluationService}
          request={request}
        />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        expect(evaluationDrafts).toEqual(["1"]);
      });

      await act(async () => {
        evaluationResolvers[0]?.({
          completionSymbols: [],
          lines: [
            {
              displayValue: "1",
              expression: "1",
              kind: "expression",
              label: null,
              raw: "1",
            },
          ],
        });
      });

      await waitFor(() => {
        expect(getByTestId("line-0").textContent).toBe("1");
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Type 2" }));
      });

      expect(getByTestId("draft-value").textContent).toBe("2");

      await waitFor(() => {
        expect(evaluationDrafts).toEqual(["1", "2"]);
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Type 3" }));
      });

      expect(getByTestId("draft-value").textContent).toBe("3");

      await waitFor(() => {
        expect(evaluationDrafts).toEqual(["1", "2", "3"]);
      });

      await act(async () => {
        evaluationResolvers[1]?.({
          completionSymbols: [],
          lines: [
            {
              displayValue: "2",
              expression: "2",
              kind: "expression",
              label: null,
              raw: "2",
            },
          ],
        });
      });

      await delay(0);

      expect(getByTestId("line-0").textContent).toBe("1");

      await act(async () => {
        evaluationResolvers[2]?.({
          completionSymbols: [],
          lines: [
            {
              displayValue: "3",
              expression: "3",
              kind: "expression",
              label: null,
              raw: "3",
            },
          ],
        });
      });

      await waitFor(() => {
        expect(getByTestId("line-0").textContent).toBe("3");
      });
    } finally {
      cleanup();
      window.sessionStorage.clear();
      window.document.body.innerHTML = "";
    }
  });
});

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function createFakeEditor() {
  return function FakeEditor({
    documentId,
    value,
  }: {
    documentId: string;
    lines: unknown[];
    onChange: (value: string) => void;
    value: string;
    workspaceTags?: string[];
  }) {
    return (
      <div>
        <div data-testid="document-id">{documentId}</div>
        <div data-testid="draft-value">{value}</div>
      </div>
    );
  };
}

function createSheetRecord({
  body = "",
  id,
  tags = [],
  title = "Untitled",
}: {
  body?: string;
  id: string;
  tags?: string[];
  title?: string;
}) {
  return {
    body,
    createdAt: "2026-03-21T12:00:00.000Z",
    filePath: `/tmp/${id}.md`,
    id,
    lastOpenedAt: "2026-03-21T12:00:00.000Z",
    plainText: body,
    tags,
    title,
    updatedAt: "2026-03-21T12:00:00.000Z",
  };
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    bootstrap: mock(async () => ({
      activeSheet: createSheetRecord({
        id: "sheet-1",
      }),
      sheets: [
        createSheetRecord({
          id: "sheet-1",
        }),
      ],
    })),
    createSheet: mock(async () => createSheetRecord({ id: "sheet-2" })),
    deleteSheet: mock(async ({ id }: { id: string }) => ({ id })),
    markSheetOpened: mock(async ({ id }: { id: string }) => ({
      ...createSheetRecord({ id }),
      lastOpenedAt: "2026-03-21T12:00:01.000Z",
    })),
    renameSheet: mock(async ({ id, title }: { id: string; title: string }) =>
      createSheetRecord({ id, title })
    ),
    searchSheets: mock(async () => []),
    setSheetTags: mock(async ({ id, tags }: { id: string; tags: string[] }) =>
      createSheetRecord({ id, tags })
    ),
    updateSheet: mock(
      async ({
        body,
        id,
        title,
      }: { body: string; id: string; title?: string }) => ({
        ...createSheetRecord({
          body,
          id,
          title: title ?? "Untitled",
        }),
        lastOpenedAt: "2026-03-21T12:00:01.000Z",
        updatedAt: "2026-03-21T12:00:01.000Z",
      })
    ),
    ...overrides,
  };
}
