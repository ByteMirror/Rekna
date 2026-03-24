import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appStyles = readFileSync(resolve(import.meta.dir, "./app.css"), "utf8");
const dropdownMenuSource = readFileSync(
  resolve(import.meta.dir, "../components/ui/dropdown-menu.tsx"),
  "utf8"
);

describe("destructive menu styling", () => {
  test("defines dedicated destructive menu tokens for both themes", () => {
    expect(appStyles).toMatch(
      /--color-destructive-foreground:\s*var\(--destructive-foreground\);/
    );
    expect(appStyles).toMatch(
      /--color-destructive-surface:\s*var\(--destructive-surface\);/
    );
    expect(appStyles).toMatch(
      /:root\s*\{[\s\S]*--destructive-foreground:\s*[^;]+;[\s\S]*--destructive-surface:\s*[^;]+;/
    );
    expect(appStyles).toMatch(
      /\[data-theme="light"\]\s*\{[\s\S]*--destructive-foreground:\s*[^;]+;[\s\S]*--destructive-surface:\s*[^;]+;/
    );
  });

  test("uses the lighter destructive text token and stronger highlighted surface in dropdown items", () => {
    expect(dropdownMenuSource).toMatch(/text-destructive-foreground/);
    expect(dropdownMenuSource).toMatch(
      /data-\[highlighted\]:bg-destructive-surface/
    );
    expect(dropdownMenuSource).toMatch(
      /data-\[highlighted\]:text-destructive-foreground/
    );
    expect(dropdownMenuSource).not.toMatch(
      /data-\[highlighted\]:bg-destructive\/12/
    );
  });
});
