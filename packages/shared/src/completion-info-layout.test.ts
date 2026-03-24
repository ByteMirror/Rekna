import { describe, expect, test } from "bun:test";

import { calculateCompletionInfoLayout } from "./completion-info-layout";

describe("calculateCompletionInfoLayout", () => {
  test("moves the info panel to the left when the right side is too tight", () => {
    const layout = calculateCompletionInfoLayout({
      info: { bottom: 212, left: 0, right: 280, top: 80 },
      list: { bottom: 264, left: 540, right: 760, top: 120 },
      space: { bottom: 600, left: 0, right: 780, top: 0 },
    });

    expect(layout.className).toBe("cm-completionInfo-left");
    expect(layout.maxWidth).toBe(300);
    expect(layout.offsetSide).toBe("top");
    expect(layout.style).toContain("top: 6px;");
    expect(layout.style).toContain("max-width: 300px;");
  });

  test("shrinks the info panel width without moving it above or below the list", () => {
    const layout = calculateCompletionInfoLayout({
      info: { bottom: 220, left: 0, right: 280, top: 80 },
      list: { bottom: 264, left: 140, right: 340, top: 120 },
      space: { bottom: 600, left: 0, right: 360, top: 0 },
    });

    expect(layout.className).toBe("cm-completionInfo-left");
    expect(layout.offsetSide).toBe("top");
    expect(layout.maxWidth).toBe(140);
    expect(layout.style).toContain("top: 2px;");
    expect(layout.style).toContain("width: 140px;");
    expect(layout.style).toContain("max-width: 140px;");
  });

  test("keeps the info panel vertically centered on the autocomplete list", () => {
    const layout = calculateCompletionInfoLayout({
      info: { bottom: 220, left: 0, right: 220, top: 80 },
      list: { bottom: 300, left: 180, right: 420, top: 120 },
      space: { bottom: 640, left: 0, right: 900, top: 0 },
    });

    expect(layout.className).toBe("cm-completionInfo-right");
    expect(layout.offsetSide).toBe("top");
    expect(layout.style).toContain("top: 20px;");
    expect(layout.maxWidth).toBe(300);
  });
});
