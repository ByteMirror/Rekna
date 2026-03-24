import { describe, expect, test } from "bun:test";

import {
  bootstrapWorkspace,
  serializeWorkspaceSnapshot,
} from "@linea/app-core";

import {
  LEGACY_WORKSPACE_STORAGE_KEY,
  WORKSPACE_DOCUMENT_PATH,
  loadPersistedWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  type WorkspacePersistenceIO,
} from "./workspace-store.shared";

function createPersistenceIO({
  fileContents = new Map<string, string>(),
  legacyValues = new Map<string, string>(),
}: {
  fileContents?: Map<string, string>;
  legacyValues?: Map<string, string>;
} = {}) {
  const ensuredDirectories: string[] = [];
  const removedLegacyKeys: string[] = [];

  const io: WorkspacePersistenceIO = {
    async ensureDirectory(path) {
      ensuredDirectories.push(path);
    },
    async readFile(path) {
      return fileContents.get(path) ?? null;
    },
    async readLegacyValue(key) {
      return legacyValues.get(key) ?? null;
    },
    async removeLegacyValue(key) {
      removedLegacyKeys.push(key);
      legacyValues.delete(key);
    },
    async writeFile(path, contents) {
      fileContents.set(path, contents);
    },
  };

  return {
    ensuredDirectories,
    fileContents,
    io,
    legacyValues,
    removedLegacyKeys,
  };
}

describe("workspace-store", () => {
  test("loads the workspace from the document file when it exists", async () => {
    const bootstrapped = bootstrapWorkspace(null, {
      idFactory: () => "sheet-1",
      now: () => "2026-03-24T12:00:00.000Z",
    });
    const persistedSnapshot = serializeWorkspaceSnapshot(bootstrapped.workspace);
    const { io } = createPersistenceIO({
      fileContents: new Map([[WORKSPACE_DOCUMENT_PATH, persistedSnapshot]]),
    });

    const loaded = await loadPersistedWorkspaceSnapshot(io);

    expect(loaded?.activeSheetId).toBe("sheet-1");
    expect(loaded?.sheets).toHaveLength(1);
  });

  test("migrates the legacy AsyncStorage snapshot into the workspace document", async () => {
    const bootstrapped = bootstrapWorkspace(null, {
      idFactory: () => "sheet-1",
      now: () => "2026-03-24T12:00:00.000Z",
    });
    const legacySnapshot = serializeWorkspaceSnapshot(bootstrapped.workspace);
    const {
      ensuredDirectories,
      fileContents,
      io,
      removedLegacyKeys,
    } = createPersistenceIO({
      legacyValues: new Map([[LEGACY_WORKSPACE_STORAGE_KEY, legacySnapshot]]),
    });

    const loaded = await loadPersistedWorkspaceSnapshot(io);

    expect(loaded?.activeSheetId).toBe("sheet-1");
    expect(ensuredDirectories).toEqual(["linea"]);
    expect(fileContents.get(WORKSPACE_DOCUMENT_PATH)).toBe(legacySnapshot);
    expect(removedLegacyKeys).toEqual([LEGACY_WORKSPACE_STORAGE_KEY]);
  });

  test("saves the workspace snapshot into the document file", async () => {
    const bootstrapped = bootstrapWorkspace(null, {
      idFactory: () => "sheet-1",
      now: () => "2026-03-24T12:00:00.000Z",
    });
    const { ensuredDirectories, fileContents, io } = createPersistenceIO();

    await saveWorkspaceSnapshot(io, bootstrapped.workspace);

    expect(ensuredDirectories).toEqual(["linea"]);
    expect(fileContents.get(WORKSPACE_DOCUMENT_PATH)).toBe(
      serializeWorkspaceSnapshot(bootstrapped.workspace)
    );
  });
});
