import { type MathType, all, create, isUnit } from "mathjs";

const math = create(all, {});
const UNIT_DISPLAY_ALIASES = new Map<string, string>([
  ["tablespoon", "tbsp"],
  ["teaspoon", "tsp"],
]);

export type MathValue = Exclude<MathType, string>;

export type ComputedValue =
  | {
      kind: "math";
      value: MathValue;
    }
  | {
      kind: "text";
      value: string;
    };

export function asMathValue(value: MathValue): ComputedValue {
  return {
    kind: "math",
    value,
  };
}

export function asTextValue(value: string): ComputedValue {
  return {
    kind: "text",
    value,
  };
}

export function formatComputedValue(value: ComputedValue | null) {
  if (!value) {
    return null;
  }

  if (value.kind === "text") {
    return value.value;
  }

  return formatDisplayValue(value.value);
}

export function isMathComputedValue(
  value: ComputedValue
): value is Extract<ComputedValue, { kind: "math" }> {
  return value.kind === "math";
}

export function formatDisplayValue(value: unknown) {
  return formatNestedValue(value, false);
}

function formatNestedValue(value: unknown, quoteStrings: boolean): string {
  if (typeof value === "number") {
    return formatNumber(value);
  }

  if (typeof value === "string") {
    return quoteStrings ? JSON.stringify(value) : value;
  }

  if (typeof value === "boolean" || value === null) {
    return String(value);
  }

  if (isUnit(value)) {
    const canonicalUnitName = value.formatUnits();
    const numericValue = value.toNumeric(canonicalUnitName);
    const displayUnitName =
      UNIT_DISPLAY_ALIASES.get(canonicalUnitName) ?? canonicalUnitName;

    return `${formatNumber(numericValue)} ${displayUnitName}`.trim();
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => formatNestedValue(item, true)).join(", ")}]`;
  }

  if (isPlainObject(value)) {
    return "Object";
  }

  if (typeof value === "object" && value && "toString" in value) {
    return String(value);
  }

  return String(value);
}

function formatObjectKey(key: string) {
  return /^[A-Za-z_]\w*$/.test(key) ? key : JSON.stringify(key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  if (isUnit(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function formatNumber(value: unknown) {
  return math.format(value as never, {
    lowerExp: -9,
    precision: 14,
    upperExp: 15,
  });
}
