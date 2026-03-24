import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const browserRoot = "/Users/fabian.urbanek/Github/Linea/apps/desktop/src/browser";
const indexHtmlPath = resolve(browserRoot, "index.html");
const vercelConfigPath = "/Users/fabian.urbanek/Github/Linea/apps/desktop/vercel.website.json";
const publicDir = resolve(browserRoot, "public");

describe("Website metadata", () => {
  test("declares production metadata and stable social assets", () => {
    const html = readFileSync(indexHtmlPath, "utf8");

    expect(html).toContain("<title>Rekna | Plain text. Exact totals.</title>");
    expect(html).toContain('name="description"');
    expect(html).toContain('content="Rekna is a plain-text calculator for units, currencies, dates, and exact totals."');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:url" content="https://rekna.dev"');
    expect(html).toContain('property="og:image" content="https://rekna.dev/rekna-og.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('rel="canonical" href="https://rekna.dev"');
    expect(html).toContain('rel="icon" type="image/png" href="/rekna-icon.png"');
    expect(html).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"');

    expect(existsSync(resolve(publicDir, "rekna-icon.png"))).toBe(true);
    expect(existsSync(resolve(publicDir, "apple-touch-icon.png"))).toBe(true);
    expect(existsSync(resolve(publicDir, "rekna-og.png"))).toBe(true);
  });

  test("defines website hosting rules for vercel", () => {
    const config = JSON.parse(readFileSync(vercelConfigPath, "utf8")) as {
      redirects?: Array<Record<string, unknown>>;
      rewrites?: Array<Record<string, unknown>>;
    };

    expect(config.redirects).toBeArray();
    expect(config.redirects?.some((redirect) => redirect.destination === "https://rekna.dev/:path*")).toBe(true);
    expect(config.rewrites).toBeArray();
    expect(config.rewrites?.some((rewrite) => rewrite.destination === "/index.html")).toBe(true);
  });
});
