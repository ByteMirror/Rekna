import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appStyles = readFileSync(resolve(import.meta.dir, "./app.css"), "utf8");
const sheetEditorSource = readFileSync(
  resolve(import.meta.dir, "../components/SheetEditor.tsx"),
  "utf8"
);
const overlaySource = readFileSync(
  resolve(import.meta.dir, "../components/CompletionOverlayApp.tsx"),
  "utf8"
);

function readRuleBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = appStyles.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));

  if (!match) {
    throw new Error(`Expected CSS rule for ${selector}`);
  }

  return match[1];
}

describe("completion tooltip styling", () => {
  test("keeps the autocomplete tooltip overflow visible so the inline info pane can render beside it", () => {
    const tooltipRule = readRuleBlock(".cm-tooltip.cm-tooltip-autocomplete");

    expect(tooltipRule).toContain("overflow: visible;");
  });

  test("aligns fallback and native completion rows with stable icon, label, and detail columns", () => {
    const fallbackRowRule = readRuleBlock(
      ".cm-tooltip.cm-tooltip-autocomplete ul li"
    );
    const overlayRowRule = readRuleBlock(".linea-completion-overlay-item");

    expect(fallbackRowRule).toContain("display: grid;");
    expect(fallbackRowRule).toContain(
      "grid-template-columns: 1.25rem minmax(0, 1fr) auto;"
    );
    expect(fallbackRowRule).toContain("column-gap: 0.6875rem;");
    expect(fallbackRowRule).toContain("padding: 0.625rem 0.75rem;");

    expect(overlayRowRule).toContain("display: grid;");
    expect(overlayRowRule).toContain(
      "grid-template-columns: 1.25rem minmax(0, 1fr) auto;"
    );
    expect(overlayRowRule).toContain("column-gap: 0.6875rem;");
    expect(overlayRowRule).toContain("padding: 0.625rem 0.75rem;");
  });

  test("keeps long completion labels and details contained inside the selected row", () => {
    const labelRule = readRuleBlock(
      ".cm-tooltip.cm-tooltip-autocomplete ul li .cm-completionLabel"
    );
    const detailRule = readRuleBlock(
      ".cm-tooltip.cm-tooltip-autocomplete ul li .cm-completionDetail"
    );

    expect(labelRule).toContain("min-width: 0;");
    expect(labelRule).toContain("overflow: hidden;");
    expect(labelRule).toContain("text-overflow: ellipsis;");
    expect(labelRule).toContain("white-space: nowrap;");

    expect(detailRule).toContain("justify-self: end;");
    expect(detailRule).toContain("max-width: 12rem;");
    expect(detailRule).toContain("overflow: hidden;");
    expect(detailRule).toContain("text-overflow: ellipsis;");
    expect(detailRule).toContain("white-space: nowrap;");
  });

  test("uses a hashtag icon for tag completions in both menu implementations", () => {
    expect(appStyles).toMatch(
      /\.cm-tooltip\.cm-tooltip-autocomplete ul li \.cm-completionIcon-tag:after\s*\{[\s\S]*content:\s*"#";/
    );
    expect(overlaySource).toMatch(/if \(type === "tag"\) \{\s*return "#";\s*\}/);
  });

  test("gives the inline completion info panel a comfortable fixed width range", () => {
    const infoRule = readRuleBlock(".cm-tooltip.cm-completionInfo");

    expect(infoRule).toContain("max-width: min(300px, 32vw);");
    expect(infoRule).toContain("min-width: 220px;");
    expect(infoRule).toContain("overflow: auto;");
    expect(sheetEditorSource).toMatch(/Math\.max\(\s*220,\s*Math\.min\(360,/);
  });
});
