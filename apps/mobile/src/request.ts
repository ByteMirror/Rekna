import {
  buildSheetPlainText,
  extractSheetTags,
  fuzzySearch,
  inferSheetTitle,
  normalizeSheetTags,
} from "@linea/shared";
import type { SearchResult, SheetRecord } from "@linea/shared";

type EmptyPayload = Record<string, never>;

type BootstrapState = {
  activeSheet: SheetRecord;
  sheets: SheetRecord[];
};

type StoredState = {
  activeSheetId: string | null;
  sheets: SheetRecord[];
};

type PersistenceAdapter = {
  load: () => Promise<StoredState | null>;
  save: (state: StoredState) => Promise<void>;
};

type SheetMutation = {
  body: string;
  id: string;
  title?: string;
};

export type MobileRequest = {
  bootstrap: (_params: EmptyPayload) => Promise<BootstrapState>;
  createSheet: (params: { title?: string }) => Promise<SheetRecord>;
  deleteSheet: (params: { id: string }) => Promise<{ id: string }>;
  markSheetOpened: (params: { id: string }) => Promise<SheetRecord>;
  renameSheet: (params: { id: string; title: string }) => Promise<SheetRecord>;
  searchSheets: (params: {
    query: string;
    tags?: string[];
  }) => Promise<SearchResult[]>;
  updateSheet: (params: SheetMutation) => Promise<SheetRecord>;
};

export function createMobileRequest(
  persistence: PersistenceAdapter
): MobileRequest {
  let cachedStatePromise: Promise<StoredState> | null = null;

  const request: MobileRequest = {
    async bootstrap() {
      const state = await loadState();

      if (state.sheets.length === 0) {
        const starter = await request.createSheet({
          title: "Untitled",
        });

        return {
          activeSheet: starter,
          sheets: [starter],
        };
      }

      const activeSheet =
        state.sheets.find((sheet) => sheet.id === state.activeSheetId) ??
        state.sheets[0];

      if (!activeSheet) {
        throw new Error("Expected at least one sheet after bootstrapping");
      }

      return {
        activeSheet,
        sheets: sortSheets(state.sheets),
      };
    },

    async createSheet({ title }) {
      const state = await loadState();
      const timestamp = now();
      const id = crypto.randomUUID();
      const sheet: SheetRecord = {
        body: "",
        createdAt: timestamp,
        filePath: toMobileFilePath(id),
        id,
        lastOpenedAt: timestamp,
        plainText: "",
        tags: [],
        title: title?.trim() || "Untitled",
        updatedAt: timestamp,
      };

      const nextState = {
        activeSheetId: id,
        sheets: sortSheets([sheet, ...state.sheets]),
      } satisfies StoredState;

      await saveState(nextState);
      return sheet;
    },

    async deleteSheet({ id }) {
      const state = await loadState();
      const nextSheets = state.sheets.filter((sheet) => sheet.id !== id);
      const nextActiveSheetId =
        state.activeSheetId === id
          ? (nextSheets[0]?.id ?? null)
          : state.activeSheetId;

      await saveState({
        activeSheetId: nextActiveSheetId,
        sheets: sortSheets(nextSheets),
      });

      return { id };
    },

    async markSheetOpened({ id }) {
      const state = await loadState();
      const sheet = state.sheets.find((entry) => entry.id === id);

      if (!sheet) {
        throw new Error(`Sheet ${id} not found`);
      }

      const updated: SheetRecord = {
        ...sheet,
        lastOpenedAt: now(),
      };

      await saveState({
        activeSheetId: updated.id,
        sheets: sortSheets(
          state.sheets.map((entry) => (entry.id === id ? updated : entry))
        ),
      });

      return updated;
    },

    async renameSheet({ id, title }) {
      return mutateSheet({
        id,
        update: (sheet) => ({
          ...sheet,
          title: title.trim() || sheet.title,
          updatedAt: now(),
        }),
      });
    },

    async searchSheets({ query, tags = [] }) {
      const state = await loadState();
      const normalizedQuery = query.trim();
      const normalizedTags = normalizeSheetTags(tags);

      if (normalizedQuery.length === 0 && normalizedTags.length === 0) {
        return [];
      }

      const searchableSheets =
        normalizedQuery.length === 0
          ? state.sheets
          : fuzzySearch(state.sheets, normalizedQuery, {
              keys: ["title", "plainText", "tags"],
            });

      return searchableSheets
        .filter((sheet) => hasAllTags(sheet.tags, normalizedTags))
        .map((sheet) => ({
          id: sheet.id,
          snippet: buildSnippet(sheet.body, normalizedQuery),
          tags: sheet.tags,
          title: sheet.title,
          updatedAt: sheet.updatedAt,
        }));
    },

    async updateSheet({ body, id, title }) {
      return mutateSheet({
        id,
        update: (sheet) => {
          const updatedAt = now();
          return {
            ...sheet,
            body,
            tags: extractSheetTags(body),
            lastOpenedAt: updatedAt,
            plainText: buildSheetPlainText(body),
            title: title?.trim() || inferSheetTitle(body, sheet.title),
            updatedAt,
          };
        },
      });
    },
  };

  return request;

  async function mutateSheet({
    id,
    update,
  }: {
    id: string;
    update: (sheet: SheetRecord) => SheetRecord;
  }) {
    const state = await loadState();
    const sheet = state.sheets.find((entry) => entry.id === id);

    if (!sheet) {
      throw new Error(`Sheet ${id} not found`);
    }

    const updated = update(sheet);
    await saveState({
      activeSheetId:
        state.activeSheetId === id ? updated.id : (state.activeSheetId ?? id),
      sheets: sortSheets(
        state.sheets.map((entry) => (entry.id === id ? updated : entry))
      ),
    });

    return updated;
  }

  async function loadState() {
    cachedStatePromise ??= persistence
      .load()
      .then((state) => state ?? { activeSheetId: null, sheets: [] });
    return await cachedStatePromise;
  }

  async function saveState(state: StoredState) {
    cachedStatePromise = Promise.resolve(state);
    await persistence.save(state);
  }
}

