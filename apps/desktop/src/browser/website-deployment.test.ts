import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = "/Users/fabian.urbanek/Github/Linea";
const browserRoot = resolve(repoRoot, "apps/desktop/src/browser");
const indexHtmlPath = resolve(browserRoot, "index.html");
const rootVercelConfigPath = resolve(repoRoot, "vercel.json");
const packageJsonPath = resolve(repoRoot, "package.json");
const publicDir = resolve(browserRoot, "public");

describe("Website deployment", () => {
  test("declares production metadata and stable social assets", () => {
    const html = readFileSync(indexHtmlPath, "utf8");

    expect(html).toContain("<title>Rekna | Plain text. Exact totals.</title>");
    expect(html).toContain('name="description"');
    expect(html).toContain(
      'content="Rekna is a plain-text calculator for units, currencies, dates, and exact totals."'
    );
    expect(html).toContain('property="og:url" content="https://rekna.dev"');
    expect(html).toContain(
      'property="og:image" content="https://rekna.dev/rekna-og.png"'
    );
    expect(html).toContain('rel="canonical" href="https://rekna.dev"');
    expect(html).toContain('rel="icon" type="image/png" href="/rekna-icon.png"');
    expect(html).toContain(
      'rel="apple-touch-icon" href="/apple-touch-icon.png"'
    );

    expect(existsSync(resolve(publicDir, "rekna-icon.png"))).toBe(true);
    expect(existsSync(resolve(publicDir, "apple-touch-icon.png"))).toBe(true);
    expect(existsSync(resolve(publicDir, "rekna-og.png"))).toBe(true);
  });

  test("defines a Vercel production build from source control", () => {
    const config = JSON.parse(readFileSync(rootVercelConfigPath, "utf8")) as {
      buildCommand?: string;
      installCommand?: string;
      outputDirectory?: string;
      redirects?: Array<Record<string, unknown>>;
      rewrites?: Array<Record<string, unknown>>;
    };
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["build:website"]).toBe("bun run build:renderer");
    expect(config.installCommand).toBe("bun install --frozen-lockfile");
    expect(config.buildCommand).toBe("bun run build:website");
    expect(config.outputDirectory).toBe("apps/desktop/dist");
    expect(config.redirects).toBeArray();
    expect(
      config.redirects?.some(
        (redirect) => redirect.destination === "https://rekna.dev/:path*"
      )
    ).toBe(true);
    expect(config.rewrites).toBeArray();
    expect(
      config.rewrites?.some(
        (rewrite) => rewrite.destination === "/index.html"
      )
    ).toBe(true);
  });
});
