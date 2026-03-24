import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appStyles = readFileSync(resolve(import.meta.dir, "./app.css"), "utf8");
const sheetEditorSource = readFileSync(
  resolve(import.meta.dir, "../components/SheetEditor.tsx"),
  "utf8"
);

describe("syntax highlighting styling", () => {
  test("defines dedicated syntax tokens for the editor in both themes", () => {
    expect(appStyles).toMatch(/--syntax-comment:/);
    expect(appStyles).toMatch(/--syntax-heading:/);
    expect(appStyles).toMatch(/--syntax-label:/);
    expect(appStyles).toMatch(/--syntax-object:/);
    expect(appStyles).toMatch(/--syntax-variable:/);
    expect(appStyles).toMatch(/--syntax-function:/);
    expect(appStyles).toMatch(/--syntax-keyword:/);
    expect(appStyles).toMatch(/--syntax-operator:/);
    expect(appStyles).toMatch(/--syntax-number:/);
    expect(appStyles).toMatch(/--syntax-unit:/);
    expect(appStyles).toMatch(/color-mix\(in oklab,/);
  });

  test("registers a dedicated sheet syntax highlighting extension in the editor", () => {
    expect(sheetEditorSource).toMatch(/sheetSyntaxHighlighting\(\)/);
    expect(sheetEditorSource).toMatch(/"\.linea-token-comment"/);
    expect(sheetEditorSource).toMatch(
      /"\.linea-token-heading(?:, \.linea-token-heading \*)?"/
    );
    expect(sheetEditorSource).toMatch(/"\.linea-token-label"/);
    expect(sheetEditorSource).toMatch(/"\.linea-token-object"/);
    expect(sheetEditorSource).toMatch(/"\.linea-token-variable"/);
    expect(sheetEditorSource).toMatch(/"\.linea-token-function"/);
    expect(sheetEditorSource).toMatch(/"\.linea-token-keyword"/);
    expect(sheetEditorSource).toMatch(/"\.linea-token-operator"/);
    expect(sheetEditorSource).toMatch(/"\.linea-token-number"/);
    expect(sheetEditorSource).toMatch(/"\.linea-token-unit"/);
  });
});
