import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "../..");
const workflowPath = resolve(repoRoot, ".github/workflows/release-desktop.yml");

describe("Release Desktop workflow", () => {
  test("builds macOS, Linux, and Windows desktop releases", () => {
    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("label: macOS arm64");
    expect(workflow).toContain("label: Linux x64");
    expect(workflow).toContain("label: Windows x64");
    expect(workflow).toContain("os: windows-latest");
    expect(workflow).toContain("artifact_name: desktop-release-windows-x64");
  });
});
