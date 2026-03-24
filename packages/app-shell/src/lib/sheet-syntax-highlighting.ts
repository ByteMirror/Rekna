import { RangeSetBuilder } from "@codemirror/state";
import {
  BUILTIN_FUNCTION_NAMES,
  CURRENCY_NAME_ALIASES,
  KNOWN_CURRENCY_SYMBOLS,
  OPERATOR_ALIAS_WORDS,
  UNIT_NAME_ALIASES,
  WORD_OPERATOR_ALIASES,
  CONVERSION_ALIAS_WORDS,
} from "@linea/calc-engine";

import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { collectSheetVariables } from "./sheet-autocomplete";

const SHEET_KEYWORDS = new Set([
  "avg",
  "average",
  "export",
  "import",
  "prev",
  "sum",
  "total",
]);
const DECIMAL_NUMBER_PATTERN = /^\$?-?\d+(?:\.\d+)?%?$/;
const TOKEN_PATTERN =
  /\$-?\d+(?:\.\d+)?|-?\d+(?:\.\d+)?%?|[€£¥₽$]|\b[A-Za-z_]\w*(?:[./][A-Za-z_]\w*)*\b|<<|>>|[+\-*/^&|=]|\b\d+:\d+\b|°/g;
const MULTI_WORD_OPERATOR_ALIAS_PHRASES = getMultiWordPhrases(
  WORD_OPERATOR_ALIASES.keys()
);
const MULTI_WORD_UNIT_ALIAS_PHRASES = getMultiWordPhrases([
  ...UNIT_NAME_ALIASES.keys(),
  ...CURRENCY_NAME_ALIASES.keys(),
]);

const DECORATIONS = {
  comment: Decoration.mark({ class: "linea-token-comment" }),
  function: Decoration.mark({ class: "linea-token-function" }),
  heading: Decoration.mark({ class: "linea-token-heading" }),
  keyword: Decoration.mark({ class: "linea-token-keyword" }),
  label: Decoration.mark({ class: "linea-token-label" }),
  number: Decoration.mark({ class: "linea-token-number" }),
  object: Decoration.mark({ class: "linea-token-object" }),
  operator: Decoration.mark({ class: "linea-token-operator" }),
  unit: Decoration.mark({ class: "linea-token-unit" }),
  variable: Decoration.mark({ class: "linea-token-variable" }),
} satisfies Record<SheetSyntaxKind, Decoration>;

export type SheetSyntaxKind =
  | "comment"
  | "function"
  | "heading"
  | "keyword"
  | "label"
  | "number"
  | "object"
  | "operator"
  | "unit"
  | "variable";

export type SheetSyntaxToken = {
  from: number;
  kind: SheetSyntaxKind;
  to: number;
};

