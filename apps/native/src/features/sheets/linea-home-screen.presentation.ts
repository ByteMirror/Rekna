import type {
  LineaTheme,
  LineaThemeName,
} from "../../../../../packages/design-tokens/src/index";

const PULL_TO_OPEN_THRESHOLD = 44;
const MAX_RUBBER_BAND_OFFSET = 72;

export type AdaptiveLayoutMetrics = {
  contentInset: number;
  headerButtonSize: number;
  headerEdgeWidth: number;
  headerHeight: number;
  isRegularWidth: boolean;
  libraryPopoverWidth: number;
  resultRailTopPadding: number;
  resultsColumnWidth: number;
  workspaceGap: number;
};

export function resolveLineaThemeName(
  scheme: "dark" | "light" | "unspecified" | null | undefined
): LineaThemeName {
  if (scheme === "light") {
    return "light";
  }

  return "dark";
}

export function getAdaptiveLayoutMetrics({
  fontScale,
  width,
}: {
  fontScale: number;
  width: number;
}): AdaptiveLayoutMetrics {
  const isRegularWidth = width >= 768;
  const isLargeText = fontScale >= 1.2;

  return {
    contentInset: isRegularWidth ? 24 : 16,
    headerButtonSize: 44,
    headerEdgeWidth: isRegularWidth ? 120 : 96,
    headerHeight: isLargeText ? 56 : 52,
    isRegularWidth,
    libraryPopoverWidth: isRegularWidth
      ? Math.min(640, width - 64)
      : Math.min(520, width - 16),
    resultRailTopPadding: isRegularWidth ? 6 : 4,
    resultsColumnWidth: isRegularWidth
      ? Math.min(196, Math.max(148, Math.floor(width * 0.2)))
      : Math.min(132, Math.max(96, Math.floor(width * 0.28))),
    workspaceGap: isRegularWidth ? 20 : 12,
  };
}

export function getLibraryAnimationSpec(reduceMotionEnabled: boolean) {
  if (reduceMotionEnabled) {
    return {
      duration: 0,
      translateY: 0,
    } as const;
  }

  return {
    duration: 180,
    translateY: -24,
  } as const;
}

export function shouldEnableEditorScrolling({
  contentHeight,
  viewportHeight,
}: {
  contentHeight: number;
  viewportHeight: number;
}) {
  if (contentHeight <= 0 || viewportHeight <= 0) {
    return false;
  }

  return contentHeight > viewportHeight;
}

export function shouldOpenLibraryFromPull({
  isLibraryOpen,
  pullDistance,
  scrollOffsetY,
}: {
  isLibraryOpen: boolean;
  pullDistance: number;
  scrollOffsetY: number;
}) {
  if (isLibraryOpen) {
    return false;
  }

  if (scrollOffsetY > 0) {
    return false;
  }

  return pullDistance >= PULL_TO_OPEN_THRESHOLD;
}

export function getRubberBandOffset(pullDistance: number) {
  if (pullDistance <= 0) {
    return 0;
  }

  const dampedOffset = (pullDistance * 0.58) / (1 + pullDistance / 180);

  return Math.min(MAX_RUBBER_BAND_OFFSET, dampedOffset);
}

export function getLineaHomeScreenCopySpec() {
  return {
    editorPlaceholder: "",
    resultsEmptyMessage: "",
    showResultsLabel: false,
    showSaveLabel: false,
    showEditorLabel: false,
    showEditorMeta: false,
  } as const;
}

export function projectResultRailRows(
  lines: {
    displayValue: string | null;
    kind: string;
  }[]
) {
  return lines.map((line, index) => ({
    displayValue: line.displayValue ?? "",
    hasValue: line.displayValue !== null,
    id: `${index}-${line.kind}`,
  }));
}

