import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appStyles = readFileSync(resolve(import.meta.dir, "./app.css"), "utf8");
const sheetEditorSource = readFileSync(
  resolve(import.meta.dir, "../components/SheetEditor.tsx"),
  "utf8"
);

describe("result hover styling", () => {
  test("uses a content-sized hover chip with equal padding and a subtle same-hue stroke", () => {
    expect(appStyles).toMatch(
      /\.linea-result-button\s*\{[\s\S]*padding:\s*0\.35rem;/
    );
    expect(appStyles).toMatch(
      /\.linea-result-button:hover\s*\{[\s\S]*background:\s*color-mix\(in oklab,\s*currentColor 10%, transparent\);[\s\S]*box-shadow:\s*inset 0 0 0 0\.5px[\s\S]*color-mix\(in oklab,\s*currentColor 18%, transparent\);/
    );
  });

  test("does not animate result text position on hover", () => {
    expect(appStyles).not.toMatch(
      /\.linea-result-button:hover\s*\{[\s\S]*transform:/
    );
    expect(appStyles).not.toMatch(
      /\.linea-result-button\s*\{[\s\S]*transition:[\s\S]*transform/
    );
  });

  test("shows the hover chip instantly on hover-in while keeping the fade on hover-out", () => {
    expect(appStyles).toMatch(
      /\.linea-result-button\s*\{[\s\S]*transition:\s*background-color 140ms ease, box-shadow 140ms ease;/
    );
    expect(appStyles).toMatch(
      /\.linea-result-button:hover\s*\{[\s\S]*transition-duration:\s*0ms;/
    );
  });

  test("uses a stronger pressed and open highlight than hover", () => {
    expect(appStyles).toMatch(
      /\.linea-result-button:active,\s*\.linea-result-button\[data-state="open"\]\s*\{[\s\S]*background:\s*color-mix\(in oklab,\s*currentColor 16%, transparent\);[\s\S]*box-shadow:\s*inset 0 0 0 0\.5px[\s\S]*color-mix\(in oklab,\s*currentColor 28%, transparent\);/
    );
    expect(appStyles).toMatch(
      /\.linea-result-button:active,\s*\.linea-result-button\[data-state="open"\]\s*\{[\s\S]*transition-duration:\s*0ms;/
    );
  });

  test("renders copyable results as content-width buttons aligned by a separate row wrapper", () => {
    expect(sheetEditorSource).toMatch(/className=\{resultClassName\(line\)\}/);
    const copyResultButtonClassNameMatch = sheetEditorSource.match(
      /aria-label=\{`Copy result \$\{displayValue\}`\}\s+className="([^"]+)"/
    );

    expect(copyResultButtonClassNameMatch).not.toBeNull();

    const copyResultButtonClassName = copyResultButtonClassNameMatch?.[1] ?? "";
    const copyResultButtonClasses = copyResultButtonClassName.split(/\s+/);

    expect(copyResultButtonClasses).toContain("linea-result-button");
    expect(copyResultButtonClasses).toContain("cursor-pointer");
    expect(copyResultButtonClasses).toContain("border-0");
    expect(copyResultButtonClasses).toContain("bg-transparent");
    expect(copyResultButtonClasses).toContain("font-mono");
    expect(copyResultButtonClasses).not.toContain("w-full");
  });

  test("reuses the interactive result-chip affordances for the rounded detail trigger", () => {
    expect(sheetEditorSource).toMatch(
      /className="linea-result-button[\s\S]*cursor-pointer[\s\S]*rounded-full[\s\S]*border-0[\s\S]*bg-transparent[\s\S]*text-muted-foreground[\s\S]*hover:text-foreground[\s\S]*active:text-foreground[\s\S]*data-\[state=open\]:text-foreground[\s\S]*focus-visible:outline-none/
    );
    expect(appStyles).toMatch(
      /\.linea-result-button:active,\s*\.linea-result-button\[data-state="open"\]\s*\{[\s\S]*background:\s*color-mix\(in oklab,\s*currentColor 16%, transparent\);[\s\S]*box-shadow:\s*inset 0 0 0 0\.5px[\s\S]*color-mix\(in oklab,\s*currentColor 28%, transparent\);/
    );
  });
});
