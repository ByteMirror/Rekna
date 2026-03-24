import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appStyles = readFileSync(resolve(import.meta.dir, "./app.css"), "utf8");
const sheetEditorSource = readFileSync(
  resolve(import.meta.dir, "../components/SheetEditor.tsx"),
  "utf8"
);

describe("light theme styling", () => {
  test("uses a warm paper background and charcoal text instead of pure white and black", () => {
    expect(appStyles).toMatch(/\[data-theme="light"\]\s*\{/);
    expect(appStyles).toMatch(/--background:\s*#f2ede5;/);
    expect(appStyles).toMatch(/--foreground:\s*#312c25;/);
    expect(appStyles).not.toMatch(/--background:\s*#fff(?:fff)?;/);
    expect(appStyles).not.toMatch(/--foreground:\s*#000(?:000)?;/);
  });

  test("gives the editor its own themed background and foreground surfaces", () => {
    expect(sheetEditorSource).toMatch(
      /"&":\s*\{[\s\S]*backgroundColor:\s*"var\(--background\)"/
    );
    expect(sheetEditorSource).toMatch(
      /"\.cm-content":\s*\{[\s\S]*backgroundColor:\s*"(?:var\(--background\)|transparent)"/
    );
    expect(sheetEditorSource).toMatch(
      /"\.cm-scroller":\s*\{[\s\S]*backgroundColor:\s*"(?:var\(--background\)|transparent)"/
    );
    expect(sheetEditorSource).toMatch(
      /"\.cm-content":\s*\{[\s\S]*color:\s*"var\(--foreground\)"/
    );
  });

  test("softens completion menu shadows in light theme", () => {
    expect(appStyles).toMatch(/--menu-shadow:\s*0 20px 48px rgba\(0, 0, 0, 0\.28\), 0 2px 8px rgba\(0, 0, 0, 0\.22\);/);
    expect(appStyles).toMatch(
      /\[data-theme="light"\]\s*\{[\s\S]*--menu-shadow:\s*0 12px 32px rgba\(49, 44, 37, 0\.14\),\s*0 2px 6px rgba\(49, 44, 37, 0\.08\);/
    );
    expect(appStyles).toMatch(
      /\.cm-tooltip\.cm-tooltip-autocomplete\s*\{[\s\S]*box-shadow:\s*var\(--menu-shadow\);/
    );
    expect(appStyles).toMatch(
      /\.cm-tooltip\.cm-completionInfo\s*\{[\s\S]*box-shadow:\s*var\(--menu-shadow\);/
    );
    expect(appStyles).toMatch(
      /\.linea-completion-overlay-list,\s*\.linea-completion-overlay-info\s*\{[\s\S]*box-shadow:\s*var\(--menu-shadow\);/
    );
  });
});
