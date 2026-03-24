import { describe, expect, test } from "bun:test";
import { Temporal } from "temporal-polyfill";

import { evaluateSheet } from "../src";

describe("evaluateSheet", () => {
  test("evaluates labeled arithmetic lines", async () => {
    const result = await evaluateSheet("Price: 10 + 5");

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.label).toBe("Price");
    expect(result.lines[0]?.displayValue).toBe("15");
  });

  test("supports variables, prev, sum, and avg with blank-line barriers", async () => {
    const result = await evaluateSheet(
      [
        "base = 10",
        "Line 1: base * 2",
        "Line 2: prev + 5",
        "Line 3: sum",
        "Line 4: avg",
        "",
        "Line 5: sum",
      ].join("\n")
    );

    expect(result.lines[1]?.displayValue).toBe("20");
    expect(result.lines[2]?.displayValue).toBe("25");
    expect(result.lines[3]?.displayValue).toBe("55");
    expect(result.lines[4]?.displayValue).toBe("27.5");
    expect(result.lines[6]?.displayValue).toBeNull();
  });

  test("ignores hashtag tag lines while preserving heading lines with a space", async () => {
    const result = await evaluateSheet(
      ["#travel #berlin", "# Revenue", "2 + 2"].join("\n")
    );

    expect(result.lines[0]?.kind).toBe("heading");
    expect(result.lines[0]?.label).toBe("travel #berlin");
    expect(result.lines[1]?.kind).toBe("heading");
    expect(result.lines[1]?.label).toBe("Revenue");
    expect(result.lines[2]?.displayValue).toBe("4");
  });

  test("shows the attached running sum for consecutive rows only", async () => {
    const result = await evaluateSheet(
      ["1", "2", "3", "sum", "", "sum"].join("\n")
    );

    expect(result.lines[0]?.displayValue).toBe("1");
    expect(result.lines[1]?.displayValue).toBe("2");
    expect(result.lines[2]?.displayValue).toBe("3");
    expect(result.lines[3]?.displayValue).toBe("6");
    expect(result.lines[5]?.displayValue).toBeNull();
  });

  test("includes assignment and computed rows in an attached sum block", async () => {
    const result = await evaluateSheet(
      ["a = 1", "b = 2", "a + b", "sum", "", "c = 4", "sum"].join("\n")
    );

    expect(result.lines[0]?.displayValue).toBe("1");
    expect(result.lines[1]?.displayValue).toBe("2");
    expect(result.lines[2]?.displayValue).toBe("3");
    expect(result.lines[3]?.displayValue).toBe("6");
    expect(result.lines[5]?.displayValue).toBe("4");
    expect(result.lines[6]?.displayValue).toBe("4");
  });

  test("supports percentage-of phrasing", async () => {
    const result = await evaluateSheet("Markup: 20% of 30");

    expect(result.lines[0]?.displayValue).toBe("6");
  });

  test("supports simple unit conversion phrasing", async () => {
    const result = await evaluateSheet("20 cm in m");

    expect(result.lines[0]?.displayValue).toBe("0.2 m");
  });

  test("supports shorthand functions and aliases", async () => {
    const result = await evaluateSheet(
      [
        "Square root: sqrt 16",
        "Round: round 3.45",
        "Factorial: fact 5",
        "Sine: sin 45°",
        "Log: log 2 (10)",
      ].join("\n")
    );

    expect(result.lines[0]?.displayValue).toBe("4");
    expect(result.lines[1]?.displayValue).toBe("3");
    expect(result.lines[2]?.displayValue).toBe("120");
    expect(result.lines[3]?.displayValue).toBe("0.70710678118655");
    expect(result.lines[4]?.displayValue).toBe("3.3219280948874");
  });

  test("supports mixed-unit arithmetic before conversion", async () => {
    const result = await evaluateSheet("1 meter 20 cm in cm");

    expect(result.lines[0]?.displayValue).toBe("120 cm");
  });

  test("supports currency conversion with exchange rates", async () => {
    const result = await evaluateSheet(
      ["Price: $30 in EUR", "Sum: $30 CAD + 5 USD - 7 EUR"].join("\n"),
      {
        currencyRateProvider: async () => ({
          base: "USD",
          rates: {
            CAD: 1.4,
            EUR: 0.9,
            USD: 1,
          },
        }),
      }
    );

    expect(result.lines[0]?.displayValue).toBe("27 EUR");
    expect(result.lines[1]?.displayValue).toBe("26.111111111111 CAD");
  });

  test("supports currency name aliases as conversion targets", async () => {
    const result = await evaluateSheet("Fee: 4GBP in Euro", {
      currencyRateProvider: async () => ({
        base: "USD",
        rates: {
          EUR: 0.9,
          GBP: 0.8,
          USD: 1,
        },
      }),
    });

    expect(result.lines[0]?.displayValue).toBe("4.5 EUR");
  });

  test("supports arithmetic after currency conversion", async () => {
    const result = await evaluateSheet("Fee: 30 EUR in USD - 4%", {
      currencyRateProvider: async () => ({
        base: "USD",
        rates: {
          EUR: 0.9,
          USD: 1,
        },
      }),
    });

    expect(result.lines[0]?.displayValue).toBe("32 USD");
  });

  test("supports aggregates combined with conversion and percentage arithmetic", async () => {
    const result = await evaluateSheet(
      ["10 EUR", "20 EUR", "sum in USD - 4%"].join("\n"),
      {
        currencyRateProvider: async () => ({
          base: "USD",
          rates: {
            EUR: 0.9,
            USD: 1,
          },
        }),
      }
    );

    expect(result.lines[2]?.displayValue).toBe("32 USD");
  });

  test("supports compact x multiplication with currency values", async () => {
    const result = await evaluateSheet("Price: $7x4", {
      currencyRateProvider: async () => ({
        base: "USD",
        rates: {
          USD: 1,
        },
      }),
    });

    expect(result.lines[0]?.displayValue).toBe("28 USD");
  });

  test("can carry rounded values into subsequent calculations when configured", async () => {
    const result = await evaluateSheet(
      ["1.004", "prev + 1.004", "sum"].join("\n"),
      {
        carryRoundedValues: true,
        precision: 2,
      }
    );

    expect(result.lines[0]?.displayValue).toBe("1");
    expect(result.lines[1]?.displayValue).toBe("2");
    expect(result.lines[2]?.displayValue).toBe("3");
  });

  test("supports dotted property assignments and lookups", async () => {
    const result = await evaluateSheet(
      ["subscriptions.Netflix = 15", "subscriptions.Netflix"].join("\n")
    );

    expect(result.lines[0]?.displayValue).toBe("15");
    expect(result.lines[1]?.displayValue).toBe("15");
  });

  test("creates nested objects for dotted property assignments", async () => {
    const result = await evaluateSheet(
      [
        "subscriptions.streaming.Netflix = 15 USD",
        "subscriptions.streaming.Netflix",
      ].join("\n"),
      {
        currencyRateProvider: async () => ({
          base: "USD",
          rates: {
            USD: 1,
          },
        }),
      }
    );

    expect(result.lines[0]?.displayValue).toBe("15 USD");
    expect(result.lines[1]?.displayValue).toBe("15 USD");
  });

  test("formats object values with mixed property types", async () => {
    const result = await evaluateSheet(
      [
        'subscriptions = { name: "Netflix", active: true, tags: ["video", "tv"], price: 15 USD }',
        "subscriptions.name",
        "subscriptions.active",
        "subscriptions.tags[2]",
        "subscriptions.price",
      ].join("\n"),
      {
        currencyRateProvider: async () => ({
          base: "USD",
          rates: {
            USD: 1,
          },
        }),
      }
    );

    expect(result.lines[0]?.displayValue).toBe("Object");
    expect(result.lines[1]?.displayValue).toBe("Netflix");
    expect(result.lines[2]?.displayValue).toBe("true");
    expect(result.lines[3]?.displayValue).toBe("tv");
    expect(result.lines[4]?.displayValue).toBe("15 USD");
  });

  test("supports multiline object blocks with mixed property types", async () => {
    const result = await evaluateSheet(
      [
        "subscriptions = {",
        '  name: "Netflix",',
        "  active: true,",
        '  tags: ["video", "tv"],',
        "  price: 15 USD",
        "}",
        "subscriptions.price",
        "subscriptions.tags[2]",
      ].join("\n"),
      {
        currencyRateProvider: async () => ({
          base: "USD",
          rates: {
            USD: 1,
          },
        }),
      }
    );

    expect(result.lines[0]?.displayValue).toBe("Object");
    expect(result.lines[1]?.displayValue).toBe("Netflix");
    expect(result.lines[2]?.displayValue).toBe("true");
    expect(result.lines[3]?.displayValue).toBe('["video", "tv"]');
    expect(result.lines[4]?.displayValue).toBe("15 USD");
    expect(result.lines[5]?.displayValue).toBeNull();
    expect(result.lines[6]?.displayValue).toBe("15 USD");
    expect(result.lines[7]?.displayValue).toBe("tv");
  });

  test("supports aggregate result rows inside multiline object blocks", async () => {
    const result = await evaluateSheet(
      [
        "recurring = {",
        "  vwLeasing: 345.06",
        "  repayment: 349.32",
        "  fitnessGuxhagen: 88.99",
        "  netflix: 19.99",
        "  openAI: 20.40",
        "  obsidian: 10.34",
        "  beacon: 5.17",
        "  primeVideo: 11.99",
        "  apple: 9.99",
        "  hukCoburg: 18.12",
        "  sum",
        "}",
      ].join("\n")
    );

    expect(result.lines[0]?.displayValue).toBe("Object");
    expect(result.lines[1]?.displayValue).toBe("345.06");
    expect(result.lines[10]?.displayValue).toBe("18.12");
    expect(result.lines[11]?.displayValue).toBe("879.37");
    expect(result.lines[12]?.displayValue).toBeNull();
  });

  test("supports block namespace syntax without an equals sign", async () => {
    const result = await evaluateSheet(
      [
        "subscriptions {",
        "  netflix = 10",
        "  amazon = 15",
        "  disney = 8.99",
        "}",
        "subscriptions.netflix",
      ].join("\n")
    );

    expect(result.lines[0]?.displayValue).toBe("Object");
    expect(result.lines[1]?.displayValue).toBe("10");
    expect(result.lines[2]?.displayValue).toBe("15");
    expect(result.lines[3]?.displayValue).toBe("8.99");
    expect(result.lines[4]?.displayValue).toBeNull();
    expect(result.lines[5]?.displayValue).toBe("10");
  });

  test("supports aggregate functions inside namespace blocks and exposes them afterward", async () => {
    const result = await evaluateSheet(
      [
        "subscriptions {",
        "  netflix = 10",
        "  amazon = 15",
        "  disney = 8.99",
        "  total = sum",
        "}",
        "subscriptions.total",
      ].join("\n")
    );

    expect(result.lines[0]?.displayValue).toBe("Object");
    expect(result.lines[1]?.displayValue).toBe("10");
    expect(result.lines[2]?.displayValue).toBe("15");
    expect(result.lines[3]?.displayValue).toBe("8.99");
    expect(result.lines[4]?.displayValue).toBe("33.99");
    expect(result.lines[5]?.displayValue).toBeNull();
    expect(result.lines[6]?.displayValue).toBe("33.99");
  });

  test("collects exported symbols from a sheet", async () => {
    const result = await evaluateSheet(
      [
        "subscriptions {",
        "  netflix = 10",
        "  amazon = 15",
        "  total = sum",
        "}",
        "Export subscriptions",
        "Export subscriptions.total",
      ].join("\n")
    );

    expect(result.lines[5]?.displayValue).toBe("Object");
    expect(result.lines[6]?.displayValue).toBe("25");
    expect(result.exportedSymbols.subscriptions).toBeDefined();
    expect(result.exportedSymbols["subscriptions.total"]).toBe(25);
  });

  test("imports exported symbols into another sheet", async () => {
    const source = await evaluateSheet(
      [
        "subscriptions {",
        "  netflix = 10",
        "  amazon = 15",
        "  total = sum",
        "}",
        "Export subscriptions",
      ].join("\n")
    );

    const imported = await evaluateSheet(
      ["Import subscriptions", "subscriptions.total"].join("\n"),
      {
        importedSymbols: source.exportedSymbols,
      }
    );

    expect(imported.lines[0]?.displayValue).toBe("Object");
    expect(imported.lines[1]?.displayValue).toBe("25");
  });

  test("supports arithmetic on imported currency object values when carry-rounded mode is enabled", async () => {
    const source = await evaluateSheet(
      [
        "recurring {",
        "  fitnessGuxhagen = 66.99 EUR",
        "  netflix = 19.99 EUR",
        "  openAI = 20.40 EUR",
        "  added = sum",
        "}",
        "Export recurring",
      ].join("\n"),
      {
        currencyRateProvider: async () => ({
          base: "EUR",
          rates: {
            EUR: 1,
          },
        }),
      }
    );

    const imported = await evaluateSheet(
      [
        "Import recurring",
        "Price: recurring.added x 4",
        "5% of recurring.added",
        "netflixyearly: recurring.netflix x 12",
        "openAIwithtax: recurring.openAI + 19%",
      ].join("\n"),
      {
        carryRoundedValues: true,
        currencyRateProvider: async () => ({
          base: "EUR",
          rates: {
            EUR: 1,
          },
        }),
        importedSymbols: source.exportedSymbols,
        precision: 2,
      }
    );

    expect(imported.lines[1]?.displayValue).toBe("430 EUR");
    expect(imported.lines[2]?.displayValue).toBe("5 EUR");
    expect(imported.lines[3]?.displayValue).toBe("240 EUR");
    expect(imported.lines[4]?.displayValue).toBe("24 EUR");
  });

  test("supports round() on imported currency object values without explicit currency tokens", async () => {
    const source = await evaluateSheet(
      [
        "recurring {",
        "  netflix = 19.99 EUR",
        "  added = sum",
        "}",
        "Export recurring",
      ].join("\n"),
      {
        currencyRateProvider: async () => ({
          base: "EUR",
          rates: {
            EUR: 1,
          },
        }),
      }
    );

    const imported = await evaluateSheet(
      ["Import recurring", "Rounded: round(recurring.added)"].join("\n"),
      {
        currencyRateProvider: async () => ({
          base: "EUR",
          rates: {
            EUR: 1,
          },
        }),
        importedSymbols: source.exportedSymbols,
      }
    );

    expect(imported.lines[1]?.displayValue).toBe("20 EUR");
  });

  test("collects multiple exported symbols from one export statement", async () => {
    const result = await evaluateSheet(
      [
        "subscriptions {",
        "  netflix = 10",
        "  amazon = 15",
        "  total = sum",
        "}",
        "tax = 5",
        "Export subscriptions, tax",
      ].join("\n")
    );

    expect(result.lines[6]?.kind).toBe("expression");
    expect(result.exportedSymbols.subscriptions).toBeDefined();
    expect(result.exportedSymbols["subscriptions.total"]).toBe(25);
    expect(result.exportedSymbols.tax).toBe(5);
  });

  test("imports multiple exported symbols from one import statement", async () => {
    const source = await evaluateSheet(
      [
        "subscriptions {",
        "  netflix = 10",
        "  amazon = 15",
        "  total = sum",
        "}",
        "tax = 5",
        "Export subscriptions, tax",
      ].join("\n")
    );

    const imported = await evaluateSheet(
      ["Import subscriptions, tax", "subscriptions.total + tax"].join("\n"),
      {
        importedSymbols: source.exportedSymbols,
      }
    );

    expect(imported.lines[0]?.kind).toBe("expression");
    expect(imported.lines[1]?.displayValue).toBe("30");
  });

  test("supports explicit time-zone conversion phrasing", async () => {
    const result = await evaluateSheet("2026-03-22 2:30 pm HKT in Berlin");

    expect(result.lines[0]?.displayValue).toBe("26/03/22 07:30 CET");
  });

  test("uses compact time-zone abbreviations for live time lookups", async () => {
    const result = await evaluateSheet("Berlin time", {
      now: () => Temporal.Instant.from("2026-03-22T06:30:00Z"),
    });

    expect(result.lines[0]?.displayValue).toBe("07:30 CET");
  });

  test("supports relative today date arithmetic", async () => {
    const result = await evaluateSheet("today + 17 days", {
      now: () => Temporal.Instant.from("2026-03-22T06:30:00Z"),
    });

    expect(result.lines[0]?.displayValue).toBe("26/04/08");
  });

  test("supports word operator aliases in relative today date arithmetic", async () => {
    const result = await evaluateSheet("today plus 17 days", {
      now: () => Temporal.Instant.from("2026-03-22T06:30:00Z"),
    });

    expect(result.lines[0]?.displayValue).toBe("26/04/08");
  });

  test("supports relative tomorrow date arithmetic", async () => {
    const result = await evaluateSheet("tomorrow + 2 weeks", {
      now: () => Temporal.Instant.from("2026-03-22T06:30:00Z"),
    });

    expect(result.lines[0]?.displayValue).toBe("26/04/06");
  });

  test("supports standalone tomorrow date lookups", async () => {
    const result = await evaluateSheet("tomorrow", {
      now: () => Temporal.Instant.from("2026-03-22T06:30:00Z"),
    });

    expect(result.lines[0]?.displayValue).toBe("26/03/23");
  });

  test("treats standalone currency symbols as aliases of currency codes", async () => {
    const result = await evaluateSheet("30 dollars in €", {
      currencyRateProvider: async () => ({
        base: "USD",
        rates: {
          EUR: 0.9,
          USD: 1,
        },
      }),
    });

    expect(result.lines[0]?.displayValue).toBe("27 EUR");
  });

  test("formats unix timestamps with the international date style", async () => {
    const result = await evaluateSheet("fromunix(1446587186)");

    expect(result.lines[0]?.displayValue).toMatch(
      /^\d{2}\/\d{2}\/\d{2} \d{2}:\d{2} /
    );
  });

  test("supports tea spoon aliases in unit conversion", async () => {
    const result = await evaluateSheet("20 ml in tea spoons");

    expect(result.lines[0]?.displayValue).toBe("4 tsp");
  });

  test("supports reverse percentage phrasing with units", async () => {
    const result = await evaluateSheet("20% of what is 30 cm");

    expect(result.lines[0]?.displayValue).toBe("150 cm");
  });

  test("supports percentage arithmetic inside grouped unit conversion expressions", async () => {
    const result = await evaluateSheet("(25 cm x 6 + 5%) in m");

    expect(result.lines[0]?.displayValue).toBe("1.575 m");
  });
});
