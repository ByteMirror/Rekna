import { describe, expect, mock, test } from "bun:test";

import type { SheetRecord } from "@linea/shared";

import { buildSheetLinkingState } from "./sheet-linking";

describe("buildSheetLinkingState", () => {
  test("does not expose other sheets' exports until the active sheet imports them", async () => {
    const sheets = [
      createSheetRecord("summary", ""),
      createSheetRecord(
        "subscriptions",
        ["subscriptions = 25", "Export subscriptions"].join("\n")
      ),
    ];
    const [activeSheet] = sheets;

    const linkingState = await buildSheetLinkingState({
      activeDraft: activeSheet.body,
      activeSheetId: activeSheet.id,
      carryRoundedValues: false,
      precision: 2,
      readDraftSnapshot: (_sheetId, fallback) => fallback,
      sheets,
    });

    expect(linkingState.completionSymbols).toEqual([]);
    expect(linkingState.importableSymbols).toEqual([
      { kind: "variable", label: "subscriptions" },
    ]);
    expect(linkingState.importedSymbols).toEqual({});
  });

  test("stops re-evaluating sheets once exported symbols stabilize", async () => {
    const evaluate = mock(async (body: string) => ({
      exportedSymbols: {
        [body]: `${body}-value`,
      },
      lines: [],
    }));

    const sheets = [
      createSheetRecord("alpha"),
      createSheetRecord("beta"),
      createSheetRecord("gamma"),
    ];
    const activeSheet = sheets[2];

    const linkingState = await buildSheetLinkingState({
      activeDraft: activeSheet.body,
      activeSheetId: activeSheet.id,
      carryRoundedValues: false,
      evaluateSheet: evaluate,
      precision: 2,
      readDraftSnapshot: (_sheetId, fallback) => fallback,
      sheets,
    });

    expect(evaluate).toHaveBeenCalledTimes(6);
    expect(linkingState.completionSymbols).toEqual([]);
    expect(linkingState.importableSymbols).toEqual([
      { kind: "variable", label: "alpha" },
      { kind: "variable", label: "beta" },
    ]);
    expect(linkingState.importedSymbols).toEqual({});
  });

  test("exposes only explicitly imported exports to runtime and regular autocomplete", async () => {
    const sheets = [
      createSheetRecord("summary", "Import subscriptions"),
      createSheetRecord(
        "subscriptions",
        ["subscriptions.total = 25", "Export subscriptions"].join("\n")
      ),
    ];
    const [activeSheet] = sheets;

    const linkingState = await buildSheetLinkingState({
      activeDraft: activeSheet.body,
      activeSheetId: activeSheet.id,
      carryRoundedValues: false,
      precision: 2,
      readDraftSnapshot: (_sheetId, fallback) => fallback,
      sheets,
    });

    expect(linkingState.completionSymbols).toEqual([
      { kind: "object", label: "subscriptions" },
      { kind: "property", label: "subscriptions.total" },
    ]);
    expect(linkingState.importableSymbols).toEqual([
      { kind: "object", label: "subscriptions" },
      { kind: "property", label: "subscriptions.total" },
    ]);
    expect(linkingState.importedSymbols).toEqual({
      subscriptions: {
        total: 25,
      },
      "subscriptions.total": 25,
    });
  });
});

function createSheetRecord(title: string, body = title): SheetRecord {
  return {
    body,
    createdAt: "2026-03-22T20:00:00.000Z",
    filePath: `/tmp/${title}.md`,
    id: `sheet-${title}`,
    lastOpenedAt: "2026-03-22T20:00:00.000Z",
    plainText: body,
    tags: [],
    title,
    updatedAt: "2026-03-22T20:00:00.000Z",
  };
}