export function tokenizeSheetLine(
  line: string,
  variables: ReadonlySet<string>
): SheetSyntaxToken[] {
  const tokens: SheetSyntaxToken[] = [];
  const trimmed = line.trim();

  if (trimmed.startsWith("//")) {
    const commentStart = line.indexOf("//");
    return [
      {
        from: commentStart >= 0 ? commentStart : 0,
        kind: "comment",
        to: line.length,
      },
    ];
  }

  if (trimmed.startsWith("#")) {
    const headingStart = line.indexOf("#");
    return [
      {
        from: headingStart >= 0 ? headingStart : 0,
        kind: "heading",
        to: line.length,
      },
    ];
  }

  let contentStart = 0;
  const labelMatch = line.match(/^(\s*[^:]+:)(\s+.+)?$/);
  if (labelMatch?.[1] && labelMatch[2]) {
    tokens.push({
      from: 0,
      kind: "label",
      to: labelMatch[1].length,
    });
    contentStart = labelMatch[1].length;
  }

  const assignmentMatch = line
    .slice(contentStart)
    .match(/^(\s*)([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(\s*)(=)/);
  if (assignmentMatch?.[2] && assignmentMatch[4]) {
    const base = contentStart + (assignmentMatch[1]?.length ?? 0);
    const variableStart = base;
    const variableEnd = variableStart + assignmentMatch[2].length;
    const operatorStart = variableEnd + (assignmentMatch[3]?.length ?? 0);

    addPathTokens(tokens, assignmentMatch[2], variableStart, variableEnd);
    tokens.push({
      from: operatorStart,
      kind: "operator",
      to: operatorStart + assignmentMatch[4].length,
    });
  }

  const blockMatch = line
    .slice(contentStart)
    .match(/^(\s*)([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(\s*)\{/);
  if (blockMatch?.[2]) {
    const base = contentStart + (blockMatch[1]?.length ?? 0);
    const objectStart = base;
    const objectEnd = objectStart + blockMatch[2].length;

    tokens.push({
      from: objectStart,
      kind: "object",
      to: objectEnd,
    });
  }

  const directiveMatch = line
    .slice(contentStart)
    .match(/^(\s*)(Import|Export)(\s+)([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)$/i);
  if (directiveMatch?.[2] && directiveMatch[4]) {
    const base = contentStart + (directiveMatch[1]?.length ?? 0);
    const keywordStart = base;
    const keywordEnd = keywordStart + directiveMatch[2].length;
    const symbolStart = keywordEnd + (directiveMatch[3]?.length ?? 0);

    tokens.push({
      from: keywordStart,
      kind: "keyword",
      to: keywordEnd,
    });
    addDirectiveSymbolTokens(tokens, directiveMatch[4], symbolStart, variables);

    return tokens.sort((left, right) => left.from - right.from);
  }

  addReversePercentagePhraseToken(tokens, line);
  addMultiWordAliasTokens(tokens, line, MULTI_WORD_OPERATOR_ALIAS_PHRASES, "operator");
  addMultiWordAliasTokens(tokens, line, MULTI_WORD_UNIT_ALIAS_PHRASES, "unit");

  let previousMeaningfulKind: SheetSyntaxKind | null = null;
  let previousMeaningfulText = "";

  for (const match of line.matchAll(TOKEN_PATTERN)) {
    const text = match[0];
    const from = match.index ?? 0;
    const to = from + text.length;

    if (tokenOverlapsExisting(tokens, from, to)) {
      continue;
    }

    if (text.includes(".") && !DECIMAL_NUMBER_PATTERN.test(text)) {
      addPathTokens(tokens, text, from, to);
      previousMeaningfulKind = "variable";
      previousMeaningfulText = text;
      continue;
    }

    const kind = classifyToken(
      text,
      variables,
      previousMeaningfulKind,
      previousMeaningfulText
    );

    if (!kind) {
      continue;
    }

    tokens.push({ from, kind, to });
    previousMeaningfulKind = kind;
    previousMeaningfulText = text;
  }

  return tokens.sort((left, right) => left.from - right.from);
}

export function sheetSyntaxHighlighting() {
  const syntaxPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    {
      decorations: (value) => value.decorations,
    }
  );

  return syntaxPlugin;
}

function buildDecorations(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>();
  const linesSeen = new Set<number>();
  const variables = new Set(collectSheetVariables(view.state.doc.toString()));

  for (const range of view.visibleRanges) {
    let line = view.state.doc.lineAt(range.from);

    while (true) {
      if (!linesSeen.has(line.number)) {
        linesSeen.add(line.number);

        for (const token of tokenizeSheetLine(line.text, variables)) {
          builder.add(
            line.from + token.from,
            line.from + token.to,
            DECORATIONS[token.kind]
          );
        }
      }

      if (line.to >= range.to) {
        break;
      }

      line = view.state.doc.line(line.number + 1);
    }
  }

  return builder.finish();
}

function classifyToken(
  text: string,
  variables: ReadonlySet<string>,
  previousKind: SheetSyntaxKind | null,
  previousText: string
): SheetSyntaxKind | null {
  const lower = text.toLowerCase();

  if (
    text.startsWith("$") ||
    /^-?\d+(?:\.\d+)?%?$/.test(text) ||
    /^\d+:\d+$/.test(text) ||
    text === "°"
  ) {
    return "number";
  }

  if (/^(?:<<|>>|[+\-*/^&|=])$/.test(text) || OPERATOR_ALIAS_WORDS.has(lower)) {
    return "operator";
  }

  if (BUILTIN_FUNCTION_NAMES.has(lower) && !SHEET_KEYWORDS.has(lower)) {
    return "function";
  }

  if (SHEET_KEYWORDS.has(lower) || CONVERSION_ALIAS_WORDS.has(lower)) {
    return "keyword";
  }

  if (variables.has(text) || variables.has(lower)) {
    return "variable";
  }

  if (
    KNOWN_CURRENCY_SYMBOLS.has(text) ||
    CURRENCY_NAME_ALIASES.has(lower) ||
    /^[A-Z]{2,4}$/.test(text) ||
    previousKind === "number" ||
    (previousKind === "keyword" &&
      CONVERSION_ALIAS_WORDS.has(previousText.toLowerCase()))
  ) {
    return "unit";
  }

  return null;
}

function tokenOverlapsExisting(
  tokens: SheetSyntaxToken[],
  from: number,
  to: number
) {
  return tokens.some((token) => from < token.to && to > token.from);
}

function addPathTokens(
  tokens: SheetSyntaxToken[],
  text: string,
  from: number,
  to: number
) {
  const dotIndex = text.indexOf(".");

  if (dotIndex <= 0) {
    tokens.push({
      from,
      kind: "variable",
      to,
    });
    return;
  }

  tokens.push({
    from,
    kind: "object",
    to: from + dotIndex,
  });
  tokens.push({
    from: from + dotIndex + 1,
    kind: "variable",
    to,
  });
}

function addDirectiveSymbolTokens(
  tokens: SheetSyntaxToken[],
  text: string,
  from: number,
  variables: ReadonlySet<string>
) {
  if (text.includes(".")) {
    addPathTokens(tokens, text, from, from + text.length);
    return;
  }

  const kind = hasNestedPath(variables, text) ? "object" : "variable";
  tokens.push({
    from,
    kind,
    to: from + text.length,
  });
}

function addReversePercentagePhraseToken(
  tokens: SheetSyntaxToken[],
  line: string
) {
  const match = /-?\d+(?:\.\d+)?%\s+(of\s+what\s+is)\s+/di.exec(line);
  const phraseIndices = match?.indices?.[1];

  if (!phraseIndices) {
    return;
  }

  tokens.push({
    from: phraseIndices[0],
    kind: "keyword",
    to: phraseIndices[1],
  });
}

function addMultiWordAliasTokens(
  tokens: SheetSyntaxToken[],
  line: string,
  phrases: readonly string[],
  kind: Extract<SheetSyntaxKind, "operator" | "unit">
) {
  for (const phrase of phrases) {
    const pattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "gi");

    for (const match of line.matchAll(pattern)) {
      const from = match.index ?? -1;

      if (from < 0) {
        continue;
      }

      const to = from + phrase.length;

      if (tokenOverlapsExisting(tokens, from, to)) {
        continue;
      }

      tokens.push({
        from,
        kind,
        to,
      });
    }
  }
}

function getMultiWordPhrases(phrases: Iterable<string>) {
  return [...new Set([...phrases].filter((phrase) => /\s/.test(phrase)))]
    .sort((left, right) => right.length - left.length);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasNestedPath(variables: ReadonlySet<string>, prefix: string) {
  for (const variable of variables) {
    if (variable.startsWith(`${prefix}.`)) {
      return true;
    }
  }

  return false;
}
