import {
  type MathJsInstance,
  type MathType,
  all,
  create,
  isUnit,
} from "mathjs";
import { Temporal } from "temporal-polyfill";

import {
  type CurrencyRateProvider,
  createCurrencyRateProvider,
  installCurrencyUnits,
} from "./currency-rates";
import { KNOWN_CURRENCY_CODES } from "./aliases";
import { evaluateDateTimeExpression, formatUnixTimestamp } from "./date-time";
import {
  containsCurrencyExpression,
  normalizeExpression,
} from "./expression-normalizer";
import {
  type ComputedValue,
  type MathValue,
  asMathValue,
  asTextValue,
  formatComputedValue,
  formatDisplayValue,
  isMathComputedValue,
} from "./value-format";

export type EvaluatedLine = {
  displayValue: string | null;
  expression: string;
  kind: "assignment" | "blank" | "comment" | "error" | "expression" | "heading";
  label: string | null;
  raw: string;
};

export type SheetEvaluation = {
  exportedSymbols: Record<string, unknown>;
  lines: EvaluatedLine[];
};

export type SheetEvaluationOptions = {
  carryRoundedValues?: boolean;
  currencyRateProvider?: CurrencyRateProvider;
  importedSymbols?: Record<string, unknown>;
  now?: () => Temporal.Instant;
  precision?: number;
};

type EvaluationConfig = {
  emPx: number;
  ppi: number;
};

type RuntimeContext = {
  carryRoundedValues: boolean;
  config: EvaluationConfig;
  currencyRateProvider: CurrencyRateProvider;
  currencyUnitsInstalled: boolean;
  math: MathJsInstance;
  now: () => Temporal.Instant;
  precision: number;
};

type ScopeValue = MathValue | Scope | string;

interface Scope {
  [key: string]: ScopeValue;
}

type NamespaceBlockEntry =
  | {
      type: "empty";
    }
  | {
      expression: string;
      name: string;
      type: "assignment";
    }
  | {
      entries: NamespaceBlockEntry[];
      name: string;
      type: "object";
    };

type ObjectLiteralBlockEntry =
  | {
      type: "empty";
    }
  | {
      expression: string;
      type: "expression";
    }
  | {
      expression: string;
      name: string;
      type: "property";
    }
  | {
      entries: ObjectLiteralBlockEntry[];
      name: string;
      type: "object";
    };

const defaultCurrencyRateProvider = createCurrencyRateProvider();
const AGGREGATE_IDENTIFIER_PATTERN = /(?<!\.)\b(?:avg|average|sum|total)\b/i;
const KNOWN_CURRENCY_CODE_SET = new Set<string>(KNOWN_CURRENCY_CODES);

