import { evaluateSheet as defaultEvaluateSheet } from "@linea/calc-engine";
import type { SheetRecord } from "@linea/shared";

import type { SheetSymbol } from "./sheet-autocomplete";

type RegistryEntry = {
  sourceSheetId: string;
  value: unknown;
};

type BuildSheetLinkingStateParams = {
  activeDraft: string;
  activeSheetId: string;
  carryRoundedValues: boolean;
  evaluateSheet?: typeof defaultEvaluateSheet;
  precision: number;
  readDraftSnapshot: (sheetId: string, fallback: string) => string;
  sheets: SheetRecord[];
};

export async function buildSheetLinkingState({
  activeDraft,
  activeSheetId,
  carryRoundedValues,
  evaluateSheet = defaultEvaluateSheet,
  precision,
  readDraftSnapshot,
  sheets,
}: BuildSheetLinkingStateParams) {
  let registry = new Map<string, RegistryEntry>();

  for (let pass = 0; pass < Math.max(1, sheets.length); pass += 1) {
    const nextRegistry = new Map<string, RegistryEntry>();

    for (const sheet of sheets) {
      const body =
        sheet.id === activeSheetId
          ? activeDraft
          : readDraftSnapshot(sheet.id, sheet.body);
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
    importableSymbols: collectRegistryCompletionSymbols(
      registry,
      activeSheetId
    ),
    importedSymbols,
  };
}

function buildImportedSymbolsForSheet(
  registry: Map<string, RegistryEntry>,
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

function collectRegistryCompletionSymbols(
  registry: Map<string, RegistryEntry>,
  activeSheetId: string
) {
  const symbolKinds = new Map<string, SheetSymbol["kind"]>();

  for (const [label, entry] of registry.entries()) {
    if (entry.sourceSheetId === activeSheetId) {
      continue;
    }

    addCompletionSymbol(symbolKinds, label);
  }

  return [...symbolKinds.entries()]
    .map(([label, kind]) => ({ kind, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
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

function registriesEqual(
  left: Map<string, RegistryEntry>,
  right: Map<string, RegistryEntry>
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
