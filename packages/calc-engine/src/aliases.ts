export const CURRENCY_NAME_ALIASES = new Map<string, string>([
  ["australian dollar", "AUD"],
  ["australian dollars", "AUD"],
  ["british pound", "GBP"],
  ["british pounds", "GBP"],
  ["cad", "CAD"],
  ["canadian dollar", "CAD"],
  ["canadian dollars", "CAD"],
  ["chf", "CHF"],
  ["cny", "CNY"],
  ["dollar", "USD"],
  ["dollars", "USD"],
  ["eth", "ETH"],
  ["eur", "EUR"],
  ["euro", "EUR"],
  ["euros", "EUR"],
  ["gbp", "GBP"],
  ["hkd", "HKD"],
  ["jpy", "JPY"],
  ["rub", "RUB"],
  ["ruble", "RUB"],
  ["rubles", "RUB"],
  ["rouble", "RUB"],
  ["roubles", "RUB"],
  ["russian ruble", "RUB"],
  ["russian rubles", "RUB"],
  ["usd", "USD"],
  ["us dollar", "USD"],
  ["us dollars", "USD"],
]);

export const CURRENCY_SYMBOL_ALIASES = new Map<string, string>([
  ["$", "USD"],
  ["€", "EUR"],
  ["£", "GBP"],
  ["¥", "JPY"],
  ["₽", "RUB"],
]);

export const UNIT_NAME_ALIASES = new Map<string, string>([
  ["tea spoon", "teaspoon"],
  ["tea spoons", "teaspoon"],
  ["teaspoon", "teaspoon"],
  ["teaspoons", "teaspoon"],
  ["table spoon", "tablespoon"],
  ["table spoons", "tablespoon"],
  ["tablespoon", "tablespoon"],
  ["tablespoons", "tablespoon"],
]);

export const UNARY_FUNCTION_ALIASES = new Map<string, string>([
  ["abs", "abs"],
  ["arccos", "acos"],
  ["arcsin", "asin"],
  ["arctan", "atan"],
  ["cbrt", "cbrt"],
  ["ceil", "ceil"],
  ["cos", "cos"],
  ["cosh", "cosh"],
  ["fact", "factorial"],
  ["factorial", "factorial"],
  ["floor", "floor"],
  ["ln", "log"],
  ["round", "round"],
  ["sin", "sin"],
  ["sinh", "sinh"],
  ["sqrt", "sqrt"],
  ["tan", "tan"],
  ["tanh", "tanh"],
]);

export const WORD_OPERATOR_ALIASES = new Map<string, string>([
  ["plus", "+"],
  ["minus", "-"],
  ["subtract", "-"],
  ["without", "-"],
  ["times", "*"],
  ["multiplied by", "*"],
  ["mul", "*"],
  ["divide by", "/"],
  ["divided by", "/"],
  ["divide", "/"],
  ["and", "+"],
  ["with", "+"],
  ["mod", "mod"],
  ["xor", "xor"],
]);

export const CONVERSION_OPERATOR_ALIASES = new Map<string, string>([
  ["into", "to"],
  ["as", "to"],
  ["in", "to"],
]);

export const BUILTIN_FUNCTION_NAMES = new Set([
  ...UNARY_FUNCTION_ALIASES.keys(),
  "fromunix",
  "log",
  "now",
  "root",
  "time",
]);

export const OPERATOR_ALIAS_WORDS = new Set(
  [...WORD_OPERATOR_ALIASES.keys()].flatMap((phrase) =>
    phrase.split(/\s+/).map((part) => part.toLowerCase())
  )
);

export const CONVERSION_ALIAS_WORDS = new Set(
  [...CONVERSION_OPERATOR_ALIASES.keys()].map((phrase) => phrase.toLowerCase())
);

export const MULTI_WORD_UNIT_ALIAS_PHRASES = [...UNIT_NAME_ALIASES.keys()]
  .filter((phrase) => /\s/.test(phrase))
  .sort((left, right) => right.length - left.length);

export const KNOWN_CURRENCY_CODES = [
  "AUD",
  "BTC",
  "CAD",
  "CHF",
  "CNY",
  "ETH",
  "EUR",
  "GBP",
  "HKD",
  "JPY",
  "RUB",
  "USD",
] as const;

export const KNOWN_CURRENCY_SYMBOLS = new Set(CURRENCY_SYMBOL_ALIASES.keys());
