import { describe, expect, test } from "bun:test";
import { Temporal } from "temporal-polyfill";

import { evaluateSheet } from "../src";

describe("demo-worthy sheet scenarios", () => {
  test("showcases a freelance consultant planning software costs and a client kickoff", async () => {
    const result = await evaluateSheet(
      [
        "studio {",
        "  figma = 16 EUR",
        "  notion = 10 EUR",
        "  openAI = 20 EUR",
        "  zoom = 14 EUR",
        "  total = sum",
        "}",
        "Annual tools: studio.total x 12",
        "Retainer with tax: 1500 EUR + 19%",
        "Kickoff: tomorrow + 2 weeks",
        "New York client call: 2026-04-06 4:00 pm Berlin in New York",
      ].join("\n"),
      {
        currencyRateProvider: createDemoCurrencyRateProvider,
        now: () => Temporal.Instant.from("2026-03-22T06:30:00Z"),
      },
    );

    expect(result.lines[0]?.displayValue).toBe("Object");
    expect(result.lines[4]?.displayValue).toBe("14 EUR");
    expect(result.lines[5]?.displayValue).toBe("60 EUR");
    expect(result.lines[7]?.displayValue).toBe("720 EUR");
    expect(result.lines[8]?.displayValue).toBe("1785 EUR");
    expect(result.lines[9]?.displayValue).toBe("26/04/06");
    expect(result.lines[10]?.displayValue).toBe("26/04/06 10:00 GMT-4");
  });

  test("showcases a finance-minded household planning recurring budget math", async () => {
    const result = await evaluateSheet(
      [
        "recurring {",
        "  rent = 1200 EUR",
        "  netflix = 20 EUR",
        "  openAI = 20 EUR",
        "  gym = 60 EUR",
        "  total = sum",
        "}",
        "Yearly recurring: recurring.total x 12",
        "Software with tax: recurring.openAI + 20%",
        "Left after salary: 3500 EUR - recurring.total",
      ].join("\n"),
      {
        currencyRateProvider: createDemoCurrencyRateProvider,
      },
    );

    expect(result.lines[0]?.displayValue).toBe("Object");
    expect(result.lines[5]?.displayValue).toBe("1300 EUR");
    expect(result.lines[7]?.displayValue).toBe("15600 EUR");
    expect(result.lines[8]?.displayValue).toBe("24 EUR");
    expect(result.lines[9]?.displayValue).toBe("2200 EUR");
  });

  test("showcases an operations manager reusing a travel budget across sheets", async () => {
    const source = await evaluateSheet(
      [
        "trip {",
        "  hotel = 120 EUR",
        "  meals = 45 EUR",
        "  metro = 15 EUR",
        "  total = sum",
        "}",
        "Export trip",
      ].join("\n"),
      {
        currencyRateProvider: createDemoCurrencyRateProvider,
      },
    );

    const result = await evaluateSheet(
      [
        "Import trip",
        "Trip total: trip.total",
        "Trip with buffer: trip.total + 10%",
        "Trip total in USD: trip.total in USD",
        "Daily budget: trip.total / 3",
      ].join("\n"),
      {
        currencyRateProvider: createDemoCurrencyRateProvider,
        importedSymbols: source.exportedSymbols,
      },
    );

    expect(result.lines[0]?.displayValue).toBe("Object");
    expect(result.lines[1]?.displayValue).toBe("180 EUR");
    expect(result.lines[2]?.displayValue).toBe("198 EUR");
    expect(result.lines[3]?.displayValue).toBe("198 USD");
    expect(result.lines[4]?.displayValue).toBe("60 EUR");
  });

  test("showcases a coach combining workouts with unit-aware conversions", async () => {
    const result = await evaluateSheet(
      [
        "training {",
        "  run = 5 km",
        "  ride = 24 km",
        "  swim = 750 m",
        "}",
        "Distance total: training.run + training.ride + training.swim in km",
        "Run in meters: training.run in m",
      ].join("\n"),
    );

    expect(result.lines[0]?.displayValue).toBe("Object");
    expect(result.lines[5]?.displayValue).toBe("29.75 km");
    expect(result.lines[6]?.displayValue).toBe("5000 m");
  });

  test("showcases a product manager planning dates and cross-time-zone calls", async () => {
    const result = await evaluateSheet(
      [
        "tomorrow + 2 weeks",
        "New York: 2026-04-06 4:00 pm Berlin in New York",
        "Hong Kong: 2026-04-06 4:00 pm Berlin in Hong Kong",
      ].join("\n"),
      {
        now: () => Temporal.Instant.from("2026-03-22T06:30:00Z"),
      },
    );

    expect(result.lines[0]?.displayValue).toBe("26/04/06");
    expect(result.lines[1]?.displayValue).toBe("26/04/06 10:00 GMT-4");
    expect(result.lines[2]?.displayValue).toBe("26/04/06 22:00 GMT+8");
  });
});

function createDemoCurrencyRateProvider() {
  return Promise.resolve({
    base: "EUR",
    rates: {
      EUR: 1,
      USD: 1.1,
    },
  });
}
