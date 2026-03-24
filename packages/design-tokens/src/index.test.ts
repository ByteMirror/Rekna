import { describe, expect, test } from "bun:test";

describe("Linea design tokens", () => {
  test("returns the desktop dark theme values", async () => {
    const { getLineaTheme } = await import("./index");

    const theme = getLineaTheme("dark");

    expect(theme.name).toBe("dark");
    expect(theme.colors.background).toBe("#232423");
    expect(theme.colors.foreground).toBe("#dddddd");
    expect(theme.colors.popover).toBe("#272927");
    expect(theme.colors.result).toBe("#00f5b5");
    expect(theme.typography.editorSize).toBe(18);
    expect(theme.typography.headerTitleSize).toBe(13);
  });

  test("returns the desktop light theme values", async () => {
    const { getLineaTheme } = await import("./index");

    const theme = getLineaTheme("light");

    expect(theme.name).toBe("light");
    expect(theme.colors.background).toBe("#f2ede5");
    expect(theme.colors.foreground).toBe("#312c25");
    expect(theme.colors.card).toBe("#f8f3eb");
    expect(theme.colors.border).toBe("#d3c8b8");
    expect(theme.typography.editorSize).toBe(18);
  });

  test("falls back to the dark theme when no explicit mode is provided", async () => {
    const { getLineaTheme } = await import("./index");

    const theme = getLineaTheme();

    expect(theme.name).toBe("dark");
    expect(theme.layout.windowHeaderHeight).toBe(48);
    expect(theme.radius.lg).toBe(8);
    expect(theme.typography.monoFamilies.ios).toBe("Menlo");
  });
});
