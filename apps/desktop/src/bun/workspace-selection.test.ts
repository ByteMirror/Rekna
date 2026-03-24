import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

describe("workspace selection helpers", () => {
  test("persists the selected workspace path", async () => {
    const {
      readWorkspaceSelection,
      writeWorkspaceSelection,
    } = await import("./workspace-selection");
    const testDirectory = mkdtempSync(join(tmpdir(), "rekna-workspace-"));
    const preferencesPath = join(testDirectory, "workspace.json");

    writeWorkspaceSelection(preferencesPath, {
      name: "Client work",
      path: join(testDirectory, "Client work"),
    });

    expect(readWorkspaceSelection(preferencesPath)).toEqual({
      name: "Client work",
      path: join(testDirectory, "Client work"),
    });
    expect(JSON.parse(readFileSync(preferencesPath, "utf8"))).toEqual({
      version: 1,
      workspacePath: join(testDirectory, "Client work"),
    });
  });

  test("opens an empty directory directly as a workspace", async () => {
    const { openWorkspaceDirectory } = await import("./workspace-selection");
    const testDirectory = mkdtempSync(join(tmpdir(), "rekna-workspace-"));

    const selection = openWorkspaceDirectory(testDirectory);

    expect(selection.name).toBe(basename(testDirectory));
    expect(selection.path).toBe(testDirectory);
    expect(existsSync(selection.path)).toBe(true);
  });

  test("creates workspace storage with sheets inside the chosen workspace", async () => {
    const { createStorageForWorkspace } = await import("./workspace-selection");
    const testDirectory = mkdtempSync(join(tmpdir(), "rekna-workspace-"));
    const storage = createStorageForWorkspace({
      name: "Client work",
      path: join(testDirectory, "Client work"),
    });

    try {
      const sheet = storage.createSheet({
        body: "2 + 2",
        title: "Budget",
      });

      expect(sheet.filePath).toBe(
        join(testDirectory, "Client work", "sheets", `${sheet.id}.md`)
      );
      expect(existsSync(sheet.filePath)).toBe(true);
      expect(existsSync(join(testDirectory, "Client work", ".rekna.sqlite"))).toBe(
        true
      );
    } finally {
      storage.close();
    }
  });
});
