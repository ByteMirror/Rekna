import {
  CONVERSION_OPERATOR_ALIASES,
  CURRENCY_NAME_ALIASES,
  CURRENCY_SYMBOL_ALIASES,
  KNOWN_CURRENCY_CODES,
  UNARY_FUNCTION_ALIASES,
  UNIT_NAME_ALIASES,
  WORD_OPERATOR_ALIASES,
} from "./aliases";

const KNOWN_CURRENCY_TOKENS =
  /\b(?:AUD|BTC|CAD|CHF|CNY|ETH|EUR|GBP|HKD|JPY|RUB|USD)\b/;

export function containsCurrencyExpression(expression: string) {
  return (
    KNOWN_CURRENCY_TOKENS.test(expression) ||
    /[$€£¥₽]/.test(expression) ||
    /\b(?:dollars?|euros?|pounds?|roubles?|rubles?)\b/i.test(expression)
  );
}

export function normalizeExpression(expression: string) {
  let normalized = expression.trim();

  normalized = normalized.replace(/°/g, " deg");
  normalized = normalizeSymbolOperators(normalized);
  normalized = normalizeCurrencyTokens(normalized);
  normalized = normalizeUnitAliases(normalized);
  normalized = normalizePercentagePhrases(normalized);
  normalized = normalizeWordOperators(normalized);
  normalized = normalizeConversionOperators(normalized);
  normalized = normalizeFunctionAliases(normalized);
  normalized = normalizeMixedUnitArithmetic(normalized);

  return normalized.trim();
}