export async function evaluateSheet(
  input: string,
  options: SheetEvaluationOptions = {}
): Promise<SheetEvaluation> {
  const lines = input.split(/\r?\n/);
  const scope: Scope = {};
  const exportedSymbols: Record<string, unknown> = {};
  const evaluatedLines: EvaluatedLine[] = [];
  let currentBlockValues: ComputedValue[] = [];

  const runtime = createRuntimeContext(options);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const trimmed = rawLine.trim();

    if (trimmed === "") {
      currentBlockValues = [];
      evaluatedLines.push({
        displayValue: null,
        expression: "",
        kind: "blank",
        label: null,
        raw: rawLine,
      });
      continue;
    }

    if (trimmed.startsWith("//")) {
      evaluatedLines.push({
        displayValue: null,
        expression: "",
        kind: "comment",
        label: null,
        raw: rawLine,
      });
      continue;
    }

    if (trimmed.startsWith("#")) {
      evaluatedLines.push({
        displayValue: null,
        expression: "",
        kind: "heading",
        label: trimmed.slice(1).trim() || null,
        raw: rawLine,
      });
      continue;
    }

    const importSymbols = parseDirectiveSymbols(trimmed, "Import");
    if (importSymbols) {
      const importedValues = importSymbols.map((symbol) => ({
        symbol,
        value: options.importedSymbols?.[symbol],
      }));

      if (importedValues.some((entry) => entry.value === undefined)) {
        evaluatedLines.push({
          displayValue: null,
          expression: trimmed,
          kind: "error",
          label: null,
          raw: rawLine,
        });
        continue;
      }

      for (const importedEntry of importedValues) {
        const importedComputedValue = cloneImportedComputedValue(
          importedEntry.value
        );

        applyAssignment(
          importedEntry.symbol,
          importedComputedValue,
          runtime,
          scope
        );
        currentBlockValues.push(importedComputedValue);
      }

      evaluatedLines.push({
        displayValue: formatDirectiveDisplayValue(
          importedValues.map((entry) => entry.value)
        ),
        expression: trimmed,
        kind: "expression",
        label: null,
        raw: rawLine,
      });
      continue;
    }

    const exportSymbols = parseDirectiveSymbols(trimmed, "Export");
    if (exportSymbols) {
      const exportedValues = exportSymbols.map((symbol) => ({
        symbol,
        value: getScopeValueAtPath(scope, symbol),
      }));

      if (exportedValues.some((entry) => entry.value === undefined)) {
        evaluatedLines.push({
          displayValue: null,
          expression: trimmed,
          kind: "error",
          label: null,
          raw: rawLine,
        });
        continue;
      }

      for (const exportedEntry of exportedValues) {
        for (const [symbol, value] of collectExportedSymbols(
          exportedEntry.symbol,
          exportedEntry.value
        )) {
          exportedSymbols[symbol] = value;
        }
      }

      evaluatedLines.push({
        displayValue: formatDirectiveDisplayValue(
          exportedValues.map((entry) => entry.value)
        ),
        expression: trimmed,
        kind: "expression",
        label: null,
        raw: rawLine,
      });
      continue;
    }

    const namespaceBlock = consumeNamespaceBlock(lines, index);
    if (namespaceBlock) {
      const { entries, expression, lineCount, name } = namespaceBlock;

      try {
        const evaluatedBlock = await evaluateNamespaceBlockEntries(
          entries,
          scope,
          runtime
        );

        const value = asMathValue(evaluatedBlock.scope as unknown as MathValue);
        applyAssignment(name, value, runtime, scope);

        evaluatedLines.push({
          displayValue: "Object",
          expression,
          kind: "assignment",
          label: name,
          raw: rawLine,
        });
        appendNamespaceBlockContinuationLines(
          evaluatedLines,
          lines,
          index,
          evaluatedBlock.displays
        );
      } catch (error) {
        evaluatedLines.push({
          displayValue: null,
          expression,
          kind: "error",
          label: name,
          raw: rawLine,
        });
        appendAssignmentContinuationLines(
          evaluatedLines,
          lines,
          index,
          lineCount
        );
      }
      index += lineCount - 1;
      continue;
    }

    const multilineObjectAssignment = consumeMultilineObjectAssignment(
      lines,
      index
    );
    if (multilineObjectAssignment) {
      const { entries, expression, lineCount, name } = multilineObjectAssignment;

      try {
        const evaluatedBlock = await evaluateObjectLiteralBlockEntries(
          entries,
          scope,
          runtime
        );
        const value = asMathValue(evaluatedBlock.scope as unknown as MathValue);

        applyAssignment(name, value, runtime, scope);
        currentBlockValues.push(value);

        evaluatedLines.push({
          displayValue: formatComputedValue(value),
          expression,
          kind: "assignment",
          label: name,
          raw: rawLine,
        });
        appendBlockContinuationLines(
          evaluatedLines,
          lines,
          index,
          evaluatedBlock.displays
        );
      } catch (error) {
        evaluatedLines.push({
          displayValue: null,
          expression,
          kind: "error",
          label: name,
          raw: rawLine,
        });
        appendAssignmentContinuationLines(
          evaluatedLines,
          lines,
          index,
          lineCount
        );
      }

      index += lineCount - 1;
      continue;
    }

    const multilineAssignment = consumeMultilineAssignment(lines, index);
    if (multilineAssignment) {
      const { expression, lineCount, name } = multilineAssignment;

      if (
        isAggregateExpression(expression) &&
        currentBlockValues.length === 0
      ) {
        evaluatedLines.push({
          displayValue: null,
          expression,
          kind: "assignment",
          label: name,
          raw: rawLine,
        });
        appendAssignmentContinuationLines(
          evaluatedLines,
          lines,
          index,
          lineCount
        );
        index += lineCount - 1;
        continue;
      }

      try {
        const value = await evaluateExpression(
          expression,
          scope,
          currentBlockValues,
          runtime
        );

        applyAssignment(name, value, runtime, scope);
        currentBlockValues.push(value);

        evaluatedLines.push({
          displayValue: formatComputedValue(value),
          expression,
          kind: "assignment",
          label: name,
          raw: rawLine,
        });
      } catch (error) {
        evaluatedLines.push({
          displayValue: null,
          expression,
          kind: "error",
          label: name,
          raw: rawLine,
        });
      }

      appendAssignmentContinuationLines(
        evaluatedLines,
        lines,
        index,
        lineCount
      );
      index += lineCount - 1;
      continue;
    }

    const assignmentMatch = trimmed.match(
      /^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*=\s*(.+)$/
    );
    if (assignmentMatch) {
      const [, name, expression] = assignmentMatch;

      if (
        isAggregateExpression(expression) &&
        currentBlockValues.length === 0
      ) {
        evaluatedLines.push({
          displayValue: null,
          expression,
          kind: "assignment",
          label: name,
          raw: rawLine,
        });
        continue;
      }

      try {
        const value = await evaluateExpression(
          expression,
          scope,
          currentBlockValues,
          runtime
        );

        applyAssignment(name, value, runtime, scope);
        currentBlockValues.push(value);

        evaluatedLines.push({
          displayValue: formatComputedValue(value),
          expression,
          kind: "assignment",
          label: name,
          raw: rawLine,
        });
      } catch (error) {
        evaluatedLines.push({
          displayValue: null,
          expression,
          kind: "error",
          label: name,
          raw: rawLine,
        });
      }

      continue;
    }

    let label: string | null = null;
    let expression = trimmed;
    const labelMatch = trimmed.match(/^([^:]+):\s+(.+)$/);
    if (labelMatch) {
      label = labelMatch[1]?.trim() ?? null;
      expression = labelMatch[2] ?? trimmed;
    }

    try {
      if (
        isAggregateExpression(expression) &&
        currentBlockValues.length === 0
      ) {
        evaluatedLines.push({
          displayValue: null,
          expression,
          kind: "expression",
          label,
          raw: rawLine,
        });
        continue;
      }

      const value = await evaluateExpression(
        expression,
        scope,
        currentBlockValues,
        runtime
      );

      currentBlockValues.push(value);

      evaluatedLines.push({
        displayValue: formatComputedValue(value),
        expression,
        kind: "expression",
        label,
        raw: rawLine,
      });
    } catch (error) {
      evaluatedLines.push({
        displayValue: null,
        expression,
        kind: "error",
        label,
        raw: rawLine,
      });
    }
  }

  return { exportedSymbols, lines: evaluatedLines };
}

