import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { LEGACY_WORKSPACE_STORAGE_KEY } from "./workspace-store.shared";
import { createNativeWorkspacePersistenceIO } from "./workspace-store.native-io";

type DirectoryHandle = {
  create(options?: { idempotent?: boolean; intermediates?: boolean }): void;
  exists: boolean;
};

type FileHandle = {
  create(options?: { intermediates?: boolean; overwrite?: boolean }): void;
  exists: boolean;
  text(): Promise<string>;
  write(contents: string): void;
};

describe("workspace-store.native", () => {
  test("imports the shared store module through a non-platform-specific path", () => {
    const source = readFileSync(
      new URL("./workspace-store.native.ts", import.meta.url).pathname,
      "utf8"
    );

    expect(source).not.toContain('from "./workspace-store"');
  });

  test("falls back to legacy storage when the document directory is unavailable", async () => {
    const legacyValues = new Map<string, string>();
    const io = createNativeWorkspacePersistenceIO({
      getWorkspaceDirectory: (): DirectoryHandle | null => null,
      getWorkspaceDocumentFile: (): FileHandle | null => null,
      readLegacyValue: async (key) => legacyValues.get(key) ?? null,
      removeLegacyValue: async (key) => {
        legacyValues.delete(key);
      },
      writeLegacyValue: async (key, value) => {
        legacyValues.set(key, value);
      },
    });

    await io.writeFile("ignored", "snapshot");

    expect(legacyValues.get(LEGACY_WORKSPACE_STORAGE_KEY)).toBe("snapshot");
    expect(await io.readFile("ignored")).toBe("snapshot");
  });
});
