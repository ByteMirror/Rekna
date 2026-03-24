export type LineaThemeName = "dark" | "light";

export type LineaTheme = {
  colors: {
    accent: string;
    background: string;
    border: string;
    card: string;
    caret: string;
    chromeIcon: string;
    editorSelection: string;
    foreground: string;
    input: string;
    mutedForeground: string;
    popover: string;
    primary: string;
    primaryForeground: string;
    result: string;
    resultMuted: string;
    ring: string;
  };
  layout: {
    libraryPanelWidth: number;
    maxContentWidth: number;
    resultsColumnWidth: number;
    windowHeaderHeight: number;
  };
  name: LineaThemeName;
  radius: {
    lg: number;
    pill: number;
    sm: number;
  };
  spacing: {
    lg: number;
    md: number;
    screenInset: number;
    sm: number;
    xl: number;
    xs: number;
  };
  typography: {
    bodySize: number;
    editorLineHeight: number;
    editorSize: number;
    headerTitleSize: number;
    monoFamilies: {
      android: string;
      default: string;
      ios: string;
      web: string;
    };
    resultSize: number;
    sheetTitleSize: number;
  };
};

const lineaThemes = {
  dark: {
    colors: {
      accent: "#8f958f",
      background: "#232423",
      border: "#3a3d3a",
      card: "#232423",
      caret: "#0068ab",
      chromeIcon: "rgba(221, 221, 221, 0.78)",
      editorSelection: "rgba(214, 220, 228, 0.24)",
      foreground: "#dddddd",
      input: "#3a3d3a",
      mutedForeground: "#a7aba7",
      popover: "#272927",
      primary: "#f1f1f1",
      primaryForeground: "#232423",
      result: "#00f5b5",
      resultMuted: "#6dd8bc",
      ring: "#8f958f",
    },
    layout: {
      libraryPanelWidth: 360,
      maxContentWidth: 1100,
      resultsColumnWidth: 136,
      windowHeaderHeight: 48,
    },
    name: "dark",
    radius: {
      lg: 8,
      pill: 999,
      sm: 6,
    },
    spacing: {
      lg: 16,
      md: 12,
      screenInset: 16,
      sm: 8,
      xl: 24,
      xs: 4,
    },
    typography: {
      bodySize: 14,
      editorLineHeight: 32,
      editorSize: 18,
      headerTitleSize: 13,
      monoFamilies: {
        android: "monospace",
        default: "Menlo",
        ios: "Menlo",
        web: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      },
      resultSize: 15,
      sheetTitleSize: 13,
    },
  },
  light: {
    colors: {
      accent: "#647689",
      background: "#f2ede5",
      border: "#d3c8b8",
      card: "#f8f3eb",
      caret: "#0c6fb6",
      chromeIcon: "rgba(49, 44, 37, 0.78)",
      editorSelection: "rgba(72, 82, 96, 0.2)",
      foreground: "#312c25",
      input: "#d3c8b8",
      mutedForeground: "#73695d",
      popover: "#fcf7ef",
      primary: "#2f2a23",
      primaryForeground: "#f5efe6",
      result: "#007b65",
      resultMuted: "#278c75",
      ring: "#647689",
    },
    layout: {
      libraryPanelWidth: 360,
      maxContentWidth: 1100,
      resultsColumnWidth: 136,
      windowHeaderHeight: 48,
    },
    name: "light",
    radius: {
      lg: 8,
      pill: 999,
      sm: 6,
    },
    spacing: {
      lg: 16,
      md: 12,
      screenInset: 16,
      sm: 8,
      xl: 24,
      xs: 4,
    },
    typography: {
      bodySize: 14,
      editorLineHeight: 32,
      editorSize: 18,
      headerTitleSize: 13,
      monoFamilies: {
        android: "monospace",
        default: "Menlo",
        ios: "Menlo",
        web: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      },
      resultSize: 15,
      sheetTitleSize: 13,
    },
  },
} satisfies Record<LineaThemeName, LineaTheme>;

export function getLineaTheme(mode: LineaThemeName = "dark") {
  return lineaThemes[mode];
}

export { lineaThemes };
