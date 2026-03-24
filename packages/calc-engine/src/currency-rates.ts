import type { MathJsInstance } from "mathjs";

const DEFAULT_BASE_CURRENCY = "USD";
const DEFAULT_CURRENCY_RATES_URL = "https://open.er-api.com/v6/latest/USD";
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type CurrencyRates = {
  base: string;
  rates: Record<string, number>;
};

export type CurrencyRateProvider = () => Promise<CurrencyRates>;

export function createCurrencyRateProvider(
  options: {
    cacheTtlMs?: number;
    fetchFn?: typeof fetch;
    url?: string;
  } = {}
): CurrencyRateProvider {
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const url = options.url ?? DEFAULT_CURRENCY_RATES_URL;
  let cachedRates: CurrencyRates | null = null;
  let cachedAt = 0;

  return async () => {
    if (cachedRates && Date.now() - cachedAt < cacheTtlMs) {
      return cachedRates;
    }

    const fetchFn = options.fetchFn ?? globalThis.fetch;
    const response = await fetchFn(url);

    if (!response.ok) {
      throw new Error(`Currency rates request failed with ${response.status}`);
    }

    const payload = (await response.json()) as {
      base?: string;
      base_code?: string;
      rates?: Record<string, number>;
    };

    const base =
      payload.base?.toUpperCase() ??
      payload.base_code?.toUpperCase() ??
      DEFAULT_BASE_CURRENCY;
    const rates = payload.rates ?? {};

    if (typeof rates[base] !== "number") {
      rates[base] = 1;
    }

    cachedRates = {
      base,
      rates,
    };
    cachedAt = Date.now();

    return cachedRates;
  };
}

export function installCurrencyUnits(
  math: MathJsInstance,
  currencyRates: CurrencyRates
) {
  try {
    math.createUnit(
      "CUR",
      {},
      {
        override: true,
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Currency unit setup failed";

    if (!message.includes("base unit with that name already exists")) {
      throw error;
    }
  }

  math.createUnit(currencyRates.base, "1 CUR", {
    override: true,
  });

  for (const [code, rate] of Object.entries(currencyRates.rates)) {
    if (!Number.isFinite(rate) || rate <= 0) {
      continue;
    }

    math.createUnit(code.toUpperCase(), `${1 / rate} CUR`, {
      override: true,
    });
  }
}