export function createLineaHomeScreenStyleSpec(
  theme: LineaTheme,
  monoFont: string,
  metrics: AdaptiveLayoutMetrics
) {
  const editorLineHeight = metrics.isRegularWidth
    ? theme.typography.editorLineHeight
    : 28;
  const isDark = theme.name === "dark";
  const controlFill = isDark
    ? "rgba(255, 255, 255, 0.05)"
    : "rgba(49, 44, 37, 0.06)";
  const modalScrim = isDark
    ? "rgba(5, 6, 8, 0.36)"
    : "rgba(49, 44, 37, 0.14)";
  const rowDivider = isDark
    ? "rgba(255, 255, 255, 0.06)"
    : "rgba(49, 44, 37, 0.10)";
  const selectedCardFill = isDark
    ? "rgba(255, 255, 255, 0.045)"
    : "rgba(49, 44, 37, 0.06)";

  return {
    deleteButton: {
      alignItems: "center",
      backgroundColor: controlFill,
      borderRadius: theme.radius.pill,
      justifyContent: "center",
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: 14,
    },
    deleteButtonLabel: {
      color: theme.colors.mutedForeground,
      fontFamily: monoFont,
      fontSize: 11,
    },
    editorInput: {
      color: theme.colors.foreground,
      flex: 1,
      fontFamily: monoFont,
      fontSize: theme.typography.editorSize,
      lineHeight: editorLineHeight,
      minHeight: 320,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: metrics.contentInset,
      paddingTop: theme.spacing.sm,
    },
    editorIntro: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.screenInset,
      paddingTop: theme.spacing.sm,
    },
    editorLabel: {
      color: theme.colors.mutedForeground,
      fontFamily: monoFont,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    editorMeta: {
      color: theme.colors.mutedForeground,
      fontFamily: monoFont,
      fontSize: 11,
    },
    editorSurface: {
      backgroundColor: theme.colors.background,
      borderWidth: 0,
      flex: 1,
      minWidth: 0,
      overflow: "visible",
    },
    errorBody: {
      color: theme.colors.mutedForeground,
      fontFamily: monoFont,
      fontSize: theme.typography.bodySize,
      lineHeight: 22,
      maxWidth: 320,
      textAlign: "center",
    },
    errorTitle: {
      color: theme.colors.foreground,
      fontFamily: monoFont,
      fontSize: 16,
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      minHeight: metrics.headerHeight,
      justifyContent: "space-between",
      paddingHorizontal: metrics.contentInset,
    },
    headerActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: theme.spacing.sm,
      justifyContent: "flex-end",
      width: metrics.headerEdgeWidth,
    },
    headerButton: {
      alignItems: "center",
      borderRadius: theme.radius.pill,
      height: metrics.headerButtonSize,
      justifyContent: "center",
      width: metrics.headerButtonSize,
    },
    headerButtonLabel: {
      color: theme.colors.chromeIcon,
      fontFamily: monoFont,
      fontSize: 20,
      lineHeight: 18,
    },
    headerSide: {
      justifyContent: "center",
      width: metrics.headerEdgeWidth,
    },
    headerTitleInput: {
      color: theme.colors.foreground,
      fontFamily: monoFont,
      fontSize: theme.typography.headerTitleSize,
      minHeight: metrics.headerButtonSize,
      opacity: 0.88,
      paddingHorizontal: theme.spacing.sm,
      textAlign: "center",
    },
    headerTitleWrap: {
      flex: 1,
      justifyContent: "center",
    },
    libraryList: {
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.xl,
    },
    loadingBody: {
      color: theme.colors.mutedForeground,
      fontFamily: monoFont,
      fontSize: theme.typography.bodySize,
    },
    loadingScreen: {
      alignItems: "center",
      backgroundColor: theme.colors.background,
      flex: 1,
      gap: theme.spacing.md,
      justifyContent: "center",
    },
    loadingTitle: {
      color: theme.colors.foreground,
      fontFamily: monoFont,
      fontSize: 16,
    },
    modalBackdrop: {
      alignItems: "center",
      backgroundColor: modalScrim,
      flex: 1,
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
    },
    modalCard: {
      alignSelf: "center",
      backgroundColor: theme.colors.popover,
      borderColor: theme.colors.border,
      borderRadius: 28,
      borderWidth: 1,
      gap: theme.spacing.md,
      maxHeight: "72%",
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
      shadowColor: "#000000",
      shadowOffset: { height: 16, width: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 32,
    },
    modalDismissArea: {
      flex: 1,
    },
    modalHandle: {
      alignSelf: "center",
      backgroundColor: theme.colors.border,
      borderRadius: theme.radius.pill,
      height: 5,
      marginBottom: theme.spacing.xs,
      width: 44,
    },
    modalHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.xs,
    },
    modalTitle: {
      color: theme.colors.foreground,
      fontFamily: monoFont,
      fontSize: 15,
    },
    resultExpression: {
      color: theme.colors.resultMuted,
      fontFamily: monoFont,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "right",
    },
    resultRow: {
      alignItems: "flex-end",
      height: editorLineHeight,
      justifyContent: "center",
    },
    resultsEmpty: {
      color: theme.colors.mutedForeground,
      fontFamily: monoFont,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "right",
    },
    resultsLabel: {
      color: theme.colors.mutedForeground,
      fontFamily: monoFont,
      fontSize: 11,
      letterSpacing: 1,
      paddingBottom: theme.spacing.sm,
      textAlign: "right",
      textTransform: "uppercase",
    },
    resultsScrollContent: {
      paddingBottom: theme.spacing.xl,
      paddingTop: theme.spacing.sm,
    },
    resultsSurface: {
      alignSelf: "stretch",
      borderLeftColor: "transparent",
      borderLeftWidth: 0,
      paddingTop: 0,
    },
    resultValue: {
      color: theme.colors.result,
      fontFamily: monoFont,
      fontSize: theme.typography.resultSize,
      textAlign: "right",
    },
    root: {
      backgroundColor: theme.colors.background,
      flex: 1,
    },
    screenContent: {
      flexDirection: "column",
      paddingBottom: theme.spacing.md,
    },
    saveLabel: {
      color: theme.colors.mutedForeground,
      fontFamily: monoFont,
      fontSize: 11,
      textTransform: "uppercase",
    },
    searchInput: {
      backgroundColor: controlFill,
      borderColor: rowDivider,
      borderRadius: 18,
      borderWidth: 1,
      color: theme.colors.foreground,
      fontFamily: monoFont,
      fontSize: 14,
      minHeight: 48,
      paddingHorizontal: theme.spacing.md,
    },
    sheetCard: {
      alignItems: "center",
      backgroundColor: "transparent",
      borderBottomColor: theme.colors.border,
      borderBottomWidth: 1,
      borderRadius: 18,
      flexDirection: "row",
      gap: theme.spacing.md,
      justifyContent: "space-between",
      minHeight: 64,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    sheetCardActive: {
      backgroundColor: selectedCardFill,
      borderBottomWidth: 0,
    },
    sheetCardCopy: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    sheetCardMainAction: {
      flex: 1,
    },
    sheetCardSnippet: {
      color: theme.colors.mutedForeground,
      fontFamily: monoFont,
      fontSize: 13,
      lineHeight: 18,
    },
    sheetCardTitle: {
      color: theme.colors.foreground,
      fontFamily: monoFont,
      fontSize: 17,
    },
    workspace: {
      alignItems: "stretch",
      flexDirection: "row",
      gap: metrics.workspaceGap,
      paddingHorizontal: metrics.contentInset,
      paddingTop: theme.spacing.sm,
    },
    pullZone: {
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      height: 52,
      zIndex: 2,
    },
  } as const;
}
