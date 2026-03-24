import { evaluateSheet, type EvaluatedLine } from "@linea/calc-engine";

import type { SheetSymbol } from "./sheet-autocomplete";

export type SheetEvaluationSheet = {
  body: string;
  id: string;
};

export type SheetEvaluationRequest = {
  activeDraft: string;
  activeSheetId: string;
  carryRoundedValues: boolean;
  decimalSeparator?: "comma" | "dot";
  precision: number;
};

export type SheetEvaluationResultLine = EvaluatedLine & {
  displayValueMeta?: {
    carryMode: "full-precision" | "rounded";
    fullPrecisionValue: string;
  };
};

export type SheetEvaluationResult = {
  completionSymbols: SheetSymbol[];
  lines: SheetEvaluationResultLine[];
};

type SheetEvaluationTask = SheetEvaluationRequest & {
  sheets: SheetEvaluationSheet[];
};

export async function computeSheetEvaluation({
  activeDraft,
  activeSheetId,
  carryRoundedValues,
  decimalSeparator = "dot",
  precision,
  sheets,
}: SheetEvaluationTask): Promise<SheetEvaluationResult> {
  const linkingState = await buildSheetLinkingState({
    activeDraft,
    activeSheetId,
    carryRoundedValues,
    precision,
    sheets,
  });
  const evaluation = await evaluateSheet(activeDraft, {
    carryRoundedValues,
    importedSymbols: linkingState.importedSymbols,
    precision,
  });

  return {
    completionSymbols: linkingState.completionSymbols,
    lines: applyPrecisionToLines(
      evaluation.lines,
      precision,
      carryRoundedValues,
      decimalSeparator
    ),
  };
}

async function buildSheetLinkingState({
  activeDraft,
  activeSheetId,
  carryRoundedValues,
  precision,
  sheets,
}: SheetEvaluationTask) {
  let registry = new Map<string, { sourceSheetId: string; value: unknown }>();

  for (let pass = 0; pass < Math.max(1, sheets.length); pass += 1) {
    const nextRegistry = new Map<
      string,
      { sourceSheetId: string; value: unknown }
    >();

    for (const sheet of sheets) {
      const body = sheet.id === activeSheetId ? activeDraft : sheet.body;
      const requestedImports = collectImportedLabels(body);
      const evaluation = await evaluateSheet(body, {
        carryRoundedValues,
        importedSymbols: buildImportedSymbolsForSheet(
          registry,
          sheet.id,
          requestedImports
        ),
        precision,
      });

      for (const [label, value] of Object.entries(evaluation.exportedSymbols)) {
        nextRegistry.set(label, {
          sourceSheetId: sheet.id,
          value,
        });
      }
    }

    if (registriesEqual(registry, nextRegistry)) {
      registry = nextRegistry;
      break;
    }

    registry = nextRegistry;
  }

  const activeImports = collectImportedLabels(activeDraft);
  const importedSymbols = buildImportedSymbolsForSheet(
    registry,
    activeSheetId,
    activeImports
  );

  return {
    completionSymbols: collectCompletionSymbolsFromValues(importedSymbols),
    importedSymbols,
  };
}

function buildImportedSymbolsForSheet(
  registry: Map<string, { sourceSheetId: string; value: unknown }>,
  sheetId: string,
  requestedImports: string[]
) {
  return Object.fromEntries(
    [...registry.entries()]
      .filter(
        ([label, entry]) =>
          entry.sourceSheetId !== sheetId &&
          matchesImportedLabel(label, requestedImports)
      )
      .map(([label, entry]) => [label, entry.value])
  );
}

