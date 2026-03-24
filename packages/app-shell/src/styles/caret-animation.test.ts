import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appStyles = readFileSync(resolve(import.meta.dir, "./app.css"), "utf8");

describe("caret animation styling", () => {
  test("uses a gradual fade-in curve instead of snapping straight back to full opacity", () => {
    expect(appStyles).toMatch(/@keyframes linea-caret-blink\s*\{/);
    expect(appStyles).toMatch(/0%,\s*16%\s*\{[\s\S]*opacity:\s*0\.18;/);
    expect(appStyles).toMatch(/28%\s*\{[\s\S]*opacity:\s*0\.34;/);
    expect(appStyles).toMatch(/40%\s*\{[\s\S]*opacity:\s*0\.64;/);
    expect(appStyles).toMatch(/52%\s*\{[\s\S]*opacity:\s*0\.86;/);
    expect(appStyles).toMatch(/62%,\s*72%\s*\{[\s\S]*opacity:\s*1;/);
    expect(appStyles).toMatch(/88%\s*\{[\s\S]*opacity:\s*0\.52;/);
    expect(appStyles).toMatch(/100%\s*\{[\s\S]*opacity:\s*0\.18;/);
  });
});
