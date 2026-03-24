import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appStyles = readFileSync(resolve(import.meta.dir, "./app.css"), "utf8");
const sheetEditorSource = readFileSync(
  resolve(import.meta.dir, "../components/SheetEditor.tsx"),
  "utf8"
);
const inputSource = readFileSync(
  resolve(import.meta.dir, "../components/ui/input.tsx"),
  "utf8"
);

describe("selection styling", () => {
  test("defines semantic selection theme tokens", () => {
    expect(appStyles).toMatch(/--color-selection:\s*var\(--selection\);/);
    expect(appStyles).toMatch(
      /--color-selection-foreground:\s*var\(--selection-foreground\);/
    );
    expect(appStyles).toMatch(/--selection:/);
    expect(appStyles).toMatch(/--selection-foreground:\s*var\(--foreground\);/);
    expect(appStyles).toMatch(/--selection-inset:/);
    expect(appStyles).toMatch(/rgba\(214,\s*220,\s*228,\s*0\.24\)/);
    expect(appStyles).toMatch(/rgba\(72,\s*82,\s*96,\s*0\.2\)/);
    expect(appStyles).toMatch(/::selection\s*\{/);
    expect(appStyles).toMatch(/background-color:\s*var\(--selection\);/);
    expect(appStyles).toMatch(/color:\s*var\(--selection-foreground\);/);
  });

  test("uses semantic selection utilities in shared inputs", () => {
    expect(inputSource).toMatch(/selection:bg-selection/);
    expect(inputSource).toMatch(/selection:text-selection-foreground/);
    expect(inputSource).toMatch(/caret-color:var\(--caret-color\)/);
  });

  test("uses a simple CodeMirror selection override", () => {
    expect(sheetEditorSource).toMatch(
      /\.cm-selectionBackground"\s*:\s*\{[\s\S]*background:\s*"var\(--selection\)"/
    );
    expect(sheetEditorSource).toMatch(
      /&\.cm-focused > \.cm-scroller > \.cm-selectionLayer \.cm-selectionBackground"\s*:\s*\{[\s\S]*background:\s*"var\(--selection\)"/
    );
    expect(sheetEditorSource).toMatch(
      /\.cm-selectionBackground"\s*:\s*\{[\s\S]*borderRadius:\s*"0"/
    );
    expect(sheetEditorSource).toMatch(
      /\.cm-selectionBackground"\s*:\s*\{[\s\S]*margin:\s*"calc\(var\(--selection-inset\) \* -1\)"/
    );
    expect(sheetEditorSource).toMatch(
      /\.cm-selectionBackground"\s*:\s*\{[\s\S]*width:\s*"calc\(100% \+ \(var\(--selection-inset\) \* 2\)\)"/
    );
    expect(sheetEditorSource).toMatch(
      /\.cm-selectionBackground"\s*:\s*\{[\s\S]*height:\s*"calc\(100% \+ \(var\(--selection-inset\) \* 2\)\)"/
    );
    expect(sheetEditorSource).toMatch(/selectionShapeExtension/);
    expect(sheetEditorSource).toMatch(/SELECTION_TOP_LEFT_CLASS/);
    expect(sheetEditorSource).toMatch(/SELECTION_BOTTOM_RIGHT_CLASS/);
    expect(sheetEditorSource).toMatch(
      /\.cm-selectionBackground\.\$\{SELECTION_TOP_LEFT_CLASS\}/
    );
    expect(sheetEditorSource).toMatch(
      /\.cm-content"\s*:\s*\{[^}]*backgroundColor:\s*"transparent"/
    );
    expect(sheetEditorSource).toMatch(
      /\.cm-scroller"\s*:\s*\{[^}]*backgroundColor:\s*"transparent"/
    );
  });
});
