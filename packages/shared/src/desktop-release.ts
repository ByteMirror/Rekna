const DESKTOP_RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const REKNA_RELEASE_TAG_PREFIX = "v";

export const REKNA_GITHUB_REPOSITORY = "ByteMirror/Rekna";
export const REKNA_GITHUB_REPOSITORY_URL = `https://github.com/${REKNA_GITHUB_REPOSITORY}`;
export const REKNA_GITHUB_RELEASES_URL = `https://github.com/${REKNA_GITHUB_REPOSITORY}/releases`;
export const REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL = `${REKNA_GITHUB_RELEASES_URL}/latest/download`;
export const REKNA_GITHUB_LATEST_RELEASE_API_URL = `https://api.github.com/repos/${REKNA_GITHUB_REPOSITORY}/releases/latest`;

export type DesktopDownloadFamily = "macos" | "unknown";
export type DesktopDownloadVariantId = "macos-arm64";
export type DesktopReleaseFamily = Exclude<DesktopDownloadFamily, "unknown">;
export type DesktopReleaseVariantId = DesktopDownloadVariantId;

export type DesktopReleaseAsset = {
  browser_download_url: string;
  name: string;
};

export type DesktopReleaseVariant = {
  assetFileName: string;
  family: DesktopReleaseFamily;
  id: DesktopReleaseVariantId;
  label: string;
  note: string;
};

export type DesktopDownloadVariant = DesktopReleaseVariant;

export const desktopReleaseVariants: DesktopReleaseVariant[] = [
  {
    assetFileName: "stable-macos-arm64-Rekna.dmg",
    family: "macos",
    id: "macos-arm64",
    label: "macOS (Apple Silicon)",
    note: "Recommended for current Macs.",
  },
];

export const desktopDownloadVariants: DesktopDownloadVariant[] =
  desktopReleaseVariants;

export function buildLatestReleaseAssetUrl(assetFileName: string) {
  return `${REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL}/${assetFileName}`;
}

export function buildDesktopDownloadAssetFileName(
  variantId: DesktopReleaseVariantId,
  version: string
) {
  if (!isDesktopReleaseVersion(version)) {
    throw new Error(`Invalid desktop release version: ${version}`);
  }

  return `Rekna-${version}-macOS-arm64.dmg`;
}

export function findDesktopDownloadAsset(
  variantId: DesktopReleaseVariantId,
  assets: DesktopReleaseAsset[]
) {
  const versionedAssetPattern = getVersionedDesktopReleaseAssetPattern(variantId);

  const versionedAsset = assets.find((asset) =>
    versionedAssetPattern.test(asset.name)
  );

  if (versionedAsset) {
    return versionedAsset;
  }

  const legacyAssetFileName = desktopReleaseVariants.find(
    (variant) => variant.id === variantId
  )?.assetFileName;

  return assets.find((asset) => asset.name === legacyAssetFileName);
}

export function resolveDesktopDownloadUrl(
  variantId: DesktopDownloadVariantId,
  assets?: DesktopReleaseAsset[]
) {
  const variant = desktopReleaseVariants.find(
    (desktopVariant) => desktopVariant.id === variantId
  );

  if (!variant) {
    throw new Error(`Unknown desktop download variant: ${variantId}`);
  }

  const releaseAsset =
    assets && assets.length > 0
      ? findDesktopDownloadAsset(variantId, assets)
      : undefined;

  return (
    releaseAsset?.browser_download_url ??
    buildLatestReleaseAssetUrl(variant.assetFileName)
  );
}

function getVersionedDesktopReleaseAssetPattern(
  variantId: DesktopReleaseVariantId
) {
  return /^Rekna-\d+\.\d+\.\d+-macOS-arm64\.dmg$/;
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
