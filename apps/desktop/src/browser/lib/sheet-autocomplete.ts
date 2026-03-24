import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { startCompletion } from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";
import {
  CONVERSION_OPERATOR_ALIASES,
  CURRENCY_NAME_ALIASES,
  CURRENCY_SYMBOL_ALIASES,
  MULTI_WORD_UNIT_ALIAS_PHRASES,
  WORD_OPERATOR_ALIASES,
} from "@linea/calc-engine";
import {
  fuzzySearchStrings,
  isSheetTagPrefix,
  normalizeSheetTags,
} from "@linea/shared";

import type {
  LineaCompletion,
  LineaCompletionInfo,
} from "./completion-overlay";

const BUILTIN_COMPLETIONS: LineaCompletion[] = [
  createFunctionCompletion(
    "sum",
    "Block total",
    "Returns the total of the consecutive evaluated rows directly above this line."
  ),
  createFunctionCompletion(
    "avg",
    "Block average",
    "Returns the average of the consecutive evaluated rows directly above this line."
  ),
  createFunctionCompletion(
    "prev",
    "Previous value",
    "References the most recent evaluated value in the current block."
  ),
  createFunctionCompletion(
    "sqrt",
    "Square root",
    "Supports shorthand syntax like `sqrt 16` as well as `sqrt(16)`."
  ),
  createFunctionCompletion(
    "round",
    "Round value",
    "Rounds numeric values and converted unit values such as `round(1 month in days)`."
  ),
  createFunctionCompletion(
    "fact",
    "Factorial",
    "Alias for factorial. Supports shorthand syntax like `fact 5`."
  ),
  createFunctionCompletion(
    "log",
    "Logarithm",
    "Supports `log(value)` and base-first syntax like `log 2 (10)`."
  ),
  createFunctionCompletion(
    "root",
    "N-th root",
    "Supports shorthand root syntax like `root 2 (8)`."
  ),
  createFunctionCompletion(
    "fromunix",
    "Unix timestamp",
    "Formats a Unix timestamp as a date and time in your local time zone."
  ),
  createFunctionCompletion(
    "time",
    "Current time",
    "Shows the current time locally or in a named time zone, for example `Berlin time`."
  ),
  createFunctionCompletion(
    "now",
    "Current time",
    "Returns the current local time and can be combined with named time zones."
  ),
];

const SHARED_ALIAS_COMPLETIONS: LineaCompletion[] = [
  ...createOperatorAliasCompletions(),
  ...createCurrencyAliasCompletions(),
  ...createUnitAliasCompletions(),
];

type SheetSymbolKind = "object" | "property" | "variable";

export type SheetSymbol = {
  kind: SheetSymbolKind;
  label: string;
};

type SheetCompletionSourceOptions = {
  externalSymbols?: SheetSymbol[];
  importableSymbols?: SheetSymbol[];
  workspaceTags?: string[];
};

