import { describe, expect, test } from "bun:test";

import {
  buildDesktopDownloadAssetFileName,
  buildDesktopReleaseTag,
  buildLatestReleaseAssetUrl,
  desktopDownloadVariants,
  findDesktopDownloadAsset,
  incrementDesktopReleaseVersion,
  parseDesktopReleaseTag,
  REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL,
  resolveDesktopDownloadUrl,
} from "./desktop-release";

describe("desktop release helpers", () => {
  test("builds latest-release asset urls for website download links", () => {
    expect(
      buildLatestReleaseAssetUrl("stable-macos-arm64-Rekna.dmg")
    ).toBe(
      `${REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL}/stable-macos-arm64-Rekna.dmg`
    );
  });

  test("only includes macOS in website download variants", () => {
    expect(desktopDownloadVariants.map((variant) => variant.id)).toEqual([
      "macos-arm64",
    ]);
  });

  test("builds concise versioned asset names for direct user downloads", () => {
    expect(buildDesktopDownloadAssetFileName("macos-arm64", "0.1.2")).toBe(
      "Rekna-0.1.2-macOS-arm64.dmg"
    );
  });

  test("prefers versioned release assets and falls back to legacy asset names", () => {
    expect(
      findDesktopDownloadAsset("macos-arm64", [
        {
          browser_download_url:
            "https://github.com/ByteMirror/Rekna/releases/download/v0.1.2/stable-macos-arm64-Rekna.dmg",
          name: "stable-macos-arm64-Rekna.dmg",
        },
        {
          browser_download_url:
            "https://github.com/ByteMirror/Rekna/releases/download/v0.1.2/Rekna-0.1.2-macOS-arm64.dmg",
          name: "Rekna-0.1.2-macOS-arm64.dmg",
        },
      ])?.browser_download_url
    ).toBe(
      "https://github.com/ByteMirror/Rekna/releases/download/v0.1.2/Rekna-0.1.2-macOS-arm64.dmg"
    );

    expect(
      findDesktopDownloadAsset("macos-arm64", [
        {
          browser_download_url:
            "https://github.com/ByteMirror/Rekna/releases/download/v0.1.2/stable-macos-arm64-Rekna.dmg",
          name: "stable-macos-arm64-Rekna.dmg",
        },
      ])?.browser_download_url
    ).toBe(
      "https://github.com/ByteMirror/Rekna/releases/download/v0.1.2/stable-macos-arm64-Rekna.dmg"
    );
  });

  test("resolves macOS download url from release assets", () => {
    expect(
      resolveDesktopDownloadUrl("macos-arm64", [
        {
          browser_download_url:
            "https://github.com/ByteMirror/Rekna/releases/download/v0.1.7/Rekna-0.1.7-macOS-arm64.dmg",
          name: "Rekna-0.1.7-macOS-arm64.dmg",
        },
      ])
    ).toBe(
      "https://github.com/ByteMirror/Rekna/releases/download/v0.1.7/Rekna-0.1.7-macOS-arm64.dmg"
    );
  });

  test("parses and increments desktop release versions from git tags", () => {
    expect(parseDesktopReleaseTag("v0.1.7")).toBe("0.1.7");
    expect(parseDesktopReleaseTag("release-0.1.7")).toBeNull();
    expect(buildDesktopReleaseTag("0.1.8")).toBe("v0.1.8");
    expect(incrementDesktopReleaseVersion("0.1.8")).toBe("0.1.9");
  });
});
