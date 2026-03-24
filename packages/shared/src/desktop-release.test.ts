import { describe, expect, test } from "bun:test";

import {
  buildDesktopReleaseTag,
  buildLatestReleaseAssetUrl,
  incrementDesktopReleaseVersion,
  parseDesktopReleaseTag,
  REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL,
} from "./desktop-release";

describe("desktop release helpers", () => {
  test("builds latest-release asset urls for website download links", () => {
    expect(
      buildLatestReleaseAssetUrl("stable-macos-arm64-Rekna.dmg")
    ).toBe(
      `${REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL}/stable-macos-arm64-Rekna.dmg`
    );
    expect(
      buildLatestReleaseAssetUrl("stable-linux-x64-Rekna-Setup.tar.gz")
    ).toBe(
      `${REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL}/stable-linux-x64-Rekna-Setup.tar.gz`
    );
  });

  test("parses and increments desktop release versions from git tags", () => {
    expect(parseDesktopReleaseTag("v0.1.7")).toBe("0.1.7");
    expect(parseDesktopReleaseTag("release-0.1.7")).toBeNull();
    expect(buildDesktopReleaseTag("0.1.8")).toBe("v0.1.8");
    expect(incrementDesktopReleaseVersion("0.1.8")).toBe("0.1.9");
  });
});
