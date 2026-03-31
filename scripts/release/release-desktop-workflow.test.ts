import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "../..");
const workflowPath = resolve(repoRoot, ".github/workflows/release-desktop.yml");

describe("Release Desktop workflow", () => {
  test("builds only macOS desktop releases", () => {
    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("label: macOS arm64");
    expect(workflow).toContain("os: macos-latest");
    expect(workflow).toContain("artifact_name: desktop-release-macos-arm64");
    expect(workflow).not.toContain("label: Linux x64");
    expect(workflow).not.toContain("label: Windows x64");
    expect(workflow).not.toContain("os: windows-latest");
    expect(workflow).not.toContain("artifact_name: desktop-release-linux");
    expect(workflow).not.toContain("artifact_name: desktop-release-windows");
  });
});
