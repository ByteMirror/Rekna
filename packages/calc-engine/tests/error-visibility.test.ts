import { describe, expect, test } from "bun:test";

import { evaluateSheet } from "../src";

describe("evaluateSheet error visibility", () => {
  test("suppresses visible output for incomplete or invalid expressions", async () => {
    const result = await evaluateSheet(
      ["su", "1 +", "unknownThing"].join("\n")
    );

    expect(result.lines[0]?.kind).toBe("error");
    expect(result.lines[0]?.displayValue).toBeNull();
    expect(result.lines[1]?.kind).toBe("error");
    expect(result.lines[1]?.displayValue).toBeNull();
    expect(result.lines[2]?.kind).toBe("error");
    expect(result.lines[2]?.displayValue).toBeNull();
  });

  test("suppresses visible output for bare function identifiers", async () => {
    const result = await evaluateSheet(["sqrt", "root"].join("\n"));

    expect(result.lines[0]?.kind).toBe("error");
    expect(result.lines[0]?.displayValue).toBeNull();
    expect(result.lines[1]?.kind).toBe("error");
    expect(result.lines[1]?.displayValue).toBeNull();
  });
});