export function sheetCompletionSource(
  context: CompletionContext,
  sourceOptions: SheetCompletionSourceOptions = {}
) {
  const line = context.state.doc.lineAt(context.pos);
  const tagToken = context.matchBefore(/#[A-Za-z0-9_-]*/);

  if (
    tagToken &&
    isSheetTagPrefix(tagToken.text) &&
    isTagCompletionContext(line.text, tagToken.from - line.from)
  ) {
    const visibleTags = fuzzySearchStrings(
      normalizeSheetTags(sourceOptions.workspaceTags),
      tagToken.text.slice(1)
    );

    if (visibleTags.length === 0) {
      return null;
    }

    return {
      from: tagToken.from,
      options: visibleTags.map(createTagCompletion),
      validFor: /^#[A-Za-z0-9_-]*$/,
    } satisfies CompletionResult;
  }

  if (isAutocompleteDisabledContext(line.text)) {
    return null;
  }

  const token = context.matchBefore(/[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\.?/);

  if (!context.explicit && (!token || token.from === token.to)) {
    return null;
  }

  const from = token?.from ?? context.pos;
  const to = token?.to ?? context.pos;
  const doc = context.state.doc.toString();
  const linePrefix = line.text.slice(0, context.pos - line.from).trimStart();
  const isImportDirective = /^(?:Import)\s+/i.test(linePrefix);
  const insertsObjectPath = !/^(?:Import|Export)\s+/i.test(linePrefix);
  const seen = new Set<string>();
  const completions: Completion[] = [];
  const availableExternalSymbols = isImportDirective
    ? (sourceOptions.importableSymbols ?? [])
    : (sourceOptions.externalSymbols ?? []);

  for (const symbol of [
    ...collectSheetSymbols(doc, from),
    ...availableExternalSymbols,
  ]) {
    if (seen.has(symbol.label)) {
      continue;
    }

    seen.add(symbol.label);
    completions.push(createSymbolCompletion(symbol, insertsObjectPath));
  }

  for (const completion of BUILTIN_COMPLETIONS) {
    if (seen.has(completion.label)) {
      continue;
    }

    seen.add(completion.label);
    completions.push(completion);
  }

  for (const completion of SHARED_ALIAS_COMPLETIONS) {
    if (seen.has(completion.label)) {
      continue;
    }

    seen.add(completion.label);
    completions.push(completion);
  }

  if (completions.length === 0) {
    return null;
  }

  return {
    from,
    options: completions,
    validFor: /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\.?$/,
  } satisfies CompletionResult;
}

export function collectSheetVariables(input: string, cursorPos = input.length) {
  return collectSheetSymbols(input, cursorPos).map((symbol) => symbol.label);
}

function collectSheetSymbols(input: string, cursorPos = input.length) {
  const visibleInput = input.slice(0, cursorPos);
  const discoveredSymbols = new Map<string, SheetSymbolKind>();
  const blockStack: string[] = [];

  for (const line of visibleInput.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (/^},?$/.test(trimmed)) {
      blockStack.pop();
      continue;
    }

    if (trimmed === "" || trimmed.startsWith("//") || trimmed.startsWith("#")) {
      continue;
    }

    const blockMatch = trimmed.match(
      /^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*\{$/
    );

    if (blockMatch?.[1]) {
      const blockPath = qualifyVariablePath(blockMatch[1], blockStack);
      addSymbolPrefixes(discoveredSymbols, blockPath, "object");
      blockStack.push(blockPath);
      continue;
    }

    const directiveMatch = trimmed.match(
      /^(?:Import|Export)\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*(?:\s*,\s*[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)*)$/i
    );

    if (directiveMatch?.[1]) {
      for (const symbol of directiveMatch[1].split(/\s*,\s*/)) {
        addSymbolPrefixes(discoveredSymbols, symbol);
      }
      continue;
    }

    const objectAssignmentMatch = line.match(
      /^\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*=\s*\{/
    );

    if (objectAssignmentMatch?.[1]) {
      addSymbolPrefixes(discoveredSymbols, objectAssignmentMatch[1], "object");
      continue;
    }

    const assignmentMatch = line.match(
      /^\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*=/
    );
    const variableName = assignmentMatch?.[1];

    if (!variableName) {
      continue;
    }

    addSymbolPrefixes(
      discoveredSymbols,
      qualifyVariablePath(variableName, blockStack)
    );
  }

  return [...discoveredSymbols.entries()]
    .map(([label, kind]) => ({ kind, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function addSymbolPrefixes(
  discoveredSymbols: Map<string, SheetSymbolKind>,
  variableName: string,
  explicitKind?: SheetSymbolKind
) {
  const segments = variableName.split(".");

  for (let index = 1; index <= segments.length; index += 1) {
    const label = segments.slice(0, index).join(".");
    const nextKind =
      explicitKind && index === segments.length
        ? explicitKind
        : segments.length === 1
          ? "variable"
          : index === 1
            ? "object"
            : "property";
    const currentKind = discoveredSymbols.get(label);

    discoveredSymbols.set(label, mergeSymbolKind(currentKind, nextKind));
  }
}

function qualifyVariablePath(variableName: string, blockStack: string[]) {
  if (variableName.includes(".") || blockStack.length === 0) {
    return variableName;
  }

  return `${blockStack[blockStack.length - 1]}.${variableName}`;
}

function mergeSymbolKind(
  currentKind: SheetSymbolKind | undefined,
  nextKind: SheetSymbolKind
) {
  if (!currentKind) {
    return nextKind;
  }

  if (currentKind === "object" || nextKind === "object") {
    return "object";
  }

  if (currentKind === "property" || nextKind === "property") {
    return "property";
  }

  return "variable";
}

function formatSymbolDetail(kind: SheetSymbolKind) {
  if (kind === "object") {
    return "Object";
  }

  if (kind === "property") {
    return "Property";
  }

  return "Variable";
}

function createSymbolCompletion(
  symbol: SheetSymbol,
  insertsObjectPath: boolean
): Completion {
  return {
    apply:
      symbol.kind === "object" && insertsObjectPath
        ? applyObjectCompletion(symbol.label)
        : undefined,
    label: symbol.label,
    type: symbol.kind === "object" ? "class" : "variable",
    detail: formatSymbolDetail(symbol.kind),
    boost: 99,
  };
}

function createTagCompletion(tag: string): Completion {
  return {
    detail: "Workspace tag",
    label: `#${tag}`,
    type: "tag",
  };
}

function applyObjectCompletion(label: string) {
  return (
    view: EditorView,
    _completion: Completion,
    from: number,
    to: number
  ) => {
    const insert = `${label}.`;

    view.dispatch({
      changes: {
        from,
        to,
        insert,
      },
      selection: {
        anchor: from + insert.length,
      },
      userEvent: "input.complete",
    });

    scheduleFollowUpCompletion(view);
  };
}

function scheduleFollowUpCompletion(view: EditorView) {
  const reopen = () => {
    view.focus();
    startCompletion(view);
  };

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      reopen();
    });
    return;
  }

  setTimeout(reopen, 0);
}

const TAG_COMPLETION_PREFIX_PATTERN = /^\s*(?:#[A-Za-z0-9][A-Za-z0-9_-]*\s+)*$/;
const AUTOCOMPLETE_DISABLED_LINE_PATTERN = /^\s*(?:\/\/|#{1,6}\s)/;

function isTagCompletionContext(lineText: string, tokenOffset: number) {
  return TAG_COMPLETION_PREFIX_PATTERN.test(lineText.slice(0, tokenOffset));
}

function isAutocompleteDisabledContext(lineText: string) {
  return AUTOCOMPLETE_DISABLED_LINE_PATTERN.test(lineText);
}

function createFunctionInfo(name: string, description: string) {
  return () => {
    const wrap = document.createElement("div");
    wrap.className = "linea-completion-info";

    const title = document.createElement("div");
    title.className = "linea-completion-info__title";
    title.textContent = name;

    const body = document.createElement("p");
    body.className = "linea-completion-info__body";
    body.textContent = description;

    wrap.append(title, body);
    return wrap;
  };
}

function createFunctionCompletion(
  label: string,
  detail: string,
  body: string
): LineaCompletion {
  const lineaInfo: LineaCompletionInfo = {
    title: label,
    body,
  };

  return {
    label,
    type: "function",
    detail,
    info: createFunctionInfo(label, body),
    lineaInfo,
  };
}

function createAliasCompletion(
  label: string,
  detail: string,
  body: string,
  type: Completion["type"] = "keyword"
): LineaCompletion {
  const lineaInfo: LineaCompletionInfo = {
    title: label,
    body,
  };

  return {
    label,
    type,
    detail,
    info: createFunctionInfo(label, body),
    lineaInfo,
  };
}

function createOperatorAliasCompletions() {
  const labels = new Set([
    ...WORD_OPERATOR_ALIASES.keys(),
    ...CONVERSION_OPERATOR_ALIASES.keys(),
  ]);

  return [...labels]
    .sort((left, right) => left.localeCompare(right))
    .map((label) =>
      createAliasCompletion(
        label,
        "Operator",
        "Recognized operator alias. The evaluator normalizes this to the same canonical operator as its symbol form."
      )
    );
}

function createCurrencyAliasCompletions() {
  const labels = new Set([
    ...CURRENCY_NAME_ALIASES.keys(),
    ...CURRENCY_SYMBOL_ALIASES.keys(),
    ...CURRENCY_NAME_ALIASES.values(),
  ]);

  return [...labels]
    .sort((left, right) => left.localeCompare(right))
    .map((label) =>
      createAliasCompletion(
        label,
        "Currency",
        "Recognized currency alias. Names, ISO codes, and symbols are treated equivalently by the evaluator.",
        "constant"
      )
    );
}

function createUnitAliasCompletions() {
  return [...MULTI_WORD_UNIT_ALIAS_PHRASES]
    .sort((left, right) => left.localeCompare(right))
    .map((label) =>
      createAliasCompletion(
        label,
        "Unit",
        "Recognized unit alias. This phrase maps to the same unit as the canonical unit token."
      )
    );
}
