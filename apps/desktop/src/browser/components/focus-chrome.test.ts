import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const DESKTOP_SOURCE_FILES = [
  "/Users/fabian.urbanek/Github/Linea/apps/desktop/src/browser/components/SheetEditor.tsx",
  "/Users/fabian.urbanek/Github/Linea/apps/desktop/src/browser/components/ui/badge.tsx",
  "/Users/fabian.urbanek/Github/Linea/apps/desktop/src/browser/components/ui/button.tsx",
  "/Users/fabian.urbanek/Github/Linea/apps/desktop/src/browser/components/ui/checkbox.tsx",
  "/Users/fabian.urbanek/Github/Linea/apps/desktop/src/browser/components/ui/input.tsx",
  "/Users/fabian.urbanek/Github/Linea/apps/desktop/src/browser/components/ui/scroll-area.tsx",
  "/Users/fabian.urbanek/Github/Linea/apps/desktop/src/browser/components/ui/select.tsx",
  "/Users/fabian.urbanek/Github/Linea/apps/desktop/src/browser/components/ui/sheet.tsx",
] as const;

const FORBIDDEN_FOCUS_STROKE_PATTERNS = [
  "focus-visible:border",
  "focus-visible:ring",
  "focus:ring",
  "focus:outline",
] as const;

describe("focus chrome", () => {
  test("desktop browser components do not add explicit browser-style focus strokes", () => {
    for (const filePath of DESKTOP_SOURCE_FILES) {
      const source = readFileSync(filePath, "utf8");

      for (const pattern of FORBIDDEN_FOCUS_STROKE_PATTERNS) {
        expect(source).not.toContain(pattern);
      }
    }
  });

  test("the desktop app stylesheet suppresses default browser focus chrome", () => {
    const source = readFileSync(
      "/Users/fabian.urbanek/Github/Linea/apps/desktop/src/browser/styles/app.css",
      "utf8"
    );

    expect(source).toContain("[data-theme] :focus-visible");
    expect(source).toContain("box-shadow: none");
    expect(source).toContain("outline: none");
  });
});
