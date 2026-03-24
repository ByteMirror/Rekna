import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("theme colors", () => {
  test("shared app theme tokens expose the requested accent colors", () => {
    const source = readFileSync(
      "/Users/fabian.urbanek/Github/Linea/packages/app-shell/src/styles/app.css",
      "utf8"
    );

    expect(source).toContain("--primary: #51938B;");
    expect(source).toContain("--accent: #51938B;");
    expect(source).toContain("--primary-foreground: #000000;");
    expect(source).toContain("--accent-foreground: #000000;");
    expect(source).toContain('--color-primary: var(--primary);');
    expect(source).toContain('--color-accent: var(--accent);');
    expect(source).toContain('[data-theme="light"] {');
    expect(source).toContain("--primary: #3D6F68;");
    expect(source).toContain("--accent: #3D6F68;");
    expect(source).toContain("--primary-foreground: #FCF7EF;");
    expect(source).toContain("--accent-foreground: #FCF7EF;");
  });
});
