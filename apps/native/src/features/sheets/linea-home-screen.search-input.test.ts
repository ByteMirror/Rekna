import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("linea-home-screen search input", () => {
  test("suppresses the native Android focus underline for quick find", () => {
    const source = readFileSync(
      new URL("./linea-home-screen.tsx", import.meta.url).pathname,
      "utf8"
    );

    expect(source).toContain('placeholder="Quick Find"');
    expect(source).toContain('underlineColorAndroid="transparent"');
  });
});
