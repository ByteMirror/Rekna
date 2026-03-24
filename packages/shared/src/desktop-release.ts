const DESKTOP_RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const REKNA_RELEASE_TAG_PREFIX = "v";

export const REKNA_GITHUB_REPOSITORY = "ByteMirror/Rekna";
export const REKNA_GITHUB_REPOSITORY_URL = `https://github.com/${REKNA_GITHUB_REPOSITORY}`;
export const REKNA_GITHUB_RELEASES_URL = `https://github.com/${REKNA_GITHUB_REPOSITORY}/releases`;
export const REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL = `${REKNA_GITHUB_RELEASES_URL}/latest/download`;

export type DesktopDownloadFamily = "linux" | "macos" | "unknown";

export type DesktopDownloadVariant = {
  assetFileName: string;
  family: Exclude<DesktopDownloadFamily, "unknown">;
  id: "linux-x64" | "macos-arm64";
  label: string;
  note: string;
};

export const desktopDownloadVariants: DesktopDownloadVariant[] = [
  {
    assetFileName: "stable-macos-arm64-Rekna.dmg",
    family: "macos",
    id: "macos-arm64",
    label: "macOS (Apple Silicon)",
    note: "Recommended for current Macs.",
  },
  {
    assetFileName: "stable-linux-x64-Rekna-Setup.tar.gz",
    family: "linux",
    id: "linux-x64",
    label: "Linux (x64)",
    note: "For modern 64-bit Linux desktops.",
  },
];

export function buildLatestReleaseAssetUrl(assetFileName: string) {
  return `${REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL}/${assetFileName}`;
}

export function isDesktopReleaseVersion(value: string) {
  return DESKTOP_RELEASE_VERSION_PATTERN.test(value);
}

export function buildDesktopReleaseTag(version: string) {
  if (!isDesktopReleaseVersion(version)) {
    throw new Error(`Invalid desktop release version: ${version}`);
  }

  return `${REKNA_RELEASE_TAG_PREFIX}${version}`;
}

export function parseDesktopReleaseTag(tagName: string) {
  if (!tagName.startsWith(REKNA_RELEASE_TAG_PREFIX)) {
    return null;
  }

  const version = tagName.slice(REKNA_RELEASE_TAG_PREFIX.length);
  return isDesktopReleaseVersion(version) ? version : null;
}

export function incrementDesktopReleaseVersion(version: string) {
  if (!isDesktopReleaseVersion(version)) {
    throw new Error(`Invalid desktop release version: ${version}`);
  }

  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}
