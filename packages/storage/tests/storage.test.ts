import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LineaStorage } from "../src";

describe("LineaStorage", () => {
  test("creates tagged sheets and lists them in most-recent order", () => {
    const storage = new LineaStorage(":memory:");
    const a = storage.createSheet({
      title: "Alpha",
      body: "#budget #home\n\n10 + 2",
    });
    const b = storage.createSheet({
      title: "Beta",
      body: "#travel\n\n10 + 3",
    });

    const sheets = storage.listSheets();

    expect(sheets[0]?.id).toBe(b.id);
    expect(sheets[1]?.id).toBe(a.id);
    expect(sheets[0]?.tags).toEqual(["travel"]);
    expect(sheets[1]?.tags).toEqual(["budget", "home"]);
    expect(existsSync(a.filePath)).toBe(true);
    expect(readFileSync(a.filePath, "utf8")).toBe("#budget #home\n\n10 + 2");
  });

  test("derives tags from sheet content and ignores them for inferred titles", () => {
    const storage = new LineaStorage(":memory:");
    const sheet = storage.createSheet({
      body: "#travel #berlin\n\nTrip budget\nFlights: 200\nHotel: 300",
    });

    expect(sheet.tags).toEqual(["berlin", "travel"]);
    expect(sheet.title).toBe("Trip budget");
  });

  test("updates sheet tags from body edits and finds them through search", () => {
    const storage = new LineaStorage(":memory:");
    const sheet = storage.createSheet({
      title: "Trip budget",
      body: "#travel\n\nFlights: 200\nHotel: 300",
    });

    storage.updateSheet({
      id: sheet.id,
      body: "#travel #berlin\n\nFlights: 200\nHotel: 300\nFood: 120",
      title: "Berlin trip budget",
    });

    const results = storage.searchSheets("berlin food");

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Berlin trip budget");
    expect(results[0]?.tags).toEqual(["berlin", "travel"]);
    expect(results[0]?.snippet.toLowerCase()).toContain("food");
    expect(readFileSync(sheet.filePath, "utf8")).toContain("Food: 120");
  });

  test("uses fuzzy matching for sheet search queries", () => {
    const storage = new LineaStorage(":memory:");
    storage.createSheet({
      title: "Berlin trip budget",
      body: "#travel #berlin\n\nFlights: 200\nHotel: 300",
    });
    storage.createSheet({
      title: "Garden checklist",
      body: "#home\n\nSoil\nWater",
    });

    const results = storage.searchSheets("berln budgt");

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Berlin trip budget");
  });

  test("filters search results by selected tags", () => {
    const storage = new LineaStorage(":memory:");
    storage.createSheet({
      title: "Berlin itinerary",
      body: "#travel #berlin\n\nMuseum Island",
    });
    storage.createSheet({
      title: "Grocery list",
      body: "#home\n\nMilk\nBread",
    });

    const results = storage.searchSheets("island", ["travel"]);

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Berlin itinerary");
  });

  test("deletes sheets and removes them from listings and search", () => {
    const storage = new LineaStorage(":memory:");
    const first = storage.createSheet({
      title: "First",
      body: "#solo\n\n1",
    });
    const second = storage.createSheet({
      title: "Second",
      body: "#solo #keep\n\n2",
    });

    storage.deleteSheet(first.id);

    const sheets = storage.listSheets();
    const results = storage.searchSheets("first");

    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.id).toBe(second.id);
    expect(results).toHaveLength(0);
    expect(existsSync(first.filePath)).toBe(false);
  });

  test("bootstraps with a starter sheet when empty", () => {
    const storage = new LineaStorage(":memory:");
    const state = storage.bootstrap();

    expect(state.activeSheet.title).toBe("Untitled");
    expect(state.sheets).toHaveLength(1);
    expect(state.activeSheet.tags).toEqual([]);
    expect(state.activeSheet.filePath.endsWith(".md")).toBe(true);
  });

  test("bootstraps the last sheet the user opened", () => {
    const storage = new LineaStorage(":memory:");
    const first = storage.createSheet({
      title: "First",
      body: "#alpha\n\n1",
    });
    const second = storage.createSheet({
      title: "Second",
      body: "#beta\n\n2",
    });

    storage.markSheetOpened(first.id);

    const state = storage.bootstrap();

    expect(state.activeSheet.id).toBe(first.id);
    expect(state.sheets[0]?.id).toBe(first.id);
    expect(state.sheets[1]?.id).toBe(second.id);
    expect(state.sheets[0]?.tags).toEqual(["alpha"]);
  });

  test("migrates legacy stored tags into sheet files", () => {
    const dbPath = join(
      tmpdir(),
      `linea-storage-${crypto.randomUUID()}.sqlite`
    );
    const storage = new LineaStorage(dbPath);
    const original = storage.createSheet({
      title: "Trip budget",
      body: "Trip budget\nFlights: 200",
    });

    storage.close();

    const db = new Database(dbPath);
    db.query(
      `
        UPDATE sheets
        SET tags_json = ?
        WHERE id = ?
      `
    ).run(JSON.stringify(["travel", "berlin"]), original.id);
    db.close(false);

    const reopened = new LineaStorage(dbPath);
    const migrated = reopened.listSheets()[0];

    if (!migrated) {
      throw new Error("Expected the reopened sheet to be present");
    }

    expect(migrated.tags).toEqual(["berlin", "travel"]);
    expect(readFileSync(migrated.filePath, "utf8")).toBe(
      "#berlin #travel\n\nTrip budget\nFlights: 200"
    );

    reopened.close();
  });

  test("persists native desktop settings for window behavior", () => {
    const storage = new LineaStorage(":memory:");

    expect(storage.getDesktopSettings()).toEqual({
      keepRunningAfterWindowClose: false,
      launchOnLogin: false,
    });

    const updated = storage.updateDesktopSettings({
      keepRunningAfterWindowClose: true,
      launchOnLogin: true,
    });

    expect(updated).toEqual({
      keepRunningAfterWindowClose: true,
      launchOnLogin: true,
    });
    expect(storage.getDesktopSettings()).toEqual(updated);
  });
});
