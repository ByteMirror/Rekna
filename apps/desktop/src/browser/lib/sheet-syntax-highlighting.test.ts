import { describe, expect, test } from "bun:test";

import { tokenizeSheetLine } from "./sheet-syntax-highlighting";

describe("sheet syntax highlighting", () => {
  test("marks full-line comments and headings", () => {
    expect(renderKinds("// Notes go here")).toEqual(["comment"]);
    expect(renderKinds("# Revenue")).toEqual(["heading"]);
  });

  test("marks labels, variables, functions, operators, and values", () => {
    expect(renderKinds("Price: base divide by sqrt 16")).toEqual([
      "label",
      "variable",
      "operator",
      "operator",
      "function",
      "number",
    ]);
  });

  test("marks assignment variables and recognized sheet keywords", () => {
    expect(renderKinds("discount = prev + avg")).toEqual([
      "variable",
      "operator",
      "keyword",
      "operator",
      "keyword",
    ]);
  });

  test("marks currencies, conversion keywords, and target units", () => {
    expect(renderKinds("$30 in EUR")).toEqual(["number", "keyword", "unit"]);
  });

  test("marks decimal values as numbers instead of dotted paths", () => {
    expect(renderKinds("openAI = 20.40")).toEqual([
      "variable",
      "operator",
      "number",
    ]);
    expect(renderKinds("20.40 + 2")).toEqual(["number", "operator", "number"]);
  });

  test("marks currency word and symbol aliases as recognized units", () => {
    expect(renderKinds("30 dollars in €")).toEqual([
      "number",
      "unit",
      "keyword",
      "unit",
    ]);
  });

  test("marks multi-word kitchen unit aliases as units", () => {
    expect(renderTokenTexts("20 ml in tea spoons", "unit")).toEqual([
      "ml",
      "tea spoons",
    ]);
    expect(renderTokenTexts("3 table spoons in ml", "unit")).toEqual([
      "table spoons",
      "ml",
    ]);
  });

  test("marks reverse percentage phrases as recognized keywords", () => {
    expect(renderKinds("20% of what is 30 cm")).toEqual([
      "number",
      "keyword",
      "keyword",
      "keyword",
      "number",
      "unit",
    ]);
  });

  test("marks dotted assignments and property lookups as variables", () => {
    expect(renderKinds("subscriptions.Netflix = 15")).toEqual([
      "object",
      "variable",
      "operator",
      "number",
    ]);
    expect(renderKinds("subscriptions.Netflix + 2")).toEqual([
      "object",
      "variable",
      "operator",
      "number",
    ]);
  });

  test("marks block namespace declarations and lookups as object-aware tokens", () => {
    expect(renderKinds("subscriptions {")).toEqual(["object"]);
    expect(renderKinds("subscriptions.netflix")).toEqual([
      "object",
      "variable",
    ]);
  });

  test("marks import and export directives as sheet-aware tokens", () => {
    expect(renderKinds("Export subscriptions")).toEqual(["keyword", "object"]);
    expect(renderKinds("Import subscriptions.total")).toEqual([
      "keyword",
      "object",
      "variable",
    ]);
    expect(renderKinds("Export subscriptions, tax")).toEqual([
      "keyword",
      "object",
      "variable",
    ]);
  });
});

function renderKinds(line: string) {
  return tokenizeSheetLine(
    line,
    new Set([
      "base",
      "discount",
      "subscriptions",
      "subscriptions.netflix",
      "subscriptions.Netflix",
      "tax",
    ])
  ).map((token) => token.kind);
}

function renderTokenTexts(
  line: string,
  kind: ReturnType<typeof tokenizeSheetLine>[number]["kind"]
) {
  return tokenizeSheetLine(
    line,
    new Set([
      "base",
      "discount",
      "subscriptions",
      "subscriptions.netflix",
      "subscriptions.Netflix",
      "tax",
    ])
  )
    .filter((token) => token.kind === kind)
    .map((token) => line.slice(token.from, token.to));
}
