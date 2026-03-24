import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import type { WorkspaceSelection } from "@linea/shared";
import { LineaStorage } from "@linea/storage";

type WorkspacePreferences = {
  version: 1;
  workspacePath: string | null;
};

const WORKSPACE_DATABASE_FILE = ".rekna.sqlite";
const WORKSPACE_PREFERENCES_VERSION = 1;
const WORKSPACE_SHEETS_DIRECTORY = "sheets";

export function readWorkspaceSelection(preferencesPath: string) {
  try {
    const serialized = readFileSync(preferencesPath, "utf8");
    const parsed = JSON.parse(serialized) as WorkspacePreferences | null;
    const workspacePath = parsed?.workspacePath;

    if (!workspacePath) {
      return null;
    }

    return workspaceSelectionFromPath(workspacePath);
  } catch {
    return null;
  }
}

export function writeWorkspaceSelection(
  preferencesPath: string,
  selection: WorkspaceSelection | null
) {
  mkdirSync(dirname(preferencesPath), { recursive: true });
  writeFileSync(
    preferencesPath,
    JSON.stringify(
      {
        version: WORKSPACE_PREFERENCES_VERSION,
        workspacePath: selection?.path ?? null,
      } satisfies WorkspacePreferences,
      null,
      2
    )
  );
}

export function workspaceSelectionFromPath(workspacePath: string): WorkspaceSelection {
  const resolvedPath = resolve(workspacePath);

  return {
    name: basename(resolvedPath),
    path: resolvedPath,
  };
}

export function openWorkspaceDirectory(workspacePath: string) {
  const resolvedPath = resolve(workspacePath);
  const stats = statSync(resolvedPath);

  if (!stats.isDirectory()) {
    throw new Error("The selected workspace must be a folder.");
  }

  return workspaceSelectionFromPath(resolvedPath);
}

export function createStorageForWorkspace(selection: WorkspaceSelection) {
  mkdirSync(selection.path, { recursive: true });
  return new LineaStorage(join(selection.path, WORKSPACE_DATABASE_FILE), {
    sheetsDirectory: join(selection.path, WORKSPACE_SHEETS_DIRECTORY),
  });
}

export function pickWorkspaceDirectory({
  platform = process.platform,
  prompt,
}: {
  platform?: NodeJS.Platform;
  prompt: string;
}) {
  if (platform === "darwin") {
    return pickDirectoryWithMacOs(prompt);
  }

  if (platform === "win32") {
    return pickDirectoryWithWindows(prompt);
  }

  return pickDirectoryWithLinux(prompt);
}

function pickDirectoryWithMacOs(prompt: string) {
  const result = spawnSync(
    "osascript",
    [
      "-e",
      [
        "try",
        `POSIX path of (choose folder with prompt "${escapeAppleScript(prompt)}")`,
        'on error number -128',
        'return ""',
        "end try",
      ].join("\n"),
    ],
    { encoding: "utf8" }
  );

  return normalizePickerPath(result.stdout);
}

function pickDirectoryWithWindows(prompt: string) {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    `$dialog.Description = "${escapePowerShellString(prompt)}"`,
    "$dialog.UseDescriptionForTitle = $true",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
    "  [Console]::Out.Write($dialog.SelectedPath)",
    "}",
  ].join("; ");
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", script],
    { encoding: "utf8" }
  );

  return normalizePickerPath(result.stdout);
}

function pickDirectoryWithLinux(prompt: string) {
  const commands: Array<[string, string[]]> = [
    ["zenity", ["--file-selection", "--directory", `--title=${prompt}`]],
    ["kdialog", ["--getexistingdirectory", ".", prompt]],
  ];

  for (const [command, args] of commands) {
    const result = spawnSync(command, args, { encoding: "utf8" });

    if (result.status === 0) {
      return normalizePickerPath(result.stdout);
    }
  }

  return null;
}

function normalizePickerPath(value: string | null | undefined) {
  const nextValue = value?.trim();
  return nextValue ? resolve(nextValue) : null;
}

function escapeAppleScript(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapePowerShellString(value: string) {
  return value.replace(/"/g, "`\"");
}