function collectCompletionSymbolsFromValues(
  importedSymbols: Record<string, unknown>
) {
  const symbolKinds = new Map<string, SheetSymbol["kind"]>();

  for (const label of Object.keys(importedSymbols)) {
    addCompletionSymbol(symbolKinds, label);
  }

  return [...symbolKinds.entries()]
    .map(([label, kind]) => ({ kind, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function registriesEqual(
  left: Map<string, { sourceSheetId: string; value: unknown }>,
  right: Map<string, { sourceSheetId: string; value: unknown }>
) {
  if (left.size !== right.size) {
    return false;
  }

  for (const [label, leftEntry] of left.entries()) {
    const rightEntry = right.get(label);

    if (
      !rightEntry ||
      leftEntry.sourceSheetId !== rightEntry.sourceSheetId ||
      !valuesEqual(leftEntry.value, rightEntry.value)
    ) {
      return false;
    }
  }

  return true;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (
      !Array.isArray(left) ||
      !Array.isArray(right) ||
      left.length !== right.length
    ) {
      return false;
    }

    return left.every((item, index) => valuesEqual(item, right[index]));
  }

  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) {
      return false;
    }

    const leftEntries = Object.entries(left);
    const rightEntries = Object.entries(right);

    if (leftEntries.length !== rightEntries.length) {
      return false;
    }

    return leftEntries.every(([key, value]) => valuesEqual(value, right[key]));
  }

  if (
    typeof left === "object" &&
    left !== null &&
    typeof right === "object" &&
    right !== null
  ) {
    return String(left) === String(right);
  }

  return false;
}

function collectImportedLabels(body: string) {
  const labels: string[] = [];

  for (const rawLine of body.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    const match = trimmed.match(
      /^Import\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*(?:\s*,\s*[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)*)$/i
    );

    if (!match?.[1]) {
      continue;
    }

    labels.push(...match[1].split(/\s*,\s*/));
  }

  return labels;
}

function matchesImportedLabel(label: string, requestedImports: string[]) {
  return requestedImports.some(
    (requested) => label === requested || label.startsWith(`${requested}.`)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addCompletionSymbol(
  symbolKinds: Map<string, SheetSymbol["kind"]>,
  label: string
) {
  const segments = label.split(".");

  for (let index = 1; index <= segments.length; index += 1) {
    const symbol = segments.slice(0, index).join(".");
    const nextKind =
      segments.length === 1 ? "variable" : index === 1 ? "object" : "property";
    const currentKind = symbolKinds.get(symbol);

    symbolKinds.set(symbol, mergeCompletionSymbolKind(currentKind, nextKind));
  }
}

function mergeCompletionSymbolKind(
  currentKind: SheetSymbol["kind"] | undefined,
  nextKind: SheetSymbol["kind"]
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

function applyPrecisionToLines(
  lines: Awaited<ReturnType<typeof evaluateSheet>>["lines"],
  precision: number,
  carryRoundedValues: boolean,
  decimalSeparator: "comma" | "dot"
): SheetEvaluationResultLine[] {
  return lines.map(
    (line: Awaited<ReturnType<typeof evaluateSheet>>["lines"][number]) => ({
      ...line,
      displayValueMeta: getDisplayValueMeta(
        line.displayValue,
        precision,
        carryRoundedValues,
        decimalSeparator
      ),
      displayValue: formatDisplayValue(
        line.displayValue,
        precision,
        decimalSeparator
      ),
    })
  );
}

function formatDisplayValue(
  displayValue: string | null,
  precision: number,
  decimalSeparator: "comma" | "dot"
) {
  if (!displayValue) {
    return displayValue;
  }

  const parts = parseDisplayValueParts(displayValue);

  if (!parts) {
    return displayValue;
  }

  const formattedNumber = new Intl.NumberFormat(
    decimalSeparator === "comma" ? "de-DE" : "en-US",
    {
      maximumFractionDigits: precision,
      useGrouping: false,
    }
  ).format(parts.numericValue);

  return `${formattedNumber}${parts.suffix}`;
}

function parseDisplayValueParts(displayValue: string) {
  const exactNumberMatch = displayValue.match(
    /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i
  );

  if (exactNumberMatch) {
    const numericValue = Number(displayValue);

    if (!Number.isFinite(numericValue)) {
      return null;
    }

    return {
      numericValue,
      suffix: "",
    };
  }

  const numberWithSuffixMatch = displayValue.match(
    /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(\s+[^\d].*)$/i
  );

  if (!numberWithSuffixMatch) {
    return null;
  }

  const numericValue = Number(numberWithSuffixMatch[1]);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return {
    numericValue,
    suffix: numberWithSuffixMatch[2] ?? "",
  };
}

function getDisplayValueMeta(
  displayValue: string | null,
  precision: number,
  carryRoundedValues: boolean,
  decimalSeparator: "comma" | "dot"
) {
  if (!displayValue) {
    return undefined;
  }

  const formattedValue = formatDisplayValue(
    displayValue,
    precision,
    decimalSeparator
  );

  if (formattedValue === displayValue) {
    return undefined;
  }

  return {
    carryMode: carryRoundedValues ? "rounded" : "full-precision",
    fullPrecisionValue: displayValue,
  } satisfies SheetEvaluationResultLine["displayValueMeta"];
}