function consumeNamespaceBlock(lines: string[], startIndex: number) {
  const rawLine = lines[startIndex] ?? "";
  const trimmed = rawLine.trim();
  const rootMatch = trimmed.match(/^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*\{$/);

  if (!rootMatch?.[1]) {
    return null;
  }

  const parsedBlock = parseNamespaceBlockEntries(lines, startIndex + 1, []);

  return {
    entries: parsedBlock.nodes,
    expression: `{ ${parsedBlock.entries.join(", ")} }`,
    lineCount: parsedBlock.lineCount + 1,
    name: rootMatch[1],
  };
}

function parseNamespaceBlockEntries(
  lines: string[],
  startIndex: number,
  pathPrefix: string[]
) {
  const entries: string[] = [];
  const nodes: NamespaceBlockEntry[] = [];
  let lineCount = 0;

  while (startIndex + lineCount < lines.length) {
    const rawLine = lines[startIndex + lineCount] ?? "";
    const trimmed = rawLine.trim();

    if (trimmed === "" || trimmed.startsWith("//") || trimmed.startsWith("#")) {
      nodes.push({ type: "empty" });
      lineCount += 1;
      continue;
    }

    if (/^},?$/.test(trimmed)) {
      nodes.push({ type: "empty" });
      lineCount += 1;
      break;
    }

    const nestedBlockMatch = trimmed.match(/^([A-Za-z_]\w*)\s*\{$/);
    if (nestedBlockMatch?.[1]) {
      const nestedBlock = parseNamespaceBlockEntries(
        lines,
        startIndex + lineCount + 1,
        [...pathPrefix, nestedBlockMatch[1]]
      );

      entries.push(
        `${nestedBlockMatch[1]}: { ${nestedBlock.entries.join(", ")} }`
      );
      nodes.push({
        entries: nestedBlock.nodes,
        name: nestedBlockMatch[1],
        type: "object",
      });
      lineCount += nestedBlock.lineCount + 1;
      continue;
    }

    const assignmentMatch = trimmed.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
    if (assignmentMatch?.[1] && assignmentMatch[2]) {
      entries.push(
        `${assignmentMatch[1]}: ${stripTrailingComma(assignmentMatch[2])}`
      );
      nodes.push({
        expression: stripTrailingComma(assignmentMatch[2]),
        name: assignmentMatch[1],
        type: "assignment",
      });
      lineCount += 1;
      continue;
    }

    entries.push(trimmed);
    nodes.push({ type: "empty" });
    lineCount += 1;
  }

  return {
    entries,
    lineCount,
    nodes,
  };
}

function consumeMultilineObjectAssignment(lines: string[], startIndex: number) {
  const rawLine = lines[startIndex] ?? "";
  const trimmed = rawLine.trim();
  const assignmentMatch = trimmed.match(
    /^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*=\s*\{$/
  );

  if (!assignmentMatch?.[1]) {
    return null;
  }

  const parsedBlock = parseObjectLiteralEntries(lines, startIndex + 1);

  return {
    entries: parsedBlock.nodes,
    expression: `{ ${parsedBlock.entries.join(", ")} }`,
    lineCount: parsedBlock.lineCount + 1,
    name: assignmentMatch[1],
  };
}

function parseObjectLiteralEntries(
  lines: string[],
  startIndex: number
) {
  const entries: string[] = [];
  const nodes: ObjectLiteralBlockEntry[] = [];
  let lineCount = 0;

  while (startIndex + lineCount < lines.length) {
    const rawLine = lines[startIndex + lineCount] ?? "";
    const trimmed = rawLine.trim();

    if (trimmed === "" || trimmed.startsWith("//") || trimmed.startsWith("#")) {
      nodes.push({ type: "empty" });
      lineCount += 1;
      continue;
    }

    if (/^},?$/.test(trimmed)) {
      nodes.push({ type: "empty" });
      lineCount += 1;
      break;
    }

    const nestedBlockMatch = trimmed.match(/^([A-Za-z_]\w*)\s*:\s*\{$/);
    if (nestedBlockMatch?.[1]) {
      const nestedBlock = parseObjectLiteralEntries(lines, startIndex + lineCount + 1);

      entries.push(
        `${nestedBlockMatch[1]}: { ${nestedBlock.entries.join(", ")} }`
      );
      nodes.push({
        entries: nestedBlock.nodes,
        name: nestedBlockMatch[1],
        type: "object",
      });
      lineCount += nestedBlock.lineCount + 1;
      continue;
    }

    const propertyMatch = trimmed.match(/^([A-Za-z_]\w*)\s*:\s*(.+)$/);
    if (propertyMatch?.[1] && propertyMatch[2]) {
      entries.push(
        `${propertyMatch[1]}: ${stripTrailingComma(propertyMatch[2])}`
      );
      nodes.push({
        expression: stripTrailingComma(propertyMatch[2]),
        name: propertyMatch[1],
        type: "property",
      });
      lineCount += 1;
      continue;
    }

    nodes.push({
      expression: stripTrailingComma(trimmed),
      type: "expression",
    });
    lineCount += 1;
  }

  return {
    entries,
    lineCount,
    nodes,
  };
}

function consumeMultilineAssignment(lines: string[], startIndex: number) {
  const rawLine = lines[startIndex] ?? "";
  const trimmed = rawLine.trim();
  const assignmentMatch = trimmed.match(
    /^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*=\s*(.+)$/
  );

  if (!assignmentMatch) {
    return null;
  }

  let expression = assignmentMatch[2] ?? "";
  let braceBalance = getObjectBraceBalance(expression);

  if (braceBalance <= 0) {
    return null;
  }

  let lineCount = 1;

  while (startIndex + lineCount < lines.length && braceBalance > 0) {
    const nextLine = lines[startIndex + lineCount] ?? "";
    expression += `\n${nextLine}`;
    braceBalance += getObjectBraceBalance(nextLine);
    lineCount += 1;
  }

  return {
    expression,
    lineCount,
    name: assignmentMatch[1] ?? "",
  };
}

function getObjectBraceBalance(line: string) {
  let balance = 0;
  let activeQuote: '"' | "'" | null = null;
  let isEscaped = false;

  for (const character of line) {
    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (character === "\\") {
      isEscaped = true;
      continue;
    }

    if (activeQuote) {
      if (character === activeQuote) {
        activeQuote = null;
      }

      continue;
    }

    if (character === '"' || character === "'") {
      activeQuote = character;
      continue;
    }

    if (character === "{") {
      balance += 1;
      continue;
    }

    if (character === "}") {
      balance -= 1;
    }
  }

  return balance;
}

function appendAssignmentContinuationLines(
  evaluatedLines: EvaluatedLine[],
  lines: string[],
  startIndex: number,
  lineCount: number
) {
  for (let offset = 1; offset < lineCount; offset += 1) {
    evaluatedLines.push({
      displayValue: null,
      expression: "",
      kind: "assignment",
      label: null,
      raw: lines[startIndex + offset] ?? "",
    });
  }
}

function appendBlockContinuationLines(
  evaluatedLines: EvaluatedLine[],
  lines: string[],
  startIndex: number,
  displays: Array<string | null>
) {
  for (let offset = 0; offset < displays.length; offset += 1) {
    evaluatedLines.push({
      displayValue: displays[offset] ?? null,
      expression: "",
      kind: "assignment",
      label: null,
      raw: lines[startIndex + offset + 1] ?? "",
    });
  }
}

function appendNamespaceBlockContinuationLines(
  evaluatedLines: EvaluatedLine[],
  lines: string[],
  startIndex: number,
  displays: Array<string | null>
) {
  appendBlockContinuationLines(evaluatedLines, lines, startIndex, displays);
}

function getScopeValueAtPath(scope: Scope, path: string) {
  const segments = path.split(".");
  const [root, ...rest] = segments;

  if (!root) {
    return undefined;
  }

  let current: unknown = scope[root];

  for (const segment of rest) {
    if (!isPlainObjectRecord(current) || !(segment in current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function isPlainObjectRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  if (isUnit(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stripTrailingComma(value: string) {
  return value.endsWith(",") ? value.slice(0, -1).trimEnd() : value;
}

function parseDirectiveSymbols(input: string, directive: "Export" | "Import") {
  const match = input.match(
    new RegExp(
      `^${directive}\\s+([A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)*(?:\\s*,\\s*[A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)*)*)$`,
      "i"
    )
  );

  if (!match?.[1]) {
    return null;
  }

  return match[1]
    .split(",")
    .map((symbol) => symbol.trim())
    .filter((symbol) => symbol.length > 0);
}

function formatDirectiveDisplayValue(values: Array<unknown>) {
  const firstValue = values[0];

  if (values.length === 0 || firstValue === undefined) {
    return null;
  }

  return formatDisplayValue(firstValue);
}

function collectExportedSymbols(path: string, value: unknown) {
  const entries = [[path, cloneScopeValue(value)] as const];

  if (!isPlainObjectRecord(value)) {
    return entries;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    entries.push(...collectExportedSymbols(`${path}.${key}`, nestedValue));
  }

  return entries;
}

function cloneImportedComputedValue(value: unknown): ComputedValue {
  if (typeof value === "string") {
    return asTextValue(value);
  }

  return asMathValue(cloneScopeValue(value) as MathValue);
}

function cloneScopeValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneScopeValue(item)) as T;
  }

  if (isPlainObjectRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneScopeValue(item)])
    ) as T;
  }

  return value;
}

async function evaluateNamespaceBlockEntries(
  entries: NamespaceBlockEntry[],
  parentScope: Scope,
  runtime: RuntimeContext
) {
  const displays: Array<string | null> = [];
  const scope: Scope = {};
  const blockValues: ComputedValue[] = [];

  for (const entry of entries) {
    if (entry.type === "empty") {
      displays.push(null);
      continue;
    }

    if (entry.type === "object") {
      const nestedBlock = await evaluateNamespaceBlockEntries(
        entry.entries,
        {
          ...parentScope,
          ...scope,
        },
        runtime
      );

      scope[entry.name] = nestedBlock.scope;
      displays.push("Object", ...nestedBlock.displays);
      continue;
    }

    const value = await evaluateExpression(
      entry.expression,
      {
        ...parentScope,
        ...scope,
      },
      blockValues,
      runtime
    );

    applyAssignment(entry.name, value, runtime, scope);
    blockValues.push(value);
    displays.push(formatComputedValue(value));
  }

  return {
    displays,
    scope,
  };
}

async function evaluateObjectLiteralBlockEntries(
  entries: ObjectLiteralBlockEntry[],
  parentScope: Scope,
  runtime: RuntimeContext
) {
  const displays: Array<string | null> = [];
  const scope: Scope = {};
  const blockValues: ComputedValue[] = [];

  for (const entry of entries) {
    if (entry.type === "empty") {
      displays.push(null);
      continue;
    }

    if (entry.type === "object") {
      const nestedBlock = await evaluateObjectLiteralBlockEntries(
        entry.entries,
        {
          ...parentScope,
          ...scope,
        },
        runtime
      );

      scope[entry.name] = nestedBlock.scope;
      displays.push("Object", ...nestedBlock.displays);
      continue;
    }

    const value = await evaluateExpression(
      entry.expression,
      {
        ...parentScope,
        ...scope,
      },
      blockValues,
      runtime
    );

    if (entry.type === "property") {
      scope[entry.name] = value.value;
    }

    blockValues.push(value);
    displays.push(formatComputedValue(value));
  }

  return {
    displays,
    scope,
  };
}

async function evaluateExpression(
  expression: string,
  scope: Scope,
  blockValues: ComputedValue[],
  runtime: RuntimeContext
) {
  const normalizedExpression = normalizeExpression(expression);
  const dateTimeValue =
    evaluateDateTimeExpression(normalizedExpression, {
      now: runtime.now,
    }) ??
    (normalizedExpression === expression
      ? null
      : evaluateDateTimeExpression(expression, {
          now: runtime.now,
        }));

  if (dateTimeValue) {
    return asTextValue(dateTimeValue);
  }

  if (normalizedExpression === "sum") {
    return asMathValue(aggregateBlock(blockValues, "sum", runtime.math));
  }

  if (normalizedExpression === "avg" || normalizedExpression === "average") {
    return asMathValue(aggregateBlock(blockValues, "avg", runtime.math));
  }

  if (
    containsCurrencyExpression(expression) ||
    containsCurrencyExpression(normalizedExpression) ||
    scopeContainsCurrencyUnit(scope) ||
    blockValuesContainCurrencyUnit(blockValues)
  ) {
    if (!runtime.currencyUnitsInstalled) {
      const rates = await runtime.currencyRateProvider();
      installCurrencyUnits(runtime.math, rates);
      runtime.currencyUnitsInstalled = true;
    }
  }

  const prev = findPreviousMathValue(blockValues) ?? 0;
  const aggregateScope = createAggregateScope(
    normalizedExpression,
    blockValues,
    runtime.math
  );
  const value = runtime.math.evaluate(normalizedExpression, {
    ...aggregateScope,
    ...scope,
    prev,
  }) as MathType;

  if (typeof value === "function") {
    throw new Error("Function identifiers require arguments");
  }

  if (typeof value === "string") {
    return asTextValue(value);
  }

  return roundComputedValueForCarry(asMathValue(value as MathValue), runtime);
}

function aggregateBlock(
  values: ComputedValue[],
  kind: "avg" | "sum",
  math: MathJsInstance
) {
  if (values.length === 0) {
    return 0;
  }

  const mathValues = values
    .filter(isMathComputedValue)
    .map((value) => value.value);

  if (mathValues.length !== values.length) {
    throw new Error("Cannot aggregate non-numeric values");
  }
  const total = mathValues.reduce<MathType | undefined>((carry, value) => {
    if (carry === undefined) {
      return value;
    }

    return math.add(carry, value) as MathType;
  }, undefined);

  if (kind === "sum") {
    return total ?? 0;
  }

  return math.divide(total ?? 0, mathValues.length) as MathType;
}

function createAggregateScope(
  expression: string,
  values: ComputedValue[],
  math: MathJsInstance
) {
  if (!AGGREGATE_IDENTIFIER_PATTERN.test(expression)) {
    return {};
  }

  const sum = aggregateBlock(values, "sum", math);
  const average = aggregateBlock(values, "avg", math);

  return {
    average,
    avg: average,
    sum,
    total: sum,
  };
}

function blockValuesContainCurrencyUnit(values: ComputedValue[]) {
  return values.some(
    (value) => isMathComputedValue(value) && valueContainsCurrencyUnit(value.value)
  );
}

function scopeContainsCurrencyUnit(scope: Scope) {
  return Object.values(scope).some((value) => valueContainsCurrencyUnit(value));
}

function valueContainsCurrencyUnit(value: unknown): boolean {
  if (isUnit(value)) {
    return KNOWN_CURRENCY_CODE_SET.has(value.formatUnits().toUpperCase());
  }

  if (Array.isArray(value)) {
    return value.some((entry) => valueContainsCurrencyUnit(entry));
  }

  if (!isPlainObjectRecord(value)) {
    return false;
  }

  return Object.values(value).some((entry) => valueContainsCurrencyUnit(entry));
}

function applyAssignment(
  name: string,
  value: ComputedValue,
  runtime: RuntimeContext,
  scope: Scope
) {
  if (name === "ppi" && isMathComputedValue(value)) {
    const nextPpi = Number(value.value);

    if (!Number.isFinite(nextPpi)) {
      throw new Error("ppi must be a finite number");
    }

    runtime.config.ppi = nextPpi;
    installCssUnits(runtime.math, runtime.config);
    scope[name] = runtime.config.ppi;
    return;
  }

  if (name === "em" && isMathComputedValue(value) && isUnit(value.value)) {
    runtime.config.emPx = Number(value.value.toNumeric("px"));
    installCssUnits(runtime.math, runtime.config);
    return;
  }

  const path = name.split(".");

  if (path.length === 1) {
    scope[name] = value.value;
    return;
  }

  assignScopePath(scope, path, value.value);
}

function assignScopePath(scope: Scope, path: string[], value: ScopeValue) {
  const [root, ...segments] = path;

  if (!root || segments.length === 0) {
    return;
  }

  let current = scope[root];

  if (current === undefined) {
    current = {};
    scope[root] = current;
  }

  if (!isPlainScopeObject(current)) {
    throw new Error(`Cannot assign nested property on non-object '${root}'`);
  }

  let objectCursor = current;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];

    if (!segment) {
      continue;
    }

    const nextValue = objectCursor[segment];

    if (nextValue === undefined) {
      objectCursor[segment] = {};
    } else if (!isPlainScopeObject(nextValue)) {
      throw new Error(
        `Cannot assign nested property on non-object '${path
          .slice(0, index + 2)
          .join(".")}'`
      );
    }

    objectCursor = objectCursor[segment] as Scope;
  }

  const leaf = segments[segments.length - 1];

  if (!leaf) {
    return;
  }

  objectCursor[leaf] = value;
}

