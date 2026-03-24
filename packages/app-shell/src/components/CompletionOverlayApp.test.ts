import { describe, expect, test } from "bun:test";

import type { CompletionOverlayRenderState } from "@linea/shared";

import { resolveCompletionOverlayShellStyle } from "../lib/completion-overlay-shell-style";

describe("resolveCompletionOverlayShellStyle", () => {
  test("top-aligns side-by-side panels when the overlay sits below the caret", () => {
    expect(
      resolveCompletionOverlayShellStyle(
        createOverlayState({ infoSide: "right", placement: "below" })
      )
    ).toEqual(
      expect.objectContaining({
        alignItems: "flex-start",
        flexDirection: "row",
      })
    );
  });

  test("bottom-aligns side-by-side panels when the overlay flips above the caret", () => {
    expect(
      resolveCompletionOverlayShellStyle(
        createOverlayState({ infoSide: "right", placement: "above" })
      )
    ).toEqual(
      expect.objectContaining({
        alignItems: "flex-end",
        flexDirection: "row",
      })
    );
  });

  test("reverses stacked docs so the list stays closest to the caret above", () => {
    expect(
      resolveCompletionOverlayShellStyle(
        createOverlayState({ infoSide: "bottom", placement: "above" })
      )
    ).toEqual(
      expect.objectContaining({
        alignItems: "stretch",
        flexDirection: "column-reverse",
      })
    );
  });
});

function createOverlayState(
  overrides: Partial<CompletionOverlayRenderState> = {}
): CompletionOverlayRenderState {
  return {
    visible: true,
    theme: "dark",
    items: [],
    selectedIndex: 0,
    info: null,
    placement: "below",
    infoSide: "right",
    infoWidth: null,
    listWidth: 250,
    ...overrides,
  };
}
