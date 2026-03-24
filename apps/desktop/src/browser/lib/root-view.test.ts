import { describe, expect, test } from "bun:test";

describe("resolveRootView", () => {
  test("renders the marketing website in a plain browser", async () => {
    const { resolveRootView } = await import("./root-view");

    expect(
      resolveRootView({
        hash: "",
        hasElectrobunRuntime: false,
        search: "",
      })
    ).toBe("website");
  });

  test("renders the calculator app in the native desktop runtime", async () => {
    const { resolveRootView } = await import("./root-view");

    expect(
      resolveRootView({
        hash: "",
        hasElectrobunRuntime: true,
        search: "",
      })
    ).toBe("app");
  });

  test("renders the completion overlay when requested", async () => {
    const { resolveRootView } = await import("./root-view");

    expect(
      resolveRootView({
        hash: "",
        hasElectrobunRuntime: false,
        search: "?window=completion-overlay",
      })
    ).toBe("completion-overlay");
  });

  test("renders the completion overlay when requested via the hash fallback", async () => {
    const { resolveRootView } = await import("./root-view");

    expect(
      resolveRootView({
        hash: "#?window=completion-overlay",
        hasElectrobunRuntime: false,
        search: "",
      })
    ).toBe("completion-overlay");
  });

  test("renders the completion overlay when the desktop runtime boot context requests it", async () => {
    const { resolveRootView } = await import("./root-view");

    expect(
      resolveRootView({
        hash: "",
        hasElectrobunRuntime: true,
        search: "",
        windowContext: {
          mode: "completion-overlay",
          nativeCompletionOverlayEnabled: false,
        },
      })
    ).toBe("completion-overlay");
  });
});
