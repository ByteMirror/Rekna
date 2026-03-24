import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const APP_SOURCE_FILES = [
  "/Users/fabian.urbanek/Github/Linea/packages/app-shell/src/components/App.tsx",
  "/Users/fabian.urbanek/Github/Linea/packages/app-shell/src/components/SheetEditor.tsx",
  "/Users/fabian.urbanek/Github/Linea/packages/app-shell/src/components/ui/badge.tsx",
  "/Users/fabian.urbanek/Github/Linea/packages/app-shell/src/components/ui/button.tsx",
  "/Users/fabian.urbanek/Github/Linea/packages/app-shell/src/components/ui/checkbox.tsx",
  "/Users/fabian.urbanek/Github/Linea/packages/app-shell/src/components/ui/input.tsx",
  "/Users/fabian.urbanek/Github/Linea/packages/app-shell/src/components/ui/scroll-area.tsx",
  "/Users/fabian.urbanek/Github/Linea/packages/app-shell/src/components/ui/select.tsx",
  "/Users/fabian.urbanek/Github/Linea/packages/app-shell/src/components/ui/sheet.tsx",
] as const;

const FORBIDDEN_FOCUS_STROKE_PATTERNS = [
  "focus-visible:border",
  "focus-visible:ring",
  "focus:ring",
  "focus:outline",
] as const;

describe("focus chrome", () => {
  test("shared app components do not add explicit browser-style focus strokes", () => {
    for (const filePath of APP_SOURCE_FILES) {
      const source = readFileSync(filePath, "utf8");

      for (const pattern of FORBIDDEN_FOCUS_STROKE_PATTERNS) {
        expect(source).not.toContain(pattern);
      }
    }
  });

  test("the shared app stylesheet suppresses default browser focus chrome", () => {
    const source = readFileSync(
      "/Users/fabian.urbanek/Github/Linea/packages/app-shell/src/styles/app.css",
      "utf8"
    );

    expect(source).toContain("[data-theme] :focus-visible");
    expect(source).toContain("box-shadow: none");
    expect(source).toContain("outline: none");
  });
});
