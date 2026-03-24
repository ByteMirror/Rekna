import { describe, expect, test } from "bun:test";
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

describe("Sheet", () => {
  test("supports a floating closed state so exit animations can run", async () => {
    try {
      const { Sheet, SheetContent, SheetDescription, SheetTitle } =
        await import("./sheet");

      const { rerender } = render(
        <Sheet modal={false} onOpenChange={() => {}} open>
          <SheetContent floating forceMount side="right">
            <SheetTitle>Library</SheetTitle>
            <SheetDescription>
              Browse, search, and open your saved sheets.
            </SheetDescription>
            <div>Sidebar</div>
          </SheetContent>
        </Sheet>,
        {
          container: window.document.body,
        }
      );

      await waitFor(() => {
        const element = window.document.body.querySelector(
          '[data-slot="sheet-content"]'
        );
        expect(element).not.toBeNull();
        expect(element?.getAttribute("data-state")).toBe("open");
      });

      rerender(
        <Sheet modal={false} onOpenChange={() => {}} open={false}>
          <SheetContent floating forceMount side="right">
            <SheetTitle>Library</SheetTitle>
            <SheetDescription>
              Browse, search, and open your saved sheets.
            </SheetDescription>
            <div>Sidebar</div>
          </SheetContent>
        </Sheet>
      );

      const sheetContent = await waitFor(() => {
        const element = window.document.body.querySelector(
          '[data-slot="sheet-content"]'
        );
        expect(element).not.toBeNull();
        return element as HTMLElement;
      });

      expect(sheetContent.getAttribute("data-state")).toBe("closed");
      expect(sheetContent.className).toContain("top-3");
      expect(sheetContent.className).toContain("bottom-3");
      expect(sheetContent.className).toContain("right-3");
      expect(sheetContent.className).toContain("rounded-2xl");
      expect(sheetContent.className).toContain("data-[state=closed]:translate-x-6");
      expect(sheetContent.className).toContain("ease-[cubic-bezier(0.22,1,0.36,1)]");
      expect(sheetContent.className).toContain("data-[state=closed]:scale-[0.985]");
      expect(sheetContent.className).not.toContain("data-[state=closed]:animate-out");
      expect(sheetContent.className).not.toContain("data-[state=open]:animate-in");
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });
});
