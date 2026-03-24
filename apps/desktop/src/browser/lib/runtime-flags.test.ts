import { describe, expect, test } from "bun:test";

import {
  buildRuntimeFlagSuffix,
  isCompletionOverlayWindow,
  isNativeCompletionOverlayEnabled,
} from "./runtime-flags";

describe("runtime overlay flags", () => {
  test("detects the completion overlay window from the query string", () => {
    expect(isCompletionOverlayWindow("?window=completion-overlay")).toBe(true);
    expect(isCompletionOverlayWindow("?window=main")).toBe(false);
  });

  test("detects runtime flags from the hash when bundled views cannot use query parameters", () => {
    expect(isCompletionOverlayWindow("", "#?window=completion-overlay")).toBe(
      true
    );
    expect(
      isNativeCompletionOverlayEnabled("", "#?native-completion-overlay=0")
    ).toBe(false);
  });

  test("disables the native completion overlay when requested by the query string", () => {
    expect(isNativeCompletionOverlayEnabled("")).toBe(true);
    expect(
      isNativeCompletionOverlayEnabled("?native-completion-overlay=0")
    ).toBe(false);
  });

  test("serializes bundled runtime flags into a hash suffix", () => {
    expect(
      buildRuntimeFlagSuffix({
        mode: "completion-overlay",
        nativeCompletionOverlayEnabled: false,
        transport: "hash",
      })
    ).toBe("#?window=completion-overlay&native-completion-overlay=0");
  });
});
