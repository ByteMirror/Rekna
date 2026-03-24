import { describe, expect, test } from "bun:test";

import { getLineaTheme } from "../../../../../packages/design-tokens/src/index";
import {
  createLineaHomeScreenStyleSpec,
  getAdaptiveLayoutMetrics,
  getLibraryAnimationSpec,
  getLineaHomeScreenCopySpec,
  getRubberBandOffset,
  projectResultRailRows,
  resolveLineaThemeName,
  shouldOpenLibraryFromPull,
  shouldEnableEditorScrolling,
} from "./linea-home-screen.presentation";

describe("createLineaHomeScreenStyleSpec", () => {
  test("keeps the editor surface flush with the workspace", () => {
    const theme = getLineaTheme("dark");
    const metrics = getAdaptiveLayoutMetrics({ fontScale: 1, width: 390 });
    const styles = createLineaHomeScreenStyleSpec(
      theme,
      theme.typography.monoFamilies.default,
      metrics
    );

    expect(styles.editorSurface.borderWidth).toBe(0);
    expect(styles.resultsSurface.borderLeftWidth).toBe(0);
  });

  test("keeps a unified page scroll while restoring a right-side results rail", () => {
    const theme = getLineaTheme("dark");
    const metrics = getAdaptiveLayoutMetrics({ fontScale: 1, width: 390 });
    const styles = createLineaHomeScreenStyleSpec(
      theme,
      theme.typography.monoFamilies.default,
      metrics
    );

    expect(styles.screenContent.flexDirection).toBe("column");
    expect(styles.workspace.flexDirection).toBe("row");
    expect(styles.resultsLabel.textAlign).toBe("right");
  });

  test("keeps the results rail line rhythm aligned with the editor", () => {
    const theme = getLineaTheme("dark");
    const metrics = getAdaptiveLayoutMetrics({ fontScale: 1, width: 390 });
    const styles = createLineaHomeScreenStyleSpec(
      theme,
      theme.typography.monoFamilies.default,
      metrics
    );

    expect(styles.resultsScrollContent.paddingTop).toBe(theme.spacing.sm);
    expect(styles.editorInput.lineHeight).toBe(28);
    expect(styles.resultRow.height).toBe(28);
    expect(styles.resultRow.justifyContent).toBe("center");
  });

  test("keeps the full desktop line rhythm on regular-width layouts", () => {
    const theme = getLineaTheme("dark");
    const metrics = getAdaptiveLayoutMetrics({ fontScale: 1, width: 1024 });
    const styles = createLineaHomeScreenStyleSpec(
      theme,
      theme.typography.monoFamilies.default,
      metrics
    );

    expect(styles.editorInput.lineHeight).toBe(theme.typography.editorLineHeight);
    expect(styles.resultRow.height).toBe(theme.typography.editorLineHeight);
  });

  test("uses accessible control sizes", () => {
    const theme = getLineaTheme("dark");
    const metrics = getAdaptiveLayoutMetrics({ fontScale: 1, width: 390 });
    const styles = createLineaHomeScreenStyleSpec(
      theme,
      theme.typography.monoFamilies.default,
      metrics
    );

    expect(styles.headerButton.width).toBeGreaterThanOrEqual(44);
    expect(styles.headerButton.height).toBeGreaterThanOrEqual(44);
    expect(styles.deleteButton.minHeight).toBeGreaterThanOrEqual(44);
  });
});

describe("resolveLineaThemeName", () => {
  test("follows the system scheme", () => {
    expect(resolveLineaThemeName("light")).toBe("light");
    expect(resolveLineaThemeName("dark")).toBe("dark");
  });

  test("falls back safely when no scheme is reported", () => {
    expect(resolveLineaThemeName(null)).toBe("dark");
  });
});

describe("getAdaptiveLayoutMetrics", () => {
  test("uses compact phone metrics on iPhone widths", () => {
    const metrics = getAdaptiveLayoutMetrics({ fontScale: 1, width: 390 });

    expect(metrics.headerButtonSize).toBe(44);
    expect(metrics.isRegularWidth).toBe(false);
    expect(metrics.resultsColumnWidth).toBeLessThanOrEqual(132);
  });

  test("widens the layout on regular-width devices", () => {
    const metrics = getAdaptiveLayoutMetrics({ fontScale: 1, width: 1024 });

    expect(metrics.isRegularWidth).toBe(true);
    expect(metrics.libraryPopoverWidth).toBeGreaterThan(520);
    expect(metrics.resultsColumnWidth).toBeGreaterThan(132);
  });
});

describe("getLibraryAnimationSpec", () => {
  test("reduces motion when the accessibility setting is enabled", () => {
    expect(getLibraryAnimationSpec(true)).toEqual({
      duration: 0,
      translateY: 0,
    });
  });
});

describe("getLineaHomeScreenCopySpec", () => {
  test("removes placeholder and editor chrome copy from the mobile screen", () => {
    expect(getLineaHomeScreenCopySpec()).toEqual({
      editorPlaceholder: "",
      resultsEmptyMessage: "",
      showResultsLabel: false,
      showSaveLabel: false,
      showEditorLabel: false,
      showEditorMeta: false,
    });
  });
});

describe("projectResultRailRows", () => {
  test("preserves the editor line structure in the mobile results rail", () => {
    expect(
      projectResultRailRows([
        { displayValue: "9", kind: "value" },
        { displayValue: null, kind: "empty" },
      ])
    ).toEqual([
      { displayValue: "9", hasValue: true, id: "0-value" },
      { displayValue: "", hasValue: false, id: "1-empty" },
    ]);
  });
});

describe("shouldEnableEditorScrolling", () => {
  test("stays off when the editor content still fits", () => {
    expect(
      shouldEnableEditorScrolling({
        contentHeight: 320,
        viewportHeight: 320,
      })
    ).toBe(false);
  });

  test("turns on once the editor content overflows", () => {
    expect(
      shouldEnableEditorScrolling({
        contentHeight: 321,
        viewportHeight: 320,
      })
    ).toBe(true);
  });
});

describe("shouldOpenLibraryFromPull", () => {
  test("opens when pulled down far enough at the top", () => {
    expect(
      shouldOpenLibraryFromPull({
        isLibraryOpen: false,
        pullDistance: 54,
        scrollOffsetY: 0,
      })
    ).toBe(true);
  });

  test("stays closed when the editor is not at the top yet", () => {
    expect(
      shouldOpenLibraryFromPull({
        isLibraryOpen: false,
        pullDistance: 80,
        scrollOffsetY: 24,
      })
    ).toBe(false);
  });

  test("stays closed below the pull threshold", () => {
    expect(
      shouldOpenLibraryFromPull({
        isLibraryOpen: false,
        pullDistance: 18,
        scrollOffsetY: 0,
      })
    ).toBe(false);
  });
});

describe("getRubberBandOffset", () => {
  test("returns zero when there is no downward pull", () => {
    expect(getRubberBandOffset(0)).toBe(0);
    expect(getRubberBandOffset(-12)).toBe(0);
  });

  test("dampens the pull so the screen moves less than the finger", () => {
    expect(getRubberBandOffset(60)).toBeLessThan(60);
    expect(getRubberBandOffset(60)).toBeGreaterThan(0);
  });

  test("caps very large pulls to a bounded bounce distance", () => {
    expect(getRubberBandOffset(500)).toBeLessThanOrEqual(72);
  });
});
