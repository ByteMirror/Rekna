import { describe, expect, test } from "bun:test";

import {
  calculateCompletionOverlayFrame,
  calculateCompletionOverlayLayout,
  getCompletionOverlayInfo,
} from "./completion-overlay";

describe("completion overlay layout", () => {
  test("positions the overlay below the caret when there is enough room", () => {
    const frame = calculateCompletionOverlayFrame({
      caretRect: {
        bottom: 160,
        height: 32,
        left: 180,
        right: 210,
        top: 128,
        width: 30,
      },
      info: {
        body: "Returns the total of the consecutive evaluated rows directly above this line.",
        detail: "Block total",
        title: "sum",
      },
      optionCount: 5,
      window: {
        height: 900,
        width: 520,
      },
    });

    expect(frame.width).toBe(360);
    expect(frame.height).toBe(456);
    expect(frame.y).toBe(128);
  });

  test("flips the overlay above the caret when there is not enough room below", () => {
    const frame = calculateCompletionOverlayFrame({
      caretRect: {
        bottom: 842,
        height: 32,
        left: 470,
        right: 500,
        top: 810,
        width: 30,
      },
      info: {
        body: "Returns the total of the consecutive evaluated rows directly above this line.",
        detail: "Block total",
        title: "sum",
      },
      optionCount: 8,
      window: {
        height: 900,
        width: 520,
      },
    });

    expect(frame.y + frame.height).toBeLessThanOrEqual(842);
    expect(frame.y).toBe(446);
    expect(frame.width).toBeGreaterThanOrEqual(560);
  });

  test("reserves enough height for the docs panel and outer shadow padding", () => {
    const frame = calculateCompletionOverlayFrame({
      caretRect: {
        bottom: 160,
        height: 32,
        left: 180,
        right: 210,
        top: 128,
        width: 30,
      },
      info: {
        body: "Formats a Unix timestamp as a date and time in your local time zone.",
        detail: "Unix timestamp",
        title: "fromunix",
      },
      optionCount: 1,
      window: {
        height: 900,
        width: 520,
      },
    });

    expect(frame.height).toBe(318);
  });

  test("caps long completion lists at a fixed visible height", () => {
    const frame = calculateCompletionOverlayFrame({
      caretRect: {
        bottom: 160,
        height: 32,
        left: 180,
        right: 210,
        top: 128,
        width: 30,
      },
      info: null,
      optionCount: 40,
      window: {
        height: 900,
        width: 520,
      },
    });

    expect(frame.height).toBe(400);
  });

  test("moves the docs panel to the left side when the caret is near the right edge", () => {
    const layout = calculateCompletionOverlayLayout({
      caretRect: {
        bottom: 842,
        height: 32,
        left: 470,
        right: 500,
        top: 810,
        width: 30,
      },
      info: {
        body: "Returns the total of the consecutive evaluated rows directly above this line.",
        detail: "Block total",
        title: "sum",
      },
      optionCount: 8,
      window: {
        height: 900,
        width: 520,
      },
    });

    expect(layout.infoSide).toBe("left");
    expect(layout.infoWidth).toBeGreaterThanOrEqual(220);
    expect(layout.frame.y + layout.frame.height).toBeLessThanOrEqual(842);
  });

  test("shrinks the docs panel width when the available space is tight", () => {
    const layout = calculateCompletionOverlayLayout({
      caretRect: {
        bottom: 200,
        height: 32,
        left: 220,
        right: 250,
        top: 168,
        width: 30,
      },
      info: {
        body: "Returns the total of the consecutive evaluated rows directly above this line.",
        detail: "Block total",
        title: "sum",
      },
      optionCount: 8,
      window: {
        height: 900,
        width: 420,
      },
    });

    expect(layout.infoWidth).toBeLessThan(280);
    expect(layout.infoWidth).toBeGreaterThanOrEqual(120);
  });

  test("stacks the docs panel below the list when neither side can fit it", () => {
    const layout = calculateCompletionOverlayLayout({
      caretRect: {
        bottom: 160,
        height: 32,
        left: 170,
        right: 200,
        top: 128,
        width: 30,
      },
      info: {
        body: "Returns the total of the consecutive evaluated rows directly above this line.",
        detail: "Block total",
        title: "sum",
      },
      optionCount: 1,
      window: {
        height: 900,
        width: 420,
      },
    });

    expect(layout.infoSide).toBe("bottom");
    expect(layout.infoWidth).toBe(280);
    expect(layout.frame.height).toBe(318);
  });
});

describe("completion overlay info", () => {
  test("extracts structured docs from Linea completions", () => {
    const info = getCompletionOverlayInfo({
      detail: "Block total",
      label: "sum",
      lineaInfo: {
        body: "Returns the total of the consecutive evaluated rows directly above this line.",
        title: "sum",
      },
      type: "function",
    });

    expect(info).toEqual({
      body: "Returns the total of the consecutive evaluated rows directly above this line.",
      detail: "Block total",
      title: "sum",
    });
  });

  test("returns null when a completion has no structured docs", () => {
    expect(
      getCompletionOverlayInfo({
        detail: "Variable",
        label: "subtotal",
        type: "variable",
      })
    ).toBeNull();
  });
});
