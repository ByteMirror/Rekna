import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appStyles = readFileSync(resolve(import.meta.dir, "./app.css"), "utf8");
const overlaySource = readFileSync(
  resolve(import.meta.dir, "../components/CompletionOverlayApp.tsx"),
  "utf8"
);

describe("completion overlay scrolling", () => {
  test("caps the visible list height and makes long completion lists scrollable", () => {
    expect(appStyles).toMatch(
      /\.linea-completion-overlay-list\s*\{[\s\S]*max-height:\s*var\(--linea-completion-list-max-height,\s*320px\);/
    );
    expect(appStyles).toMatch(
      /\.linea-completion-overlay-list\s*\{[\s\S]*overflow-y:\s*auto;/
    );
  });

  test("keeps the selected completion in view while navigating a long list", () => {
    expect(overlaySource).toMatch(/scrollIntoView\(\{\s*block:\s*"nearest"\s*\}\)/);
  });
});
