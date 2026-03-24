import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appStyles = readFileSync(resolve(import.meta.dir, "./app.css"), "utf8");
const sheetEditorSource = readFileSync(
  resolve(import.meta.dir, "../components/SheetEditor.tsx"),
  "utf8"
);

function readRuleBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = appStyles.match(
    new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`)
  );

  if (!match) {
    throw new Error(`Expected CSS rule for ${selector}`);
  }

  return match[1];
}

describe("completion tooltip styling", () => {
  test("keeps the autocomplete list constrained to the viewport width", () => {
    const listRule = readRuleBlock(".cm-tooltip.cm-tooltip-autocomplete > ul");

    expect(listRule).toContain("max-width: min(430px, calc(100vw - 48px));");
    expect(listRule).toContain("overflow-x: hidden;");
    expect(listRule).toContain("overflow-y: auto;");
  });

  test("uses the shared bounded info layout without a fixed minimum width", () => {
    const infoRule = readRuleBlock(".cm-tooltip.cm-completionInfo");
    const bodyRule = readRuleBlock(".linea-completion-info__body");

    expect(infoRule).toContain("max-width: min(300px, calc(100vw - 32px));");
    expect(infoRule).toContain("width: max-content;");
    expect(infoRule).toContain("min-width: 0;");
    expect(bodyRule).toContain("overflow-wrap: anywhere;");
    expect(bodyRule).toContain("word-break: break-word;");
    expect(sheetEditorSource).toContain("calculateCompletionInfoLayout");
  });
});
