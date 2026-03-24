import { describe, expect, test } from "bun:test";

describe("app-core workspace helpers", () => {
  test("bootstraps a starter sheet when there is no stored workspace", async () => {
    const { bootstrapWorkspace } = await import("./workspace");

    const bootstrapped = bootstrapWorkspace(null, {
      idFactory: () => "sheet-1",
      now: () => "2026-03-24T12:00:00.000Z",
    });

    expect(bootstrapped.activeSheet.id).toBe("sheet-1");
    expect(bootstrapped.activeSheet.title).toBe("Untitled");
    expect(bootstrapped.workspace.activeSheetId).toBe("sheet-1");
    expect(bootstrapped.workspace.sheets).toHaveLength(1);
  });

  test("updates the active sheet body and infers a title from the first line", async () => {
    const { bootstrapWorkspace, updateSheetBody } = await import("./workspace");

    const bootstrapped = bootstrapWorkspace(null, {
      idFactory: () => "sheet-1",
      now: () => "2026-03-24T12:00:00.000Z",
    });

    const updated = updateSheetBody(bootstrapped.workspace, {
      body: "Trip budget\n2 + 2",
      id: "sheet-1",
      now: () => "2026-03-24T12:05:00.000Z",
    });

    expect(updated.activeSheet?.body).toBe("Trip budget\n2 + 2");
    expect(updated.activeSheet?.title).toBe("Trip budget");
    expect(updated.workspace.sheets[0]?.updatedAt).toBe("2026-03-24T12:05:00.000Z");
  });

  test("parses both legacy and versioned workspace snapshots", async () => {
    const { parseWorkspaceSnapshot } = await import("./workspace");

    const legacy = parseWorkspaceSnapshot(
      JSON.stringify({
        activeSheetId: "sheet-1",
        sheets: [
          {
            body: "",
            createdAt: "2026-03-24T12:00:00.000Z",
            filePath: "native://sheets/sheet-1.md",
            id: "sheet-1",
            lastOpenedAt: "2026-03-24T12:00:00.000Z",
            plainText: "",
            tags: [],
            title: "Untitled",
            updatedAt: "2026-03-24T12:00:00.000Z",
          },
        ],
      })
    );

    const versioned = parseWorkspaceSnapshot(
      JSON.stringify({
        version: 1,
        workspace: {
          activeSheetId: "sheet-2",
          sheets: [
            {
              body: "",
              createdAt: "2026-03-24T12:00:00.000Z",
              filePath: "native://sheets/sheet-2.md",
              id: "sheet-2",
              lastOpenedAt: "2026-03-24T12:00:00.000Z",
              plainText: "",
              tags: [],
              title: "Another sheet",
              updatedAt: "2026-03-24T12:00:00.000Z",
            },
          ],
        },
      })
    );

    expect(legacy?.activeSheetId).toBe("sheet-1");
    expect(versioned?.activeSheetId).toBe("sheet-2");
  });

  test("falls back to a local id generator when global crypto is unavailable", async () => {
    const originalCrypto = globalThis.crypto;
    globalThis.crypto = undefined as unknown as typeof globalThis.crypto;

    try {
      const { bootstrapWorkspace } = await import("./workspace");

      const bootstrapped = bootstrapWorkspace(null, {
        now: () => "2026-03-24T12:00:00.000Z",
      });

      expect(bootstrapped.activeSheet.id).toStartWith("sheet-");
      expect(bootstrapped.workspace.activeSheetId).toBe(bootstrapped.activeSheet.id);
    } finally {
      globalThis.crypto = originalCrypto;
    }
  });

  test("creates, searches, and deletes sheets while preserving a valid active sheet", async () => {
    const {
      bootstrapWorkspace,
      createSheet,
      deleteSheet,
      searchSheets,
      setActiveSheet,
    } = await import("./workspace");

    const bootstrapped = bootstrapWorkspace(null, {
      idFactory: () => "sheet-1",
      now: () => "2026-03-24T12:00:00.000Z",
    });

    const withSecondSheet = createSheet(bootstrapped.workspace, {
      idFactory: () => "sheet-2",
      now: () => "2026-03-24T12:10:00.000Z",
      title: "Travel notes",
    });

    const activeSecondSheet = setActiveSheet(withSecondSheet.workspace, "sheet-2");
    const results = searchSheets(activeSecondSheet.workspace, {
      query: "travel",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("sheet-2");

    const afterDelete = deleteSheet(activeSecondSheet.workspace, "sheet-2");

    expect(afterDelete.workspace.sheets).toHaveLength(1);
    expect(afterDelete.activeSheet?.id).toBe("sheet-1");
  });
});
