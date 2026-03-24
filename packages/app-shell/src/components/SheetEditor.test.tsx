import { describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { currentCompletions, startCompletion } from "@codemirror/autocomplete";
import { EditorView, runScopeHandlers } from "@codemirror/view";
import { evaluateSheet } from "@linea/calc-engine";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { JSDOM } from "jsdom";
import { useEffect, useState } from "react";

const sheetEditorSource = readFileSync(
  resolve(import.meta.dir, "./SheetEditor.tsx"),
  "utf8"
);

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
  HTMLButtonElement: window.HTMLButtonElement,
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  HTMLTextAreaElement: window.HTMLTextAreaElement,
  MutationObserver: window.MutationObserver,
  Node: window.Node,
  NodeFilter: window.NodeFilter,
  navigator: window.navigator,
  Range: window.Range,
  window,
  Window: window.Window,
});
globalThis.getSelection = window.getSelection.bind(window);
globalThis.self = window;

const {
  SheetEditor,
  buildResultLineSlots,
  isResultDisplayTruncated,
  truncateResultDisplay,
} = await import("./SheetEditor");
type SheetEditorLine = Parameters<typeof SheetEditor>[0]["lines"][number];

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

describe("SheetEditor", () => {
  test("copies the current line with its result for other apps", async () => {
    try {
      const value = "1 + 2\n2 + 3";
      const evaluation = await evaluateSheet(value);
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value={value}
        />,
        {
          container: window.document.body,
        }
      );

      const content = container.querySelector(".cm-content");
      const editor = container.querySelector(".cm-editor");

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      view.dispatch({
        selection: {
          anchor: 0,
        },
      });

      const clipboardData = createClipboardData();
      dispatchClipboardEvent(content, "copy", clipboardData);

      expect(clipboardData.getData("text/plain")).toBe("1 + 2 = 3");
      expect(readLineaClipboardPayload(clipboardData)).toEqual({
        linewise: true,
        text: "1 + 2",
        version: 1,
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("copies selected full lines with a result for each line", async () => {
    try {
      const value = "1 + 2\n2 + 3";
      const evaluation = await evaluateSheet(value);
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value={value}
        />,
        {
          container: window.document.body,
        }
      );

      const content = container.querySelector(".cm-content");
      const editor = container.querySelector(".cm-editor");

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      view.dispatch({
        selection: {
          anchor: 0,
          head: value.length,
        },
      });

      const clipboardData = createClipboardData();
      dispatchClipboardEvent(content, "copy", clipboardData);

      expect(clipboardData.getData("text/plain")).toBe("1 + 2 = 3\n2 + 3 = 5");
      expect(readLineaClipboardPayload(clipboardData)).toEqual({
        linewise: false,
        text: value,
        version: 1,
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps pasted whole lines below a blank separator so detached formulas recalculate", async () => {
    try {
      const initialValue = [
        "var2 = 10",
        "var4 = 20",
        "bonus = 1",
        "var2 + var4 + sum",
        "",
        "tail = 7",
      ].join("\n");
      const { container, getAllByRole, getByRole } = render(
        <LiveSheetHarness initialValue={initialValue} />,
        {
          container: window.document.body,
        }
      );

      const content = container.querySelector(".cm-content");
      const editor = container.querySelector(".cm-editor");

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      await waitFor(() => {
        expect(getByRole("button", { name: "Copy result 61" })).toBeTruthy();
      });

      view.dispatch({
        selection: {
          anchor: view.state.doc.line(4).from,
        },
      });

      const clipboardData = createClipboardData();
      dispatchClipboardEvent(content, "copy", clipboardData);

      expect(readLineaClipboardPayload(clipboardData)).toEqual({
        linewise: true,
        text: "var2 + var4 + sum",
        version: 1,
      });

      view.dispatch({
        selection: {
          anchor: view.state.doc.line(5).from,
        },
      });

      await act(async () => {
        dispatchClipboardEvent(content, "paste", clipboardData);
      });

      await waitFor(() => {
        expect(view.state.doc.toString()).toBe(
          [
            "var2 = 10",
            "var4 = 20",
            "bonus = 1",
            "var2 + var4 + sum",
            "",
            "var2 + var4 + sum",
            "tail = 7",
          ].join("\n")
        );
        expect(getByRole("button", { name: "Copy result 30" })).toBeTruthy();
        expect(getAllByRole("button", { name: "Copy result 61" })).toHaveLength(
          1
        );
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps pasted whole lines detached when pasting onto the trailing blank line", async () => {
    try {
      const initialValue = [
        "var2 = 10",
        "var4 = 20",
        "bonus = 1",
        "var2 + var4 + sum",
        "",
      ].join("\n");
      const { container, getAllByRole, getByRole } = render(
        <LiveSheetHarness initialValue={initialValue} />,
        {
          container: window.document.body,
        }
      );

      const content = container.querySelector(".cm-content");
      const editor = container.querySelector(".cm-editor");

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      await waitFor(() => {
        expect(getByRole("button", { name: "Copy result 61" })).toBeTruthy();
      });

      view.dispatch({
        selection: {
          anchor: view.state.doc.line(4).from,
        },
      });

      const clipboardData = createClipboardData();
      dispatchClipboardEvent(content, "copy", clipboardData);

      view.dispatch({
        selection: {
          anchor: view.state.doc.line(5).from,
        },
      });

      await act(async () => {
        dispatchClipboardEvent(content, "paste", clipboardData);
      });

      await waitFor(() => {
        expect(view.state.doc.toString()).toBe(
          [
            "var2 = 10",
            "var4 = 20",
            "bonus = 1",
            "var2 + var4 + sum",
            "",
            "var2 + var4 + sum",
            "",
          ].join("\n")
        );
        expect(getByRole("button", { name: "Copy result 30" })).toBeTruthy();
        expect(getAllByRole("button", { name: "Copy result 61" })).toHaveLength(
          1
        );
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps the editor view mounted across value updates and refreshes live results", async () => {
    try {
      const { container, getByRole, getByTestId } = render(<EditorHarness />, {
        container: window.document.body,
      });

      const initialEditor = container.querySelector(".cm-editor");
      if (!(initialEditor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      fireEvent.click(getByRole("button", { name: "Populate sheet" }));

      expect(container.querySelector(".cm-editor")).toBe(initialEditor);

      await waitFor(() => {
        expect(getByTestId("sheet-results").textContent).toContain("345");
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("copies a clicked result and shows a confirmation toast", async () => {
    const writeText = mock(async (_value: string) => {});

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });

    try {
      const evaluation = await evaluateSheet("10\n20");
      const { getByRole, getByTestId } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value="10\n20"
        />,
        {
          container: window.document.body,
        }
      );

      const copyButton = getByRole("button", { name: "Copy result 20" });

      expect(getByTestId("sheet-results").textContent).toBe("1020");
      expect(copyButton.getAttribute("title")).toBeNull();

      fireEvent.click(copyButton);

      expect(writeText).toHaveBeenCalledWith("20");

      await waitFor(() => {
        expect(getByRole("status").textContent).toBe("Copied 20");
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("shows a rounded indicator with full precision details for rounded results", async () => {
    const writeText = mock(async (_value: string) => {});

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });

    try {
      const lines: SheetEditorLine[] = [
        {
          displayValue: "4.62 EUR",
          displayValueMeta: {
            carryMode: "full-precision",
            fullPrecisionValue: "4.619781234529 EUR",
          },
          expression: "4GBP in Euro",
          kind: "expression",
          label: "Fee",
          raw: "Fee: 4GBP in Euro",
        },
      ];
      const { getByRole, getByTestId } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={lines}
          onChange={() => {}}
          value="Fee: 4GBP in Euro"
        />,
        {
          container: window.document.body,
        }
      );

      const detailButton = getByRole("button", {
        name: "Show full precision for 4.62 EUR",
      });

      expect(getByTestId("sheet-layout").getAttribute("style")).toContain(
        "grid-template-columns: minmax(0, 1fr) calc(13ch + 5rem);"
      );
      expect(detailButton.textContent).toBe("≈");
      fireEvent.click(detailButton);

      await waitFor(() => {
        expect(detailButton.getAttribute("aria-expanded")).toBe("true");
      });
      expect(sheetEditorSource).toContain("Copy full precision value");
      expect(sheetEditorSource).toContain('variant="ghost"');
      expect(writeText).not.toHaveBeenCalled();
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("adds extra scroll room after the last line so the caret stays visible on a trailing blank row", async () => {
    try {
      const evaluation = await evaluateSheet("First line\n");
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value={"First line\n"}
        />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        const content = container.querySelector(".cm-content");

        if (!(content instanceof window.HTMLElement)) {
          throw new Error("Expected CodeMirror content element");
        }

        expect(window.getComputedStyle(content).paddingBottom).toBe("30px");
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("does not use scrollPastEnd now that the whole sheet owns scrolling", () => {
    expect(sheetEditorSource).not.toContain("scrollPastEnd()");
  });

  test("adds left inset to lines so the custom caret is not clipped on empty rows", async () => {
    try {
      const evaluation = await evaluateSheet("\n");
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value="\n"
        />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        const firstLine = container.querySelector(".cm-line");

        if (!(firstLine instanceof window.HTMLElement)) {
          throw new Error("Expected CodeMirror line element");
        }

        expect(window.getComputedStyle(firstLine).paddingLeft).toBe("6px");
        expect(window.getComputedStyle(firstLine).paddingRight).toBe("20px");
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps only a small caret-safe gap above the editor content", async () => {
    try {
      const evaluation = await evaluateSheet("\n");
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value="\n"
        />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        const content = container.querySelector(".cm-content");

        if (!(content instanceof window.HTMLElement)) {
          throw new Error("Expected CodeMirror content element");
        }

        const styles = window.getComputedStyle(content);
        expect(styles.paddingTop).toBe("16px");
        expect(styles.paddingLeft).toBe("4px");
        expect(styles.paddingRight).toBe("4px");
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("animates caret movement smoothly while keeping the blink animation", () => {
    expect(sheetEditorSource).toContain("left 90ms cubic-bezier(0.2, 0, 0, 1)");
    expect(sheetEditorSource).toContain("top 90ms cubic-bezier(0.2, 0, 0, 1)");
    expect(sheetEditorSource).toContain(
      "height 90ms cubic-bezier(0.2, 0, 0, 1)"
    );
    expect(sheetEditorSource).toContain("opacity 120ms ease-in-out");
    expect(sheetEditorSource).toContain(
      'animation: "linea-caret-blink 1.1s ease-in-out infinite"'
    );
  });

  test("keeps long editor lines on one line and exposes a horizontal scroll area", async () => {
    try {
      const evaluation = await evaluateSheet(
        "this is a very long line that should wrap instead of overflowing horizontally"
      );
      const { container, getByTestId } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value="this is a very long line that should wrap instead of overflowing horizontally"
        />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        const content = container.querySelector(".cm-content");
        const horizontalScroll = getByTestId("sheet-horizontal-scroll");
        const viewportElement = horizontalScroll.querySelector(
          '[data-slot="scroll-area-viewport"]'
        ) as HTMLElement | null;

        if (!(content instanceof window.HTMLElement)) {
          throw new Error("Expected CodeMirror content element");
        }

        if (viewportElement === null) {
          throw new Error("Expected horizontal scroll viewport");
        }

        const viewport = viewportElement;

        expect(content.classList.contains("cm-lineWrapping")).toBe(false);
        expect(horizontalScroll).not.toBeNull();
        expect(viewport.style.overflowX).toBe("scroll");
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("uses a single outer scroller for the whole sheet", async () => {
    try {
      const evaluation = await evaluateSheet(
        Array.from({ length: 40 }, (_, index) => `${index + 1}`).join("\n")
      );
      const { container, getByTestId } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value={Array.from({ length: 40 }, (_, index) => `${index + 1}`).join(
            "\n"
          )}
        />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        const sheetScroller = getByTestId("sheet-scroll");
        const scroller = container.querySelector(".cm-scroller");
        const results = getByTestId("sheet-results");

        if (!(sheetScroller instanceof window.HTMLElement)) {
          throw new Error("Expected outer sheet scroller");
        }

        if (!(scroller instanceof window.HTMLElement)) {
          throw new Error("Expected CodeMirror scroller element");
        }

        expect(sheetScroller.className).toContain("overflow-y-auto");
        expect(window.getComputedStyle(scroller).overflowY).toBe("visible");
        expect(results.className).toContain("overflow-visible");
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("shows a right-side overflow shadow when editor content can scroll horizontally", async () => {
    try {
      const evaluation = await evaluateSheet(
        "this is a very long line that should overflow horizontally"
      );
      const { getByTestId } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value="this is a very long line that should overflow horizontally"
        />,
        {
          container: window.document.body,
        }
      );

      const horizontalScroll = await waitFor(
        () => getByTestId("sheet-horizontal-scroll") as HTMLDivElement
      );
      const viewportElement = horizontalScroll.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement | null;
      const results = getByTestId("sheet-results");

      if (viewportElement === null) {
        throw new Error("Expected horizontal scroll viewport");
      }

      const viewport = viewportElement;

      Object.defineProperty(viewport, "clientWidth", {
        configurable: true,
        value: 480,
      });
      Object.defineProperty(viewport, "scrollLeft", {
        configurable: true,
        value: 0,
        writable: true,
      });
      Object.defineProperty(viewport, "scrollWidth", {
        configurable: true,
        value: 1200,
      });

      await act(async () => {
        fireEvent.scroll(viewport);
      });

      await waitFor(() => {
        expect(results.getAttribute("data-horizontal-overflow")).toBe("true");
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("reports when the outer sheet scroller is no longer at the top", async () => {
    const onScrollStateChange = mock((_isScrolled: boolean) => {});

    try {
      const evaluation = await evaluateSheet(
        Array.from({ length: 40 }, (_, index) => `${index + 1}`).join("\n")
      );
      const { getByTestId } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          onScrollStateChange={onScrollStateChange}
          value={Array.from({ length: 40 }, (_, index) => `${index + 1}`).join(
            "\n"
          )}
        />,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        const sheetScroller = getByTestId("sheet-scroll");

        if (!(sheetScroller instanceof window.HTMLElement)) {
          throw new Error("Expected outer sheet scroller");
        }

        sheetScroller.scrollTop = 120;
        fireEvent.scroll(sheetScroller);

        expect(onScrollStateChange).toHaveBeenCalledWith(true);
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("mounts the completion menu above the editor stack instead of inside it", async () => {
    try {
      const evaluation = await evaluateSheet("sum");
      const appRoot = window.document.createElement("div");

      appRoot.setAttribute("data-theme", "dark");
      window.document.body.append(appRoot);

      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value="sum"
        />,
        {
          container: appRoot,
        }
      );

      const editor = container.querySelector(".cm-editor");

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      startCompletion(view);

      await waitFor(() => {
        const tooltip = window.document.querySelector(
          ".cm-tooltip.cm-tooltip-autocomplete"
        );

        if (!(tooltip instanceof window.HTMLElement)) {
          throw new Error("Expected autocomplete tooltip");
        }

        expect(editor.contains(tooltip)).toBe(false);
        expect(appRoot.contains(tooltip)).toBe(true);
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("opens autocomplete from the keyboard shortcut", async () => {
    try {
      const evaluation = await evaluateSheet("su");
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value="su"
        />,
        {
          container: window.document.body,
        }
      );

      const editor = container.querySelector(".cm-editor");
      const content = container.querySelector(".cm-content");

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      content.focus();
      fireEvent.keyDown(content, {
        code: "Period",
        key: ".",
        metaKey: true,
      });

      await waitFor(() => {
        const tooltip = window.document.querySelector(
          ".cm-tooltip.cm-tooltip-autocomplete"
        );

        if (!(tooltip instanceof window.HTMLElement)) {
          throw new Error("Expected autocomplete tooltip");
        }

        expect(tooltip.textContent).toContain("sum");
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("opens workspace tag autocomplete immediately after typing a hashtag", async () => {
    try {
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={[]}
          onChange={() => {}}
          value=""
          workspaceTags={["berlin", "travel"]}
        />,
        {
          container: window.document.body,
        }
      );

      const editor = container.querySelector(".cm-editor");
      const content = container.querySelector(".cm-content");

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      content.focus();

      await act(async () => {
        view.dispatch({
          changes: {
            from: 0,
            insert: "#",
          },
          selection: {
            anchor: 1,
          },
          userEvent: "input.type",
        });
      });

      await waitFor(() => {
        expect(
          currentCompletions(view.state).map((completion) => completion.label)
        ).toEqual(["#berlin", "#travel"]);
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("closes tag autocomplete after a heading space and keeps it closed for the heading", async () => {
    try {
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={[]}
          onChange={() => {}}
          value=""
          workspaceTags={["berlin", "travel"]}
        />,
        {
          container: window.document.body,
        }
      );

      const editor = container.querySelector(".cm-editor");
      const content = container.querySelector(".cm-content");

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      content.focus();

      await act(async () => {
        view.dispatch({
          changes: {
            from: 0,
            insert: "#",
          },
          selection: {
            anchor: 1,
          },
          userEvent: "input.type",
        });
      });

      await waitFor(() => {
        expect(
          currentCompletions(view.state).map((completion) => completion.label)
        ).toEqual(["#berlin", "#travel"]);
      });

      await act(async () => {
        view.dispatch({
          changes: {
            from: 1,
            insert: " ",
          },
          selection: {
            anchor: 2,
          },
          userEvent: "input.type",
        });
      });

      await waitFor(() => {
        expect(currentCompletions(view.state)).toHaveLength(0);
        expect(
          window.document.querySelector(".cm-tooltip.cm-tooltip-autocomplete")
        ).toBeNull();
      });

      await act(async () => {
        view.dispatch({
          changes: {
            from: 2,
            insert: "h",
          },
          selection: {
            anchor: 3,
          },
          userEvent: "input.type",
        });
      });

      await waitFor(() => {
        expect(currentCompletions(view.state)).toHaveLength(0);
        expect(
          window.document.querySelector(".cm-tooltip.cm-tooltip-autocomplete")
        ).toBeNull();
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("routes Mod-f to sheet search instead of opening the editor find panel", async () => {
    let searchEventCount = 0;
    const handleOpenSheetSearch = () => {
      searchEventCount += 1;
    };

    window.addEventListener("linea:open-sheet-search", handleOpenSheetSearch);

    try {
      const evaluation = await evaluateSheet("1 + 2");
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value="1 + 2"
        />,
        {
          container: window.document.body,
        }
      );

      const content = container.querySelector(".cm-content");

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      content.focus();

      await act(async () => {
        fireEvent.keyDown(content, {
          code: "KeyF",
          key: "f",
          metaKey: true,
        });
      });

      expect(searchEventCount).toBe(1);
      expect(
        window.document.querySelector('input[placeholder="Find"]')
      ).toBeNull();
    } finally {
      window.removeEventListener(
        "linea:open-sheet-search",
        handleOpenSheetSearch
      );
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("comments a single line with // when Mod-/ is pressed", async () => {
    const value = "repayment = 349.32";
    const onChange = mock((_value: string) => {});

    try {
      const evaluation = await evaluateSheet(value);
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={onChange}
          value={value}
        />,
        {
          container: window.document.body,
        }
      );

      const editor = container.querySelector(".cm-editor");
      const content = container.querySelector(".cm-content");

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      view.dispatch({
        selection: {
          anchor: 0,
          head: value.length,
        },
      });
      content.focus();

      fireEvent.keyDown(content, {
        code: "Slash",
        key: "/",
        metaKey: true,
      });

      await waitFor(() => {
        expect(view.state.doc.toString()).toBe("// repayment = 349.32");
        expect(onChange).toHaveBeenLastCalledWith("// repayment = 349.32");
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("comments selected lines with // when the physical Digit7 key is used for slash", async () => {
    const value = ["first = 1", "second = 2", "third = 3"].join("\n");
    const onChange = mock((_value: string) => {});

    try {
      const evaluation = await evaluateSheet(value);
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={onChange}
          value={value}
        />,
        {
          container: window.document.body,
        }
      );

      const editor = container.querySelector(".cm-editor");
      const content = container.querySelector(".cm-content");

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      view.dispatch({
        selection: {
          anchor: 0,
          head: value.length,
        },
      });
      content.focus();

      fireEvent.keyDown(content, {
        code: "Digit7",
        key: "7",
        metaKey: true,
        shiftKey: true,
      });

      await waitFor(() => {
        expect(view.state.doc.toString()).toBe(
          ["// first = 1", "// second = 2", "// third = 3"].join("\n")
        );
        expect(onChange).toHaveBeenLastCalledWith(
          ["// first = 1", "// second = 2", "// third = 3"].join("\n")
        );
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("does not toggle comments when Mod-Shift-? is pressed on the Slash key", async () => {
    const value = "repayment = 349.32";
    const onChange = mock((_value: string) => {});

    try {
      const evaluation = await evaluateSheet(value);
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={onChange}
          value={value}
        />,
        {
          container: window.document.body,
        }
      );

      const editor = container.querySelector(".cm-editor");
      const content = container.querySelector(".cm-content");

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      view.dispatch({
        selection: {
          anchor: 0,
          head: value.length,
        },
      });
      content.focus();

      fireEvent.keyDown(content, {
        code: "Slash",
        key: "?",
        metaKey: true,
        shiftKey: true,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(view.state.doc.toString()).toBe(value);
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("does not register Mod-Shift-? as the CodeMirror Mod-/ shortcut", async () => {
    const value = "repayment = 349.32";
    const onChange = mock((_value: string) => {});

    try {
      const evaluation = await evaluateSheet(value);
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={onChange}
          value={value}
        />,
        {
          container: window.document.body,
        }
      );

      const editor = container.querySelector(".cm-editor");

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      view.dispatch({
        selection: {
          anchor: 0,
          head: value.length,
        },
      });

      const handled = runScopeHandlers(
        view,
        new window.KeyboardEvent("keydown", {
          code: "Slash",
          key: "?",
          metaKey: true,
          shiftKey: true,
        }),
        "editor"
      );

      expect(handled).toBe(false);
      expect(view.state.doc.toString()).toBe(value);
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("exposes // as the only comment syntax for the editor", async () => {
    const value = "repayment = 349.32";

    try {
      const evaluation = await evaluateSheet(value);
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value={value}
        />,
        {
          container: window.document.body,
        }
      );

      const editor = container.querySelector(".cm-editor");

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      expect(view.state.languageDataAt("commentTokens", 0)[0]).toEqual({
        line: "//",
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("reopens autocomplete for object properties after accepting an object root", async () => {
    try {
      const value = [
        "subscriptions {",
        "  netflix = 10",
        "  spotify = 12",
        "}",
        "subscriptions",
      ].join("\n");
      const evaluation = await evaluateSheet(value);
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value={value}
        />,
        {
          container: window.document.body,
        }
      );

      const editor = container.querySelector(".cm-editor");
      const content = container.querySelector(".cm-content");

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      view.dispatch({
        selection: {
          anchor: value.length,
        },
      });
      content.focus();

      startCompletion(view);

      await waitFor(() => {
        const tooltip = window.document.querySelector(
          ".cm-tooltip.cm-tooltip-autocomplete"
        );

        if (!(tooltip instanceof window.HTMLElement)) {
          throw new Error("Expected autocomplete tooltip");
        }

        expect(tooltip.textContent).toContain("subscriptions");
      });

      const objectCompletion = currentCompletions(view.state).find(
        (completion) => completion.label === "subscriptions"
      );

      if (!objectCompletion) {
        throw new Error("Expected subscriptions object completion");
      }

      const objectApply = objectCompletion?.apply;

      if (typeof objectApply !== "function") {
        throw new Error("Expected object completion apply handler");
      }

      await act(async () => {
        objectApply(
          view,
          objectCompletion,
          value.length - "subscriptions".length,
          value.length
        );
      });

      await waitFor(() => {
        expect(view.state.doc.toString()).toBe(
          [
            "subscriptions {",
            "  netflix = 10",
            "  spotify = 12",
            "}",
            "subscriptions.",
          ].join("\n")
        );

        const tooltip = window.document.querySelector(
          ".cm-tooltip.cm-tooltip-autocomplete"
        );

        if (!(tooltip instanceof window.HTMLElement)) {
          throw new Error("Expected reopened autocomplete tooltip");
        }

        expect(tooltip.textContent).toContain("subscriptions.netflix");
        expect(tooltip.textContent).toContain("subscriptions.spotify");
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps the results column fixed for long calculated output", async () => {
    try {
      const evaluation = await evaluateSheet(
        "12345678901234567890 + 98765432109876543210"
      );
      const { getByTestId } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={evaluation.lines}
          onChange={() => {}}
          value="12345678901234567890 + 98765432109876543210"
        />,
        {
          container: window.document.body,
        }
      );

      const layout = getByTestId("sheet-layout");

      expect(layout.getAttribute("style")).toContain(
        "grid-template-columns: minmax(0, 1fr) calc(13ch + 3rem);"
      );
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps the fixed results column width for unexpectedly long output", () => {
    try {
      const lines: SheetEditorLine[] = [
        {
          displayValue: "x".repeat(400),
          expression: "sqrt",
          kind: "expression",
          label: null,
          raw: "sqrt",
        },
      ];
      const { getByTestId } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={lines}
          onChange={() => {}}
          value="sqrt"
        />,
        {
          container: window.document.body,
        }
      );

      expect(getByTestId("sheet-layout").getAttribute("style")).toContain(
        "grid-template-columns: minmax(0, 1fr) calc(13ch + 3rem);"
      );
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps the results column width fixed for shorter output too", () => {
    try {
      const lines: SheetEditorLine[] = [
        {
          displayValue: "1785 USD",
          expression: "retainer",
          kind: "expression",
          label: "retainer",
          raw: "retainer",
        },
      ];
      const { getByTestId } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={lines}
          onChange={() => {}}
          value="retainer"
        />,
        {
          container: window.document.body,
        }
      );

      expect(getByTestId("sheet-layout").getAttribute("style")).toContain(
        "grid-template-columns: minmax(0, 1fr) calc(13ch + 3rem);"
      );
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("uses the editor mono font for the results column", () => {
    expect(sheetEditorSource).toContain('fontFamily: "var(--font-mono)"');
  });

  test("detects when a result exceeds the fixed ten-character display limit", () => {
    expect(isResultDisplayTruncated("1234567890")).toBe(false);
    expect(isResultDisplayTruncated("12345678901")).toBe(true);
  });

  test("renders a trailing ellipsis after the first ten characters", () => {
    expect(truncateResultDisplay("12345678901")).toBe("1234567890...");
  });

  test("truncates long results with ellipsis and shows the full value in a tooltip", async () => {
    try {
      const lines: SheetEditorLine[] = [
        {
          displayValue: "26/03/24 11:00 GMT-4 New York",
          expression: "call = 4PM CET in new york",
          kind: "expression",
          label: "call",
          raw: "call = 4PM CET in new york",
        },
      ];
      const { getByRole, findByRole } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={lines}
          onChange={() => {}}
          value="call = 4PM CET in new york"
        />,
        {
          container: window.document.body,
        }
      );

      const button = getByRole("button", {
        name: "Copy result 26/03/24 11:00 GMT-4 New York",
      });
      const slotElement = button.parentElement;

      if (slotElement === null) {
        throw new Error("Expected fixed-width result slot");
      }

      const slot: HTMLElement = slotElement;
      const buttonStyle = button.getAttribute("style") ?? "";
      const slotStyle = slot.getAttribute("style") ?? "";

      expect(button.className).toContain("text-right");
      expect(buttonStyle).not.toContain("padding-right");
      expect(buttonStyle).not.toContain("width: 13ch;");
      expect(slot.className).toContain("justify-end");
      expect(slotStyle).toContain("width: 13ch;");
      expect(button.textContent).toBe("26/03/24 1...");

      fireEvent.focus(button);

      const tooltip = await findByRole("tooltip");
      expect(tooltip.textContent).toContain("26/03/24 11:00 GMT-4 New York");
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps the results surface contained inside its grid slot", () => {
    try {
      const lines: SheetEditorLine[] = [
        {
          displayValue: "26/03/24 11:00 GMT-4",
          expression: "call = 4PM CET in new york",
          kind: "expression",
          label: "call",
          raw: "call = 4PM CET in new york",
        },
      ];
      const { getByTestId } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={lines}
          onChange={() => {}}
          value="call = 4PM CET in new york"
        />,
        {
          container: window.document.body,
        }
      );

      const results = getByTestId("sheet-results");
      const style = results.getAttribute("style") ?? "";

      expect(style).toContain("width: 100%;");
      expect(style).toContain("box-sizing: border-box;");
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("uses matching left and right padding for the results surface", () => {
    try {
      const lines: SheetEditorLine[] = [
        {
          displayValue: "1785 USD",
          expression: "retainer",
          kind: "expression",
          label: "retainer",
          raw: "retainer",
        },
      ];
      const { getByTestId } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={lines}
          onChange={() => {}}
          value="retainer"
        />,
        {
          container: window.document.body,
        }
      );

      const layoutStyle =
        getByTestId("sheet-layout").getAttribute("style") ?? "";
      const results = getByTestId("sheet-results");

      expect(layoutStyle).toContain(
        "grid-template-columns: minmax(0, 1fr) calc(13ch + 3rem);"
      );
      expect(results.className).toContain("pl-6");
      expect(results.className).toContain("pr-6");
      expect(results.className).toContain("max-[960px]:pl-4");
      expect(results.className).toContain("max-[960px]:pr-4");
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("shows status icons instead of text for successful import and export directives", () => {
    try {
      const lines: SheetEditorLine[] = [
        {
          displayValue: "Object",
          expression: "Import subscriptions",
          kind: "expression",
          label: null,
          raw: "Import subscriptions",
        },
        {
          displayValue: "25",
          expression: "Export subscriptions.total",
          kind: "expression",
          label: null,
          raw: "Export subscriptions.total",
        },
      ];
      const { getAllByLabelText, queryByRole, queryByText } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={lines}
          onChange={() => {}}
          value={lines.map((line) => line.raw).join("\n")}
        />,
        {
          container: window.document.body,
        }
      );

      expect(getAllByLabelText("Directive resolved")).toHaveLength(2);
      expect(queryByText("Object")).toBeNull();
      expect(queryByText("25")).toBeNull();
      expect(queryByRole("button", { name: "Copy result Object" })).toBeNull();
      expect(queryByRole("button", { name: "Copy result 25" })).toBeNull();
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("shows a question-mark status icon for unresolved import and export directives", () => {
    try {
      const lines: SheetEditorLine[] = [
        {
          displayValue: null,
          expression: "Import subscriptions",
          kind: "error",
          label: null,
          raw: "Import subscriptions",
        },
        {
          displayValue: null,
          expression: "Export subscriptions",
          kind: "error",
          label: null,
          raw: "Export subscriptions",
        },
      ];
      const { getAllByLabelText, queryByText } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={lines}
          onChange={() => {}}
          value={lines.map((line) => line.raw).join("\n")}
        />,
        {
          container: window.document.body,
        }
      );

      expect(getAllByLabelText("Directive unresolved")).toHaveLength(2);
      expect(queryByText("?")).toBeNull();
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps the fixed results slot stable when later output becomes shorter", async () => {
    try {
      const { getByRole, getByTestId } = render(<WidthStabilityHarness />, {
        container: window.document.body,
      });

      fireEvent.click(getByRole("button", { name: "Show long result" }));

      let widenedStyle = "";
      await waitFor(() => {
        const nextStyle =
          getByTestId("sheet-layout").getAttribute("style") ?? "";
        expect(nextStyle).toContain(
          "grid-template-columns: minmax(0, 1fr) calc(13ch + 3rem);"
        );
        widenedStyle = nextStyle;
      });

      fireEvent.click(getByRole("button", { name: "Show short result" }));

      await waitFor(() => {
        expect(getByTestId("sheet-layout").getAttribute("style")).toBe(
          widenedStyle
        );
      });
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("derives result slots from wrapped editor block heights", () => {
    expect(
      buildResultLineSlots(
        [
          { height: 64, top: 60 },
          { height: 32, top: 124 },
          { height: 96, top: 156 },
        ],
        3,
        282
      )
    ).toEqual([
      { height: 64, top: 60 },
      { height: 32, top: 124 },
      { height: 96, top: 156 },
    ]);
  });

  test("pastes Linea clipboard payload back into the editor without the exported result suffix", async () => {
    const onChange = mock((_value: string) => {});

    try {
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={[]}
          onChange={onChange}
          value=""
        />,
        {
          container: window.document.body,
        }
      );

      const content = container.querySelector(".cm-content");
      const editor = container.querySelector(".cm-editor");

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      const clipboardData = createClipboardData({
        "application/x-linea-clipboard": JSON.stringify({
          linewise: false,
          text: "1 + 2",
          version: 1,
        }),
        "text/plain": "1 + 2 = 3",
      });

      dispatchClipboardEvent(content, "paste", clipboardData);

      expect(view.state.doc.toString()).toBe("1 + 2");
      expect(onChange).toHaveBeenLastCalledWith("1 + 2");
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("strips exported plain text results when obvious Linea formulas are pasted back from another app", async () => {
    const onChange = mock((_value: string) => {});

    try {
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={[]}
          onChange={onChange}
          value=""
        />,
        {
          container: window.document.body,
        }
      );

      const content = container.querySelector(".cm-content");
      const editor = container.querySelector(".cm-editor");

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      const clipboardData = createClipboardData({
        "text/plain": "1 + 2 = 3\nFee: 4GBP in Euro = 4.62 EUR",
      });

      dispatchClipboardEvent(content, "paste", clipboardData);

      expect(view.state.doc.toString()).toBe("1 + 2\nFee: 4GBP in Euro");
      expect(onChange).toHaveBeenLastCalledWith("1 + 2\nFee: 4GBP in Euro");
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("keeps ordinary assignment text intact when pasted from another app", async () => {
    const onChange = mock((_value: string) => {});

    try {
      const { container } = render(
        <SheetEditor
          documentId="sheet-1"
          lines={[]}
          onChange={onChange}
          value=""
        />,
        {
          container: window.document.body,
        }
      );

      const content = container.querySelector(".cm-content");
      const editor = container.querySelector(".cm-editor");

      if (!(content instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror content element");
      }

      if (!(editor instanceof window.HTMLElement)) {
        throw new Error("Expected CodeMirror editor element");
      }

      const view = EditorView.findFromDOM(editor);

      if (!view) {
        throw new Error("Expected CodeMirror editor view");
      }

      const clipboardData = createClipboardData({
        "text/plain": "total = 3",
      });

      dispatchClipboardEvent(content, "paste", clipboardData);

      expect(view.state.doc.toString()).toBe("total = 3");
      expect(onChange).toHaveBeenLastCalledWith("total = 3");
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });
});

function createClipboardData(initialData: Record<string, string> = {}) {
  const data = new Map(Object.entries(initialData));

  return {
    clearData() {
      data.clear();
    },
    getData(type: string) {
      return data.get(type) ?? "";
    },
    setData(type: string, value: string) {
      data.set(type, value);
    },
  };
}

function dispatchClipboardEvent(
  target: HTMLElement,
  type: "copy" | "paste",
  clipboardData: ReturnType<typeof createClipboardData>
) {
  const event = new window.Event(type, {
    bubbles: true,
    cancelable: true,
  });

  Object.defineProperty(event, "clipboardData", {
    configurable: true,
    value: clipboardData,
  });

  target.dispatchEvent(event);
}

function readLineaClipboardPayload(
  clipboardData: ReturnType<typeof createClipboardData>
) {
  const payload = clipboardData.getData("application/x-linea-clipboard");

  return payload ? JSON.parse(payload) : null;
}

function EditorHarness() {
  const [value, setValue] = useState("");
  const [lines, setLines] = useState<
    Awaited<ReturnType<typeof evaluateSheet>>["lines"]
  >([]);

  useEffect(() => {
    let cancelled = false;

    void evaluateSheet(value).then((evaluation) => {
      if (!cancelled) {
        setLines(evaluation.lines);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <>
      <button onClick={() => setValue("345")} type="button">
        Populate sheet
      </button>
      <SheetEditor
        documentId="sheet-1"
        lines={lines}
        onChange={setValue}
        value={value}
      />
    </>
  );
}

function LiveSheetHarness({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [lines, setLines] = useState<
    Awaited<ReturnType<typeof evaluateSheet>>["lines"]
  >([]);

  useEffect(() => {
    let cancelled = false;

    void evaluateSheet(value).then((evaluation) => {
      if (!cancelled) {
        setLines(evaluation.lines);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <SheetEditor
      documentId="sheet-1"
      lines={lines}
      onChange={setValue}
      value={value}
    />
  );
}

function WidthStabilityHarness() {
  const [lines, setLines] = useState<
    Awaited<ReturnType<typeof evaluateSheet>>["lines"]
  >([]);

  return (
    <>
      <button
        onClick={async () => {
          const evaluation = await evaluateSheet("12345678901234567890");
          setLines(evaluation.lines);
        }}
        type="button"
      >
        Show long result
      </button>
      <button
        onClick={async () => {
          const evaluation = await evaluateSheet("5");
          setLines(evaluation.lines);
        }}
        type="button"
      >
        Show short result
      </button>
      <SheetEditor
        documentId="sheet-1"
        lines={lines}
        onChange={() => {}}
        value=""
      />
    </>
  );
}