export function createMemoryMobileRequest() {
  let state: StoredState | null = null;

  return createMobileRequest({
    async load() {
      return state;
    },
    async save(nextState) {
      state = structuredClone(nextState);
    },
  });
}

export function createFilesystemMobileRequest() {
  const storageKey = "linea:mobile-state";

  return createMobileRequest({
    async load() {
      const filesystem = await loadFilesystemModule();

      if (!filesystem) {
        return readWebStorageState(storageKey);
      }

      try {
        const result = await filesystem.Filesystem.readFile({
          path: "state.json",
          directory: filesystem.Directory.Data,
        });

        const serialized =
          typeof result.data === "string"
            ? result.data
            : await result.data.text();

        return deserializeState(serialized);
      } catch {
        return readWebStorageState(storageKey);
      }
    },
    async save(nextState) {
      const serialized = JSON.stringify(nextState);
      const filesystem = await loadFilesystemModule();

      if (!filesystem) {
        writeWebStorageState(storageKey, nextState);
        return;
      }

      try {
        await filesystem.Filesystem.writeFile({
          path: "state.json",
          directory: filesystem.Directory.Data,
          data: serialized,
        });
        writeWebStorageState(storageKey, nextState);
      } catch {
        writeWebStorageState(storageKey, nextState);
      }
    },
  });
}

function sortSheets(sheets: SheetRecord[]) {
  return [...sheets].sort((left, right) => {
    const lastOpenedComparison = right.lastOpenedAt.localeCompare(
      left.lastOpenedAt
    );
    if (lastOpenedComparison !== 0) {
      return lastOpenedComparison;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function hasAllTags(sheetTags: string[], selectedTags: string[]) {
  if (selectedTags.length === 0) {
    return true;
  }

  const tagSet = new Set(sheetTags);
  return selectedTags.every((tag) => tagSet.has(tag));
}

function buildSnippet(body: string, query: string) {
  const plainText = buildSheetPlainText(body);
  const fallback =
    plainText.split(/\r?\n/).find(Boolean)?.trim() ?? "Empty sheet";

  if (!query.trim()) {
    return fallback;
  }

  const lines = plainText.split(/\r?\n/);
  const match = lines.find((line) =>
    line.toLowerCase().includes(query.trim().toLowerCase())
  );

  return match?.trim() || fallback;
}

function toMobileFilePath(sheetId: string) {
  return `mobile://sheets/${sheetId}.md`;
}

function now() {
  return new Date().toISOString();
}

async function loadFilesystemModule() {
  try {
    return await import("@capacitor/filesystem");
  } catch {
    return null;
  }
}

function deserializeState(serialized: string) {
  try {
    const parsed = JSON.parse(serialized) as StoredState;

    if (!parsed || !Array.isArray(parsed.sheets)) {
      return null;
    }

    return {
      activeSheetId:
        typeof parsed.activeSheetId === "string" ? parsed.activeSheetId : null,
      sheets: parsed.sheets,
    } satisfies StoredState;
  } catch {
    return null;
  }
}

function readWebStorageState(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const serialized = window.localStorage.getItem(key);
    return serialized ? deserializeState(serialized) : null;
  } catch {
    return null;
  }
}

function writeWebStorageState(key: string, state: StoredState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Ignore quota and storage-availability errors in the fallback path.
  }
}
