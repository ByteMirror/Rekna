import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("linea-home-screen native cursor", () => {
  test("uses the platform TextInput caret instead of a custom overlay", () => {
    const source = readFileSync(
      new URL("./linea-home-screen.tsx", import.meta.url).pathname,
      "utf8"
    );

    expect(source).not.toContain("caretHidden");
    expect(source).not.toContain("styles.customCaret");
    expect(source).not.toContain("getCustomCaretLayout");
  });
});
