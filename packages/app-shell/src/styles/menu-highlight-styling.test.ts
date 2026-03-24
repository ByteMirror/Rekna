import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appStyles = readFileSync(resolve(import.meta.dir, "./app.css"), "utf8");
const dropdownMenuSource = readFileSync(
  resolve(import.meta.dir, "../components/ui/dropdown-menu.tsx"),
  "utf8"
);
const selectSource = readFileSync(
  resolve(import.meta.dir, "../components/ui/select.tsx"),
  "utf8"
);

function readRuleBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = appStyles.match(
    new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`)
  );

  if (!match) {
    throw new Error(`Expected CSS rule for ${selector}`);
  }

  return match[1];
}

describe("menu highlight styling", () => {
  test("defines dedicated neutral menu highlight tokens for both themes", () => {
    expect(appStyles).toMatch(/--color-menu-highlight:\s*var\(--menu-highlight\);/);
    expect(appStyles).toMatch(
      /--color-menu-highlight-foreground:\s*var\(--menu-highlight-foreground\);/
    );
    expect(appStyles).toMatch(
      /--color-menu-highlight-muted-foreground:\s*var\(\s*--menu-highlight-muted-foreground\s*\);/
    );
    expect(appStyles).toMatch(
      /:root\s*\{[\s\S]*--menu-highlight:\s*[^;]+;[\s\S]*--menu-highlight-foreground:\s*[^;]+;[\s\S]*--menu-highlight-muted-foreground:\s*[^;]+;/
    );
    expect(appStyles).toMatch(
      /\[data-theme="light"\]\s*\{[\s\S]*--menu-highlight:\s*[^;]+;[\s\S]*--menu-highlight-foreground:\s*[^;]+;[\s\S]*--menu-highlight-muted-foreground:\s*[^;]+;/
    );
  });

  test("keeps dropdown and select item highlights on neutral menu tokens", () => {
    expect(dropdownMenuSource).toMatch(/data-\[highlighted\]:bg-menu-highlight/);
    expect(dropdownMenuSource).toMatch(
      /data-\[highlighted\]:text-menu-highlight-foreground/
    );
    expect(dropdownMenuSource).not.toMatch(/data-\[highlighted\]:bg-accent/);
    expect(dropdownMenuSource).not.toMatch(
      /data-\[highlighted\]:text-accent-foreground/
    );

    expect(selectSource).toMatch(/data-\[highlighted\]:bg-menu-highlight/);
    expect(selectSource).toMatch(
      /data-\[highlighted\]:text-menu-highlight-foreground/
    );
    expect(selectSource).not.toMatch(/data-\[highlighted\]:bg-accent/);
    expect(selectSource).not.toMatch(
      /data-\[highlighted\]:text-accent-foreground/
    );
  });

  test("keeps autocomplete list highlights on neutral menu tokens", () => {
    const nativeSelectedRule = readRuleBlock(
      '.cm-tooltip.cm-tooltip-autocomplete ul li[aria-selected="true"]'
    );
    const overlaySelectedRule = readRuleBlock(
      '.linea-completion-overlay-item[aria-selected="true"]'
    );

    expect(nativeSelectedRule).toContain("background: var(--menu-highlight);");
    expect(nativeSelectedRule).toContain(
      "color: var(--menu-highlight-foreground);"
    );
    expect(nativeSelectedRule).not.toContain("var(--accent)");

    expect(overlaySelectedRule).toContain("background: var(--menu-highlight);");
    expect(overlaySelectedRule).toContain(
      "color: var(--menu-highlight-foreground);"
    );
    expect(overlaySelectedRule).not.toContain("var(--accent)");
    expect(appStyles).toMatch(/var\(--menu-highlight-muted-foreground\)/);
  });
});
