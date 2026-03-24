import { describe, expect, test } from "bun:test";

import { computeSheetEvaluation, type SheetEvaluationSheet } from "./sheet-evaluation";

describe("computeSheetEvaluation", () => {
  test("does not expose other sheets' exports until the active sheet imports them", async () => {
    const sheets = [
      createSheet("sheet-summary", ""),
      createSheet(
        "sheet-subscriptions",
        ["subscriptions.total = 25", "Export subscriptions"].join("\n")
      ),
    ];

    const result = await computeSheetEvaluation({
      activeDraft: "",
      activeSheetId: "sheet-summary",
      carryRoundedValues: false,
      precision: 2,
      sheets,
    });

    expect(result.completionSymbols).toEqual([]);
  });

  test("only exposes explicitly imported exports to runtime and autocomplete", async () => {
    const activeDraft = ["Import subscriptions", "subscriptions.total"].join(
      "\n"
    );
    const sheets = [
      createSheet("sheet-summary", activeDraft),
      createSheet(
        "sheet-subscriptions",
        ["subscriptions.total = 25", "Export subscriptions"].join("\n")
      ),
    ];

    const result = await computeSheetEvaluation({
      activeDraft,
      activeSheetId: "sheet-summary",
      carryRoundedValues: false,
      precision: 2,
      sheets,
    });

    expect(result.completionSymbols).toEqual([
      { kind: "object", label: "subscriptions" },
      { kind: "property", label: "subscriptions.total" },
    ]);
    expect(result.lines[0]?.displayValue).toBe("Object");
    expect(result.lines[1]?.displayValue).toBe("25");
  });

  test("does not leak unimported sibling-sheet properties into a local object namespace", async () => {
    const activeDraft = [
      "recurring {",
      "  fitnessGuxhagen = 66.99 EUR",
      "  netflix = 19.99 EUR",
      "  openAI = 20.40 EUR",
      "}",
      "",
      "recurring.",
    ].join("\n");
    const sheets = [
      createSheet("sheet-current", activeDraft),
      createSheet(
        "sheet-archive",
        [
          "recurring.added = 1",
          "recurring.obsidian = 2",
          "recurring.apple = 3",
          "Export recurring",
        ].join("\n")
      ),
    ];

    const result = await computeSheetEvaluation({
      activeDraft,
      activeSheetId: "sheet-current",
      carryRoundedValues: false,
      precision: 2,
      sheets,
    });

    expect(result.completionSymbols).toEqual([]);
  });

  test("evaluates imported currency object arithmetic without explicit currency tokens when carry-rounded mode is enabled", async () => {
    const activeDraft = [
      "Import recurring",
      "Price: recurring.added x 4",
      "5% of recurring.added",
      "netflixyearly: recurring.netflix x 12",
      "openAIwithtax: recurring.openAI + 19%",
    ].join("\n");
    const sheets = [
      createSheet("sheet-current", activeDraft),
      createSheet(
        "sheet-recurring",
        [
          "recurring {",
          "  fitnessGuxhagen = 66.99 EUR",
          "  netflix = 19.99 EUR",
          "  openAI = 20.40 EUR",
          "  added = sum",
          "}",
          "Export recurring",
        ].join("\n")
      ),
    ];

    const result = await computeSheetEvaluation({
      activeDraft,
      activeSheetId: "sheet-current",
      carryRoundedValues: true,
      precision: 2,
      sheets,
    });

    expect(result.lines[1]?.displayValue).toBe("428 EUR");
    expect(result.lines[2]?.displayValue).toBe("5 EUR");
    expect(result.lines[3]?.displayValue).toBe("240 EUR");
    expect(result.lines[4]?.displayValue).toBe("24 EUR");
  });
});

function createSheet(id: string, body: string): SheetEvaluationSheet {
  return {
    body,
    id,
  };
}
