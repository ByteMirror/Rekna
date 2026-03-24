import {
  parseWorkspaceSnapshot,
  serializeWorkspaceSnapshot,
  type AppWorkspace,
} from "@linea/app-core";

export const LEGACY_WORKSPACE_STORAGE_KEY = "linea:native-workspace:v1";
export const WORKSPACE_DIRECTORY_NAME = "linea";
export const WORKSPACE_DOCUMENT_FILE_NAME = "workspace.json";
export const WORKSPACE_DOCUMENT_PATH = `${WORKSPACE_DIRECTORY_NAME}/${WORKSPACE_DOCUMENT_FILE_NAME}`;

export type WorkspacePersistenceIO = {
  ensureDirectory(path: string): Promise<void>;
  readFile(path: string): Promise<string | null>;
  readLegacyValue(key: string): Promise<string | null>;
  removeLegacyValue(key: string): Promise<void>;
  writeFile(path: string, contents: string): Promise<void>;
};

export async function loadPersistedWorkspaceSnapshot(
  io: WorkspacePersistenceIO
) {
  const persistedDocument = await io.readFile(WORKSPACE_DOCUMENT_PATH);

  if (persistedDocument) {
    return parseWorkspaceSnapshot(persistedDocument);
  }

  const legacySnapshot = await io.readLegacyValue(LEGACY_WORKSPACE_STORAGE_KEY);

  if (!legacySnapshot) {
    return null;
  }

  const parsedLegacySnapshot = parseWorkspaceSnapshot(legacySnapshot);

  if (parsedLegacySnapshot) {
    await io.ensureDirectory(WORKSPACE_DIRECTORY_NAME);
    await io.writeFile(WORKSPACE_DOCUMENT_PATH, legacySnapshot);
    await io.removeLegacyValue(LEGACY_WORKSPACE_STORAGE_KEY);
  }

  return parsedLegacySnapshot;
}

export async function saveWorkspaceSnapshot(
  io: WorkspacePersistenceIO,
  workspace: AppWorkspace
) {
  await io.ensureDirectory(WORKSPACE_DIRECTORY_NAME);
  await io.writeFile(WORKSPACE_DOCUMENT_PATH, serializeWorkspaceSnapshot(workspace));
}
