import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("desktop bootstrap", () => {
  test("does not keep an undefined database path debug log", () => {
    const source = readFileSync(
      "/Users/fabian.urbanek/Github/Linea/apps/desktop/src/bun/index.ts",
      "utf8"
    );

    expect(source).not.toContain("Database path: ${databasePath}");
  });

  test("does not keep temporary startup window logging", () => {
    const source = readFileSync(
      "/Users/fabian.urbanek/Github/Linea/apps/desktop/src/bun/index.ts",
      "utf8"
    );

    expect(source).not.toContain('console.log(`Window id: ${mainWindow.id}`);');
  });
});