function isPlainScopeObject(value: ScopeValue): value is Scope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  if (isUnit(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function createRuntimeContext(options: SheetEvaluationOptions): RuntimeContext {
  const math = create(all, {});
  const config: EvaluationConfig = {
    emPx: 16,
    ppi: 96,
  };

  installCssUnits(math, config);
  installBuiltInFunctions(math);

  return {
    carryRoundedValues: options.carryRoundedValues ?? false,
    config,
    currencyRateProvider:
      options.currencyRateProvider ?? defaultCurrencyRateProvider,
    currencyUnitsInstalled: false,
    math,
    now: options.now ?? (() => Temporal.Now.instant()),
    precision: clampRuntimePrecision(options.precision),
  };
}

function installBuiltInFunctions(math: MathJsInstance) {
  const localTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

  math.import(
    {
      fact: (value: number) => math.factorial(value),
      fromunix: (value: number) => formatUnixTimestamp(value, localTimeZone),
      ln: (value: number) => math.log(value),
      root: (value: number, degree: number) => math.nthRoot(value, degree),
      round: (value: MathValue) => roundMathValue(math, value),
    },
    {
      override: true,
    }
  );
}

function installCssUnits(math: MathJsInstance, config: EvaluationConfig) {
  math.createUnit("px", `${1 / config.ppi} inch`, {
    override: true,
  });
  math.createUnit("em", `${config.emPx} px`, {
    override: true,
  });
}

function findPreviousMathValue(blockValues: ComputedValue[]) {
  for (let index = blockValues.length - 1; index >= 0; index -= 1) {
    const value = blockValues[index];

    if (value && isMathComputedValue(value)) {
      return value.value;
    }
  }

  return null;
}

function isAggregateExpression(expression: string) {
  return /^(?:avg|average|sum|total)$/i.test(expression.trim());
}

function roundMathValue(math: MathJsInstance, value: MathValue) {
  if (!isUnit(value)) {
    return Math.round(Number(value)) as MathType;
  }

  const unitName = value.formatUnits();
  const numericValue = value.toNumeric(unitName);

  return math.unit(Math.round(Number(numericValue)), unitName) as MathType;
}

function roundComputedValueForCarry(
  value: ComputedValue,
  runtime: RuntimeContext
) {
  if (!runtime.carryRoundedValues || !isMathComputedValue(value)) {
    return value;
  }

  if (typeof value.value === "number") {
    return asMathValue(
      Number(runtime.math.round(value.value, runtime.precision)) as MathValue
    );
  }

  if (!isUnit(value.value)) {
    return value;
  }

  const unitName = value.value.formatUnits();
  const numericValue = Number(value.value.toNumeric(unitName));
  const roundedNumericValue = Number(
    runtime.math.round(numericValue, runtime.precision)
  );

  return asMathValue(
    runtime.math.unit(roundedNumericValue, unitName) as MathValue
  );
}

function clampRuntimePrecision(value: number | undefined) {
  const precision = Number(value);

  if (!Number.isFinite(precision)) {
    return 2;
  }

  return Math.min(8, Math.max(0, Math.round(precision)));
}