function normalizeSymbolOperators(expression: string) {
  return expression
    .replace(/(?<=\d|\)|%|[$€£¥₽])\s*[x×]\s*(?=\d|\(|[$€£¥₽])/g, " * ")
    .replace(/\b[x×]\b(?=\s*[\d($€£¥₽-])/g, "*");
}

function normalizeCurrencyTokens(expression: string) {
  let normalized = expression;
  const codePattern = KNOWN_CURRENCY_CODES.join("|");

  normalized = normalized.replace(
    new RegExp(
      `([$€£¥₽])\\s*(-?\\d+(?:\\.\\d+)?)\\s*(${codePattern})\\b`,
      "gi"
    ),
    (_match, _symbol: string, amount: string, code: string) =>
      `${amount} ${code.toUpperCase()}`
  );

  normalized = normalized.replace(
    /([$€£¥₽])\s*(-?\d+(?:\.\d+)?)/g,
    (match, symbol: string, amount: string) => {
      const currencyCode = CURRENCY_SYMBOL_ALIASES.get(symbol);

      if (!currencyCode) {
        return match;
      }

      return `${amount} ${currencyCode}`;
    }
  );

  normalized = normalized.replace(
    new RegExp(`(-?\\d+(?:\\.\\d+)?)(${codePattern})\\b`, "gi"),
    (_match, amount: string, code: string) => `${amount} ${code.toUpperCase()}`
  );

  const aliasEntries = [...CURRENCY_NAME_ALIASES.entries()].sort(
    (left, right) => right[0].length - left[0].length
  );

  for (const [phrase, code] of aliasEntries) {
    const safePhrase = escapeRegExp(phrase);
    normalized = normalized.replace(
      new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s+${safePhrase}\\b`, "gi"),
      (_match, amount: string) => `${amount} ${code}`
    );
  }

  for (const [phrase, code] of aliasEntries) {
    const safePhrase = escapeRegExp(phrase);
    normalized = normalized.replace(
      new RegExp(`\\b${safePhrase}\\b`, "gi"),
      code
    );
  }

  for (const [symbol, code] of CURRENCY_SYMBOL_ALIASES.entries()) {
    normalized = normalized.replace(
      new RegExp(
        `(^|[\\s([\\]{}:,;+\\-*/])${escapeRegExp(symbol)}(?=$|[\\s)\\]{}:,;+\\-*/])`,
        "g"
      ),
      (_match, prefix: string) => `${prefix}${code}`
    );
  }

  normalized = normalized.replace(
    new RegExp(`\\b(${codePattern})\\s+(-?\\d+(?:\\.\\d+)?)\\b`, "gi"),
    (_match, code: string, amount: string) => `${amount} ${code.toUpperCase()}`
  );

  return normalized;
}

function normalizeUnitAliases(expression: string) {
  let normalized = expression;
  const aliasEntries = [...UNIT_NAME_ALIASES.entries()].sort(
    (left, right) => right[0].length - left[0].length
  );

  for (const [phrase, unit] of aliasEntries) {
    normalized = normalized.replace(
      new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "gi"),
      unit
    );
  }

  return normalized;
}

function normalizeConversionOperators(expression: string) {
  let normalized = expression;

  for (const [phrase, replacement] of CONVERSION_OPERATOR_ALIASES.entries()) {
    const pattern =
      phrase === "in"
        ? /\bin\b(?=\s+[A-Za-z€£¥₽$])/gi
        : new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "gi");
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized;
}

function normalizeFunctionAliases(expression: string) {
  let normalized = expression;

  normalized = normalized.replace(
    /^root\s+(.+?)\s*\((.+)\)$/i,
    (_match, degree: string, value: string) =>
      `root(${value.trim()}, ${degree.trim()})`
  );

  normalized = normalized.replace(
    /^log\s+(.+?)\s*\((.+)\)$/i,
    (_match, base: string, value: string) =>
      `log(${value.trim()}, ${base.trim()})`
  );

  const unaryMatch = normalized.match(/^([A-Za-z]+)\s+(.+)$/);
  const unaryFunction = unaryMatch?.[1]?.toLowerCase() ?? null;
  const argument = unaryMatch?.[2]?.trim() ?? null;

  if (!unaryFunction || !argument) {
    return normalized;
  }

  const mappedName = UNARY_FUNCTION_ALIASES.get(unaryFunction);

  if (!mappedName) {
    return normalized;
  }

  return `${mappedName}(${argument})`;
}

function normalizeMixedUnitArithmetic(expression: string) {
  const conversionMatch = expression.match(/^(.+?)\s+to\s+(.+)$/i);

  if (!conversionMatch) {
    return normalizeTrailingPercentageAdjustment(
      insertImplicitMeasurementAddition(expression)
    );
  }

  const source = normalizeTrailingPercentageAdjustment(
    insertImplicitMeasurementAddition(conversionMatch[1] ?? "")
  );
  const target = conversionMatch[2]?.trim() ?? "";
  const splitTarget = splitConversionTarget(target);
  const conversionExpression =
    source === (conversionMatch[1] ?? "").trim()
      ? `${source} to ${splitTarget.targetUnit}`.trim()
      : `(${source}) to ${splitTarget.targetUnit}`.trim();

  if (!splitTarget.trailingExpression) {
    return conversionExpression;
  }

  return `(${conversionExpression})${splitTarget.trailingExpression}`;
}

function insertImplicitMeasurementAddition(expression: string) {
  let normalized = expression.trim();

  normalized = normalized.replace(
    /(\b-?\d+(?:\.\d+)?\s+[A-Za-z][A-Za-z]*(?:\s+[A-Za-z][A-Za-z]*)?)\s+(?=-?\d+(?:\.\d+)?\s+[A-Za-z])/g,
    "$1 + "
  );

  return normalized.trim();
}

function splitConversionTarget(target: string) {
  const trailingExpressionMatch = target.match(
    /^(.+?)(\s+(?:[-+*/]|\bmod\b|\bxor\b|<<|>>|&|\|).+)$/i
  );

  if (!trailingExpressionMatch) {
    return {
      targetUnit: target,
      trailingExpression: "",
    };
  }

  return {
    targetUnit: trailingExpressionMatch[1]?.trim() ?? target,
    trailingExpression: trailingExpressionMatch[2] ?? "",
  };
}

function normalizePercentagePhrases(expression: string) {
  let normalized = expression;

  normalized = normalized.replace(
    /(-?\d+(?:\.\d+)?)%\s+of\s+what\s+is\s+(.+)/i,
    (_match, percent: string, value: string) =>
      `${value.trim()} / (${percent}%)`
  );

  normalized = normalized.replace(
    /(-?\d+(?:\.\d+)?)%\s+off\s+(.+)/i,
    (_match, percent: string, value: string) =>
      `${value.trim()} * (1 - ${percent}%)`
  );

  normalized = normalized.replace(
    /(-?\d+(?:\.\d+)?)%\s+on\s+(.+)/i,
    (_match, percent: string, value: string) =>
      `${value.trim()} * (1 + ${percent}%)`
  );

  normalized = normalized.replace(/% of /gi, "% * ");

  return normalized;
}

function normalizeTrailingPercentageAdjustment(expression: string) {
  const trimmed = expression.trim();

  const match = trimmed.match(/^(.+?)\s*([+-])\s*(-?\d+(?:\.\d+)?)%$/);

  if (!match?.[1] || !match[2] || !match[3]) {
    return trimmed;
  }

  const [_, baseExpression, operator, percent] = match;
  const adjustmentOperator = operator === "+" ? "+" : "-";

  return `((${baseExpression.trim()}) * (1 ${adjustmentOperator} ${percent}%))`;
}

function normalizeWordOperators(expression: string) {
  let normalized = expression;
  const aliasEntries = [...WORD_OPERATOR_ALIASES.entries()].sort(
    (left, right) => right[0].length - left[0].length
  );

  for (const [phrase, replacement] of aliasEntries) {
    normalized = normalized.replace(
      new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "gi"),
      replacement
    );
  }

  return normalized;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
