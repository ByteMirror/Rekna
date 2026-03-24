import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  incrementDesktopReleaseVersion,
  isDesktopReleaseVersion,
  parseDesktopReleaseTag,
  REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL,
} from "../../packages/shared/src/desktop-release";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "../..");
const desktopPackageJsonPath = resolve(repoRoot, "apps/desktop/package.json");
const releaseVersionEnv = "REKNA_RELEASE_VERSION";
const releaseBaseUrlEnv = "REKNA_RELEASE_BASE_URL";

type DesktopPackageJson = {
  version?: string;
};

function readDesktopPackageJson() {
  const packageJsonPath = resolveDesktopPackageJsonPath();

  return JSON.parse(
    readFileSync(packageJsonPath, "utf8")
  ) as DesktopPackageJson;
}

function resolveDesktopPackageJsonPath() {
  const workingDirectory = process.env.PWD?.trim() || process.cwd();
  const candidatePaths = [
    desktopPackageJsonPath,
    resolve(workingDirectory, "package.json"),
    resolve(workingDirectory, "apps/desktop/package.json"),
  ];

  for (const candidatePath of candidatePaths) {
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return desktopPackageJsonPath;
}

function listReleaseTags() {
  try {
    const output = execFileSync(
      "git",
      ["tag", "--list", "v*", "--sort=-v:refname"],
      {
        cwd: repoRoot,
        encoding: "utf8",
      }
    );

    return output
      .split(/\r?\n/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function readSeedDesktopReleaseVersion() {
  const packageJsonVersion = readDesktopPackageJson().version;

  if (!packageJsonVersion || !isDesktopReleaseVersion(packageJsonVersion)) {
    throw new Error(
      `apps/desktop/package.json must define a semantic version, received: ${packageJsonVersion ?? "missing"}`
    );
  }

  return packageJsonVersion;
}

export function getLatestDesktopReleaseVersion() {
  for (const tag of listReleaseTags()) {
    const parsedVersion = parseDesktopReleaseTag(tag);

    if (parsedVersion) {
      return parsedVersion;
    }
  }

  return null;
}

export function resolveDesktopReleaseVersion() {
  const overrideVersion = process.env[releaseVersionEnv]?.trim();

  if (overrideVersion) {
    if (!isDesktopReleaseVersion(overrideVersion)) {
      throw new Error(
        `${releaseVersionEnv} must be a semantic version, received: ${overrideVersion}`
      );
    }

    return overrideVersion;
  }

  return getLatestDesktopReleaseVersion() ?? readSeedDesktopReleaseVersion();
}

export function resolveNextDesktopReleaseVersion() {
  const latestReleaseVersion = getLatestDesktopReleaseVersion();
  return latestReleaseVersion
    ? incrementDesktopReleaseVersion(latestReleaseVersion)
    : readSeedDesktopReleaseVersion();
}

export function resolveDesktopReleaseBaseUrl() {
  const overrideBaseUrl = process.env[releaseBaseUrlEnv]?.trim();

  if (overrideBaseUrl) {
    return overrideBaseUrl;
  }

  const repository = process.env.GITHUB_REPOSITORY?.trim();

  if (repository) {
    return `https://github.com/${repository}/releases/latest/download`;
  }

  return REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL;
}
