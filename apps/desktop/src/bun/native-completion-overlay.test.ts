import { describe, expect, test } from "bun:test";

import { shouldUseNativeCompletionOverlay } from "./native-completion-overlay";

describe("shouldUseNativeCompletionOverlay", () => {
  test("keeps completion overlays inside the main window on every desktop OS", () => {
    expect(shouldUseNativeCompletionOverlay("darwin")).toBe(false);
    expect(shouldUseNativeCompletionOverlay("win32")).toBe(false);
    expect(shouldUseNativeCompletionOverlay("linux")).toBe(false);
  });
});
