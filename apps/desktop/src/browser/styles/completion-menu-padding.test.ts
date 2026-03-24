import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appStyles = readFileSync(resolve(import.meta.dir, "./app.css"), "utf8");

describe("completion menu padding", () => {
  test("uses even padding for autocomplete row highlights in both menu implementations", () => {
    expect(appStyles).toMatch(
      /\.cm-tooltip\.cm-tooltip-autocomplete ul li\s*\{[\s\S]*padding:\s*0\.5rem;/
    );
    expect(appStyles).toMatch(
      /\.linea-completion-overlay-item\s*\{[\s\S]*padding:\s*0\.5rem;/
    );
  });

  test("adds matching inset to trailing detail text so row highlights look balanced", () => {
    expect(appStyles).toMatch(
      /\.cm-tooltip\.cm-tooltip-autocomplete ul li \.cm-completionDetail\s*\{[\s\S]*padding-inline-end:\s*0\.5rem;/
    );
    expect(appStyles).toMatch(
      /\.linea-completion-overlay-detail\s*\{[\s\S]*padding-inline-end:\s*0\.5rem;/
    );
  });

  test("uses even padding for the docs panels in both menu implementations", () => {
    expect(appStyles).toMatch(
      /\.linea-completion-info\s*\{[\s\S]*padding:\s*0\.875rem;/
    );
    expect(appStyles).toMatch(
      /\.linea-completion-overlay-info\s*\{[\s\S]*padding:\s*0\.875rem;/
    );
  });
});
