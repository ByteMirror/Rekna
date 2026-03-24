import { describe, expect, mock, test } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { JSDOM } from "jsdom";
import type * as React from "react";

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

describe("LibraryPanel", () => {
  test("moves to the next visible sheet with ArrowDown without opening it", async () => {
    const onOpenSheet = mock(
      (_sheetId: string, _options?: { keepPanelOpen?: boolean }) => {}
    );

    try {
      const { LibraryPanel } = await import("./LibraryPanel");
      render(
        <LibraryPanel
          {...createProps({
            activeSheetId: "sheet-2",
            onOpenSheet,
            sheets: [
              {
                body: "",
                id: "sheet-1",
                tags: [],
                title: "Budget sheet",
              },
              {
                body: "",
                id: "sheet-2",
                tags: [],
                title: "Travel notes",
              },
              {
                body: "",
                id: "sheet-3",
                tags: [],
                title: "Retirement plan",
              },
            ],
          })}
        />,
        {
          container: window.document.body,
        }
      );

      await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowDown" });
      });

      expect(onOpenSheet).not.toHaveBeenCalled();
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("moves to the previous visible sheet with ArrowUp without opening it", async () => {
    const onOpenSheet = mock(
      (_sheetId: string, _options?: { keepPanelOpen?: boolean }) => {}
    );

    try {
      const { LibraryPanel } = await import("./LibraryPanel");
      render(
        <LibraryPanel
          {...createProps({
            activeSheetId: "sheet-2",
            onOpenSheet,
            sheets: [
              {
                body: "",
                id: "sheet-1",
                tags: [],
                title: "Budget sheet",
              },
              {
                body: "",
                id: "sheet-2",
                tags: [],
                title: "Travel notes",
              },
              {
                body: "",
                id: "sheet-3",
                tags: [],
                title: "Retirement plan",
              },
            ],
          })}
        />,
        {
          container: window.document.body,
        }
      );

      await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowUp" });
      });

      expect(onOpenSheet).not.toHaveBeenCalled();
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("lets the search field move through visible sheets with the arrow keys without opening them", async () => {
    const onOpenSheet = mock(
      (_sheetId: string, _options?: { keepPanelOpen?: boolean }) => {}
    );

    try {
      const { LibraryPanel } = await import("./LibraryPanel");
      const { getByPlaceholderText } = render(
        <LibraryPanel {...createProps({ onOpenSheet })} />,
        {
          container: window.document.body,
        }
      );

      const searchInput = getByPlaceholderText("Search...");
      searchInput.focus();

      await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowDown" });
      });

      expect(onOpenSheet).not.toHaveBeenCalled();
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("opens the highlighted sheet when Enter is pressed", async () => {
    const onOpenSheet = mock(
      (_sheetId: string, _options?: { keepPanelOpen?: boolean }) => {}
    );

    try {
      const { LibraryPanel } = await import("./LibraryPanel");
      render(
        <LibraryPanel
          {...createProps({
            activeSheetId: "sheet-2",
            onOpenSheet,
            sheets: [
              {
                body: "",
                id: "sheet-1",
                tags: [],
                title: "Budget sheet",
              },
              {
                body: "",
                id: "sheet-2",
                tags: [],
                title: "Travel notes",
              },
              {
                body: "",
                id: "sheet-3",
                tags: [],
                title: "Retirement plan",
              },
            ],
          })}
        />,
        {
          container: window.document.body,
        }
      );

      await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowDown" });
      });

      expect(onOpenSheet).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.keyDown(window, { key: "Enter" });
      });

      expect(onOpenSheet).toHaveBeenCalledTimes(1);
      expect(onOpenSheet).toHaveBeenCalledWith("sheet-3");
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("auto-selects the first visible search result", async () => {
    try {
      const { LibraryPanel } = await import("./LibraryPanel");
      const { getByText } = render(
        <LibraryPanel
          {...createProps({
            activeSheetId: "sheet-3",
            query: "travel",
            results: [
              {
                id: "sheet-2",
                snippet: "Trip planning",
                tags: [],
                title: "Travel notes",
              },
              {
                id: "sheet-4",
                snippet: "Travel budget",
                tags: [],
                title: "Travel budget",
              },
            ],
          })}
        />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        const firstResult = getByText("Travel notes").closest(
          "div[data-highlighted]"
        );
        expect(firstResult).not.toBeNull();
        expect((firstResult as HTMLDivElement).dataset.highlighted).toBe(
          "true"
        );
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("does not use arrow keys for sheet navigation while focus is in another text field", async () => {
    const onOpenSheet = mock(
      (_sheetId: string, _options?: { keepPanelOpen?: boolean }) => {}
    );

    try {
      const { LibraryPanel } = await import("./LibraryPanel");
      render(<LibraryPanel {...createProps({ onOpenSheet })} />, {
        container: window.document.body,
      });

      const renameInput = window.document.createElement("input");
      window.document.body.append(renameInput);
      renameInput.focus();

      await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowDown" });
      });

      expect(onOpenSheet).not.toHaveBeenCalled();
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps selection state until the panel is actually closed", async () => {
    const onClose = mock(() => {});

    try {
      const { LibraryPanel } = await import("./LibraryPanel");
      const props = createProps({ onClose, open: true });
      const { getByRole, getByText, queryByText, rerender } = render(
        <LibraryPanel {...props} />,
        {
          container: window.document.body,
        }
      );

      await act(async () => {
        fireEvent.click(getByRole("checkbox", { name: "Select Budget sheet" }));
      });

      await waitFor(() => {
        expect(getByText("1 selected")).not.toBeNull();
      });

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Close" }));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(getByText("1 selected")).not.toBeNull();

      rerender(<LibraryPanel {...props} open={false} />);

      await waitFor(() => {
        expect(queryByText("1 selected")).toBeNull();
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("uses fuzzy matching for tag filtering", async () => {
    try {
      const { LibraryPanel } = await import("./LibraryPanel");
      const { getByRole } = render(
        <LibraryPanel
          {...createProps({
            availableTags: ["berlin", "travel", "work"],
          })}
        />,
        {
          container: window.document.body,
        }
      );

      await act(async () => {
        fireEvent.click(getByRole("button", { name: "Filter by tags" }));
      });

      const searchInput = await waitFor(
        () =>
          window.document.body.querySelector(
            'input[placeholder="Search tags"]'
          ) as HTMLInputElement
      );

      await act(async () => {
        fireEvent.change(searchInput, {
          target: { value: "berln" },
        });
      });

      await waitFor(() => {
        expect(getByRole("button", { name: "berlin" })).not.toBeNull();
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("suppresses the native context menu and opens sheet actions on right click release", async () => {
    try {
      const { LibraryPanel } = await import("./LibraryPanel");
      const { getByRole, getByText, queryByRole } = render(
        <LibraryPanel {...createProps()} />,
        {
          container: window.document.body,
        }
      );

      expect(queryByRole("menuitem", { name: "Rename" })).toBeNull();

      const contextMenuEvent = new window.MouseEvent("contextmenu", {
        bubbles: true,
        button: 2,
        cancelable: true,
      });

      await act(async () => {
        getByText("Budget sheet").dispatchEvent(contextMenuEvent);
      });

      expect(contextMenuEvent.defaultPrevented).toBe(true);
      expect(queryByRole("menuitem", { name: "Rename" })).toBeNull();

      await act(async () => {
        fireEvent.mouseUp(window, { button: 2 });
      });

      await waitFor(() => {
        expect(getByRole("menuitem", { name: "Rename" })).not.toBeNull();
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("renders the sidebar tag filter trigger as a ghost button without an outline stroke", async () => {
    try {
      const { LibraryPanel } = await import("./LibraryPanel");
      const { getByRole } = render(<LibraryPanel {...createProps()} />, {
        container: window.document.body,
      });

      const trigger = getByRole("button", { name: "Filter by tags" });

      expect(trigger.getAttribute("data-variant")).toBe("ghost");
      expect(trigger.className).not.toContain("border bg-background shadow-xs");
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps the sheet title hover color stable in dark mode", async () => {
    try {
      const { LibraryPanel } = await import("./LibraryPanel");
      const { getByText } = render(<LibraryPanel {...createProps()} />, {
        container: window.document.body,
      });

      const sheetButton = getByText("Budget sheet").closest(
        "button"
      ) as HTMLButtonElement;

      expect(sheetButton.className).toContain("hover:text-foreground");
      expect(sheetButton.className).not.toContain(
        "hover:text-accent-foreground"
      );
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps sheet entries constrained to the sidebar width", async () => {
    try {
      const { LibraryPanel } = await import("./LibraryPanel");
      const longTitle =
        "Budget sheet with an extremely long title that should never push the sidebar entry wider than the panel";
      const { getByText } = render(
        <LibraryPanel
          {...createProps({
            sheets: [
              {
                body: "",
                id: "sheet-1",
                tags: [],
                title: longTitle,
              },
            ],
          })}
        />,
        {
          container: window.document.body,
        }
      );

      const sheetButton = getByText(longTitle).closest("button");
      const sheetEntry = sheetButton?.closest("div.rounded-2xl");

      if (!(sheetButton instanceof window.HTMLButtonElement)) {
        throw new Error("Expected sheet button");
      }

      if (!(sheetEntry instanceof window.HTMLDivElement)) {
        throw new Error("Expected sheet entry");
      }

      const entryElement = sheetEntry as HTMLDivElement;
      const buttonElement = sheetButton as HTMLButtonElement;

      expect(entryElement.className).toContain("min-w-0");
      expect(entryElement.className).toContain("max-w-full");
      expect(buttonElement.className).toContain("min-w-0");
      expect(buttonElement.className).toContain("max-w-full");
      expect(buttonElement.className).toContain("w-full");
      expect(buttonElement.className).toContain("shrink");
      expect(buttonElement.className).toContain("whitespace-normal");
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });
});

function createProps(
  overrides: Partial<
    React.ComponentProps<typeof import("./LibraryPanel").LibraryPanel>
  > = {}
) {
  return {
    activeSheetId: "sheet-1",
    availableTags: [],
    onClose: () => {},
    onCreateSheet: () => {},
    onDeleteSheet: () => {},
    onDeleteSheets: () => {},
    onOpenSettings: () => {},
    onOpenSheet: () => {},
    onQueryChange: () => {},
    onRenameSheet: () => {},
    onSelectedTagsChange: () => {},
    onSetSheetTags: () => {},
    open: true,
    query: "",
    results: [],
    selectedTags: [],
    sheets: [
      {
        body: "",
        id: "sheet-1",
        tags: [],
        title: "Budget sheet",
      },
    ],
    ...overrides,
  };
}
