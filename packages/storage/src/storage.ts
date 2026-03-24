import { Database } from "bun:sqlite";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  type DesktopSettings,
  type SearchResult,
  type SheetRecord,
  buildSheetPlainText,
  extractSheetTags,
  fuzzySearch,
  inferSheetTitle,
  normalizeFuzzyQuery,
  normalizeSheetTags,
} from "@linea/shared";

type SheetInput = {
  body: string;
  title?: string;
};

type SheetRow = {
  body: string;
  createdAt: string;
  filePath: string;
  id: string;
  lastOpenedAt: string;
  plainText: string;
  tagsJson: string;
  title: string;
  updatedAt: string;
};

type SheetUpdate = {
  body: string;
  id: string;
  title?: string;
};

type BootstrapState = {
  activeSheet: SheetRecord;
  sheets: SheetRecord[];
};

type LineaStorageOptions = {
  sheetsDirectory?: string;
};

type DesktopSettingsRow = {
  keepRunningAfterWindowClose: number;
  launchOnLogin: number;
};

export class LineaStorage {
  private readonly db: Database;
  private readonly sheetsDir: string;

  public constructor(path = ":memory:", options: LineaStorageOptions = {}) {
    this.db = new Database(path, { create: true, strict: true });
    this.sheetsDir =
      options.sheetsDirectory ??
      (path === ":memory:"
        ? mkdtempSync(join(tmpdir(), "linea-sheets-"))
        : join(dirname(path), "sheets"));

    mkdirSync(this.sheetsDir, { recursive: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  public close() {
    this.db.close(false);
  }

  public bootstrap(): BootstrapState {
    const sheets = this.listSheets();
    if (sheets.length === 0) {
      const starter = this.createSheet({
        body: "",
        title: "Untitled",
      });

      return {
        activeSheet: starter,
        sheets: [starter],
      };
    }

    return {
      activeSheet: sheets[0] as SheetRecord,
      sheets,
    };
  }

  public createSheet(input: SheetInput): SheetRecord {
    const timestamp = now();
    const lastOpenedAt = this.nextLastOpenedAt(timestamp);
    const id = crypto.randomUUID();
    const filePath = this.getSheetFilePath(id);
    const title = input.title?.trim() || inferSheetTitle(input.body);
    const tags = extractSheetTags(input.body);
    const plainText = buildSheetPlainText(input.body);

    this.writeSheetBody(filePath, input.body);

    const sheet: SheetRecord = {
      body: input.body,
      createdAt: timestamp,
      filePath,
      id,
      lastOpenedAt,
      plainText,
      tags,
      title,
      updatedAt: timestamp,
    };

    this.db
      .query(
        `
          INSERT INTO sheets (
            id, file_path, title, body, plain_text, tags_json, created_at, updated_at, last_opened_at
          ) VALUES (
            $id, $filePath, $title, $body, $plainText, $tagsJson, $createdAt, $updatedAt, $lastOpenedAt
          )
        `
      )
      .run({
        body: sheet.body,
        createdAt: sheet.createdAt,
        filePath: sheet.filePath,
        id: sheet.id,
        lastOpenedAt: sheet.lastOpenedAt,
        plainText: sheet.plainText,
        tagsJson: stringifyTags(tags),
        title: sheet.title,
        updatedAt: sheet.updatedAt,
      } as Record<string, string>);

    this.updateSearchIndex(sheet);

    return sheet;
  }

  public getDesktopSettings(): DesktopSettings {
    const row = this.db
      .query(
        `
          SELECT
            keep_running_after_window_close AS keepRunningAfterWindowClose,
            launch_on_login AS launchOnLogin
          FROM desktop_settings
          WHERE id = 1
        `
      )
      .get() as DesktopSettingsRow | null;

    return {
      keepRunningAfterWindowClose: row?.keepRunningAfterWindowClose === 1,
      launchOnLogin: row?.launchOnLogin === 1,
    };
  }

  public updateDesktopSettings(settings: DesktopSettings): DesktopSettings {
    this.db
      .query(
        `
          UPDATE desktop_settings
          SET
            keep_running_after_window_close = $keepRunningAfterWindowClose,
            launch_on_login = $launchOnLogin
          WHERE id = 1
        `
      )
      .run({
        keepRunningAfterWindowClose: settings.keepRunningAfterWindowClose
          ? 1
          : 0,
        launchOnLogin: settings.launchOnLogin ? 1 : 0,
      });

    return this.getDesktopSettings();
  }

  public listSheets(): SheetRecord[] {
    return this.db
      .query(
        `
          SELECT
            id,
            file_path AS filePath,
            title,
            body,
            plain_text AS plainText,
            tags_json AS tagsJson,
            created_at AS createdAt,
            updated_at AS updatedAt,
            last_opened_at AS lastOpenedAt
          FROM sheets
          ORDER BY last_opened_at DESC, updated_at DESC, rowid DESC
        `
      )
      .all()
      .map((sheet) => this.hydrateSheetRecord(sheet as SheetRow));
  }

  public searchSheets(
    query: string,
    selectedTags: string[] = []
  ): SearchResult[] {
    const preparedQuery = normalizeFuzzyQuery(query);
    const tags = normalizeSheetTags(selectedTags);

    if (preparedQuery === "" && tags.length === 0) {
      return [];
    }

    const matchingSheets = this.listSheets().filter((sheet) =>
      hasAllTags(sheet.tags, tags)
    );
    const rankedSheets =
      preparedQuery === ""
        ? matchingSheets
        : fuzzySearch(matchingSheets, preparedQuery, {
            keys: [
              { name: "title", weight: 0.45 },
              { name: "plainText", weight: 0.35 },
              { name: "tags", weight: 0.2 },
            ],
          });

    return rankedSheets.map((sheet) => ({
      id: sheet.id,
      snippet: buildSearchSnippet(sheet.plainText, preparedQuery),
      tags: sheet.tags,
      title: sheet.title,
      updatedAt: sheet.updatedAt,
    }));
  }

  public updateSheet(update: SheetUpdate): SheetRecord {
    const existing = this.db
      .query(
        `
          SELECT
            id,
            file_path AS filePath,
            title,
            body,
            plain_text AS plainText,
            tags_json AS tagsJson,
            created_at AS createdAt,
            updated_at AS updatedAt,
            last_opened_at AS lastOpenedAt
          FROM sheets
          WHERE id = $id
        `
      )
      .get({ id: update.id }) as SheetRow | null;

    if (!existing) {
      throw new Error(`Sheet ${update.id} not found`);
    }

    const filePath = existing.filePath || this.getSheetFilePath(existing.id);
    const updatedAt = now();
    const lastOpenedAt = this.nextLastOpenedAt(updatedAt);
    const tags = extractSheetTags(update.body);
    const plainText = buildSheetPlainText(update.body);
    const nextSheet: SheetRecord = {
      body: update.body,
      createdAt: existing.createdAt,
      filePath,
      id: existing.id,
      lastOpenedAt,
      plainText,
      tags,
      title:
        update.title?.trim() || existing.title || inferSheetTitle(update.body),
      updatedAt,
    };

    this.writeSheetBody(nextSheet.filePath, nextSheet.body);

    this.db
      .query(
        `
          UPDATE sheets
          SET
            file_path = $filePath,
            title = $title,
            body = $body,
            plain_text = $plainText,
            tags_json = $tagsJson,
            updated_at = $updatedAt,
            last_opened_at = $lastOpenedAt
          WHERE id = $id
        `
      )
      .run({
        body: nextSheet.body,
        filePath: nextSheet.filePath,
        id: nextSheet.id,
        lastOpenedAt: nextSheet.lastOpenedAt,
        plainText: nextSheet.plainText,
        tagsJson: stringifyTags(nextSheet.tags),
        title: nextSheet.title,
        updatedAt: nextSheet.updatedAt,
      } as Record<string, string>);

    this.updateSearchIndex(nextSheet);

    return nextSheet;
  }

  public renameSheet(id: string, title: string): SheetRecord {
    const existing = this.db
      .query(
        `
          SELECT
            id,
            file_path AS filePath,
            title,
            body,
            plain_text AS plainText,
            tags_json AS tagsJson,
            created_at AS createdAt,
            updated_at AS updatedAt,
            last_opened_at AS lastOpenedAt
          FROM sheets
          WHERE id = $id
        `
      )
      .get({ id }) as SheetRow | null;

    if (!existing) {
      throw new Error(`Sheet ${id} not found`);
    }

    const nextTitle = title.trim() || existing.title;
    const updatedAt = now();
    const nextSheet: SheetRecord = {
      body: existing.body,
      createdAt: existing.createdAt,
      filePath: existing.filePath || this.getSheetFilePath(existing.id),
      id: existing.id,
      lastOpenedAt: existing.lastOpenedAt,
      plainText: buildSheetPlainText(existing.body),
      tags: extractSheetTags(existing.body),
      title: nextTitle,
      updatedAt,
    };

    this.db
      .query(
        `
          UPDATE sheets
          SET title = $title, updated_at = $updatedAt
          WHERE id = $id
        `
      )
      .run({
        id,
        title: nextTitle,
        updatedAt,
      });

    this.updateSearchIndex(nextSheet);

    return nextSheet;
  }

  public deleteSheet(id: string) {
    const existing = this.db
      .query(
        `
          SELECT file_path AS filePath
          FROM sheets
          WHERE id = $id
        `
      )
      .get({ id }) as { filePath: string } | null;

    if (!existing) {
      throw new Error(`Sheet ${id} not found`);
    }

    this.db.query("DELETE FROM sheets WHERE id = $id").run({ id });
    this.db.query("DELETE FROM sheet_search WHERE sheet_id = $sheetId").run({
      sheetId: id,
    });

    try {
      unlinkSync(existing.filePath);
    } catch {
      // Ignore already-missing files.
    }

    return { id };
  }

  public markSheetOpened(id: string): SheetRecord {
    const existing = this.db
      .query(
        `
          SELECT
            id,
            file_path AS filePath,
            title,
            body,
            plain_text AS plainText,
            tags_json AS tagsJson,
            created_at AS createdAt,
            updated_at AS updatedAt,
            last_opened_at AS lastOpenedAt
          FROM sheets
          WHERE id = $id
        `
      )
      .get({ id }) as SheetRow | null;

    if (!existing) {
      throw new Error(`Sheet ${id} not found`);
    }

    const lastOpenedAt = this.nextLastOpenedAt();

    this.db
      .query(
        `
          UPDATE sheets
          SET last_opened_at = $lastOpenedAt
          WHERE id = $id
        `
      )
      .run({
        id,
        lastOpenedAt,
      });

    return this.hydrateSheetRecord({
      ...existing,
      lastOpenedAt,
    });
  }

  private getSheetFilePath(sheetId: string) {
    return join(this.sheetsDir, `${sheetId}.md`);
  }

  private hydrateSheetRecord(sheet: SheetRow): SheetRecord {
    const filePath = sheet.filePath || this.getSheetFilePath(sheet.id);
    const body = existsSync(filePath)
      ? this.readSheetBody(filePath, sheet.body)
      : sheet.body;
    const plainText = buildSheetPlainText(body);
    const tags = extractSheetTags(body);
    const tagsJson = stringifyTags(tags);

    if (!existsSync(filePath)) {
      this.writeSheetBody(filePath, body);
    }

    if (
      filePath !== sheet.filePath ||
      body !== sheet.body ||
      plainText !== sheet.plainText ||
      tagsJson !== sheet.tagsJson
    ) {
      this.db
        .query(
          `
            UPDATE sheets
            SET
              file_path = $filePath,
              body = $body,
              plain_text = $plainText,
              tags_json = $tagsJson
            WHERE id = $id
          `
        )
        .run({
          body,
          filePath,
          id: sheet.id,
          plainText,
          tagsJson,
        });
    }

    const hydratedSheet = {
      body,
      createdAt: sheet.createdAt,
      filePath,
      id: sheet.id,
      lastOpenedAt: sheet.lastOpenedAt,
      plainText,
      tags,
      title: sheet.title,
      updatedAt: sheet.updatedAt,
    } satisfies SheetRecord;

    this.updateSearchIndex(hydratedSheet);

    return hydratedSheet;
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sheets (
        id TEXT PRIMARY KEY,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        file_path TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        plain_text TEXT NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_opened_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS desktop_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        keep_running_after_window_close INTEGER NOT NULL DEFAULT 0,
        launch_on_login INTEGER NOT NULL DEFAULT 0
      );
    `);

    this.db
      .query(
        `
          INSERT OR IGNORE INTO desktop_settings (
            id,
            keep_running_after_window_close,
            launch_on_login
          ) VALUES (1, 0, 0)
        `
      )
      .run();

    const columns = this.db.query("PRAGMA table_info(sheets)").all() as Array<{
      name: string;
    }>;
    const hasFilePath = columns.some((column) => column.name === "file_path");

    if (!hasFilePath) {
      this.db.exec(
        "ALTER TABLE sheets ADD COLUMN file_path TEXT NOT NULL DEFAULT '';"
      );
    }

    const hasTagsJson = columns.some((column) => column.name === "tags_json");

    if (!hasTagsJson) {
      this.db.exec(
        "ALTER TABLE sheets ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';"
      );
    }

    this.migrateFoldersToTags();
    this.migrateLegacyTagsIntoSheetBodies();

    this.db.exec("DROP TABLE IF EXISTS sheet_search;");
    this.db.exec(`
      CREATE VIRTUAL TABLE sheet_search USING fts5(
        sheet_id UNINDEXED,
        title,
        plain_text,
        tags_text
      );
    `);
    this.rebuildSearchIndex();
  }

  private readSheetBody(filePath: string, fallback: string) {
    try {
      return readFileSync(filePath, "utf8");
    } catch {
      return fallback;
    }
  }

  private updateSearchIndex(sheet: SheetRecord) {
    this.db.query("DELETE FROM sheet_search WHERE sheet_id = $sheetId").run({
      sheetId: sheet.id,
    });

    this.db
      .query(
        `
          INSERT INTO sheet_search (sheet_id, title, plain_text, tags_text)
          VALUES ($sheetId, $title, $plainText, $tagsText)
        `
      )
      .run({
        plainText: sheet.plainText,
        sheetId: sheet.id,
        tagsText: sheet.tags.join(" "),
        title: sheet.title,
      });
  }

  private migrateFoldersToTags() {
    const legacyAssignments = this.db
      .query(
        `
          SELECT s.id, s.tags_json AS tagsJson, f.name
          FROM sheets s
          JOIN folders f ON f.id = s.folder_id
          WHERE f.name IS NOT NULL
        `
      )
      .all() as Array<{
      id: string;
      name: string;
      tagsJson: string;
    }>;

    for (const assignment of legacyAssignments) {
      const tags = normalizeSheetTags([
        ...parseTags(assignment.tagsJson),
        assignment.name,
      ]);

      this.db
        .query(
          `
            UPDATE sheets
            SET tags_json = $tagsJson
            WHERE id = $id
          `
        )
        .run({
          id: assignment.id,
          tagsJson: stringifyTags(tags),
        });
    }
  }

  private migrateLegacyTagsIntoSheetBodies() {
    const rows = this.db
      .query(
        `
          SELECT
            id,
            file_path AS filePath,
            body,
            tags_json AS tagsJson
          FROM sheets
        `
      )
      .all() as Array<{
      body: string;
      filePath: string;
      id: string;
      tagsJson: string;
    }>;

    for (const row of rows) {
      const legacyTags = parseTags(row.tagsJson);

      if (legacyTags.length === 0) {
        continue;
      }

      const filePath = row.filePath || this.getSheetFilePath(row.id);
      const body = existsSync(filePath)
        ? this.readSheetBody(filePath, row.body)
        : row.body;

      if (extractSheetTags(body).length > 0) {
        continue;
      }

      const nextBody = `${legacyTags.map((tag) => `#${tag}`).join(" ")}${
        body ? `\n\n${body}` : ""
      }`;

      this.writeSheetBody(filePath, nextBody);
      this.db
        .query(
          `
            UPDATE sheets
            SET
              file_path = $filePath,
              body = $body,
              plain_text = $plainText,
              tags_json = $tagsJson
            WHERE id = $id
          `
        )
        .run({
          body: nextBody,
          filePath,
          id: row.id,
          plainText: buildSheetPlainText(nextBody),
          tagsJson: stringifyTags(legacyTags),
        });
    }
  }

  private rebuildSearchIndex() {
    const sheets = this.listSheets();

    for (const sheet of sheets) {
      this.updateSearchIndex(sheet);
    }
  }

  private nextLastOpenedAt(minimum?: string | null) {
    const currentMax = this.db
      .query(
        `
          SELECT MAX(last_opened_at) AS lastOpenedAt
          FROM sheets
        `
      )
      .get() as {
      lastOpenedAt: string | null;
    };

    return nextIsoTimestamp(currentMax.lastOpenedAt, minimum);
  }

  private writeSheetBody(filePath: string, body: string) {
    const temporaryPath = `${filePath}.tmp`;
    writeFileSync(temporaryPath, body, "utf8");
    renameSync(temporaryPath, filePath);
  }
}

function buildSearchSnippet(plainText: string, query: string) {
  const normalizedQuery = normalizeFuzzyQuery(query).toLowerCase();
  const lines = plainText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return "Empty sheet";
  }

  const queryTerms = normalizedQuery.split(" ").filter(Boolean);
  const exactLineMatch = lines.find((line) => {
    const normalizedLine = line.toLowerCase();
    return queryTerms.some((term) => normalizedLine.includes(term));
  });
  const sourceLine = exactLineMatch ?? lines[0];

  return sourceLine.length > 140
    ? `${sourceLine.slice(0, 137)}...`
    : sourceLine;
}

function now() {
  return new Date().toISOString();
}

function nextIsoTimestamp(...candidates: Array<string | null | undefined>) {
  const candidateMs = candidates
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  const floorMs =
    candidateMs.length === 0
      ? Number.NEGATIVE_INFINITY
      : Math.max(...candidateMs);

  return new Date(Math.max(Date.now(), floorMs + 1)).toISOString();
}

function hasAllTags(sheetTags: string[], selectedTags: string[]) {
  if (selectedTags.length === 0) {
    return true;
  }

  const tagSet = new Set(sheetTags);
  return selectedTags.every((tag) => tagSet.has(tag));
}

function parseTags(tagsJson: string) {
  try {
    const parsed = JSON.parse(tagsJson) as unknown;
    return Array.isArray(parsed)
      ? normalizeSheetTags(parsed.filter(isString))
      : [];
  } catch {
    return [];
  }
}

function stringifyTags(tags: string[]) {
  return JSON.stringify(normalizeSheetTags(tags));
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
