import {
  LEGACY_WORKSPACE_STORAGE_KEY,
  type WorkspacePersistenceIO,
} from "./workspace-store.shared";

type NativeWorkspaceDirectoryHandle = {
  create(options?: { idempotent?: boolean; intermediates?: boolean }): void;
  exists: boolean;
};

type NativeWorkspaceDocumentFileHandle = {
  create(options?: { intermediates?: boolean; overwrite?: boolean }): void;
  exists: boolean;
  text(): Promise<string>;
  write(contents: string): void;
};

type NativeWorkspacePersistenceAdapter = {
  getWorkspaceDirectory(): NativeWorkspaceDirectoryHandle | null;
  getWorkspaceDocumentFile(): NativeWorkspaceDocumentFileHandle | null;
  readLegacyValue(key: string): Promise<string | null>;
  removeLegacyValue(key: string): Promise<void>;
  writeLegacyValue(key: string, value: string): Promise<void>;
};

export function createNativeWorkspacePersistenceIO(
  adapter: NativeWorkspacePersistenceAdapter
): WorkspacePersistenceIO {
  return {
    async ensureDirectory() {
      const workspaceDirectory = adapter.getWorkspaceDirectory();

      if (!workspaceDirectory || workspaceDirectory.exists) {
        return;
      }

      workspaceDirectory.create({
        idempotent: true,
        intermediates: true,
      });
    },
    async readFile() {
      const workspaceDocumentFile = adapter.getWorkspaceDocumentFile();

      if (!workspaceDocumentFile) {
        return adapter.readLegacyValue(LEGACY_WORKSPACE_STORAGE_KEY);
      }

      if (!workspaceDocumentFile.exists) {
        return null;
      }

      return workspaceDocumentFile.text();
    },
    readLegacyValue(key) {
      return adapter.readLegacyValue(key);
    },
    removeLegacyValue(key) {
      return adapter.removeLegacyValue(key);
    },
    async writeFile(_, contents) {
      const workspaceDocumentFile = adapter.getWorkspaceDocumentFile();

      if (!workspaceDocumentFile) {
        await adapter.writeLegacyValue(LEGACY_WORKSPACE_STORAGE_KEY, contents);
        return;
      }

      if (!workspaceDocumentFile.exists) {
        workspaceDocumentFile.create({
          intermediates: true,
          overwrite: true,
        });
      }

      workspaceDocumentFile.write(contents);
    },
  };
}
