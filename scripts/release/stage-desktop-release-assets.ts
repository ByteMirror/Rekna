import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildDesktopDownloadAssetFileName,
  desktopReleaseVariants,
} from "../../packages/shared/src/desktop-release";
import { resolveDesktopReleaseVersion } from "./desktop-version";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "../..");

function resolveDesktopDirectory() {
  const workingDirectory = process.env.PWD?.trim() || process.cwd();
  const candidateDirectories = [
    workingDirectory,
    resolve(workingDirectory, "apps/desktop"),
    resolve(repoRoot, "apps/desktop"),
  ];

  for (const candidateDirectory of candidateDirectories) {
    if (existsSync(resolve(candidateDirectory, "artifacts"))) {
      return candidateDirectory;
    }
  }

  return resolve(repoRoot, "apps/desktop");
}

const desktopDirectory = resolveDesktopDirectory();
const artifactsDirectory = resolve(desktopDirectory, "artifacts");
const releaseArtifactsDirectory = resolve(desktopDirectory, "release-artifacts");
const releaseVersion = resolveDesktopReleaseVersion();

rmSync(releaseArtifactsDirectory, { force: true, recursive: true });
mkdirSync(releaseArtifactsDirectory, { recursive: true });

for (const artifact of readdirSync(artifactsDirectory, { withFileTypes: true })) {
  if (!artifact.isFile()) {
    continue;
  }

  copyFileSync(
    resolve(artifactsDirectory, artifact.name),
    resolve(releaseArtifactsDirectory, artifact.name)
  );
}

for (const variant of desktopReleaseVariants) {
  const sourcePath = resolve(artifactsDirectory, variant.assetFileName);

  if (!existsSync(sourcePath)) {
    continue;
  }

  copyFileSync(
    sourcePath,
    resolve(
      releaseArtifactsDirectory,
      buildDesktopDownloadAssetFileName(variant.id, releaseVersion)
    )
  );
}
