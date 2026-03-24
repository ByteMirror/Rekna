import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appStyles = readFileSync(resolve(import.meta.dir, "./app.css"), "utf8");
const overlaySource = readFileSync(
  resolve(import.meta.dir, "../components/CompletionOverlayApp.tsx"),
  "utf8"
);

describe("completion tag icon", () => {
  test("uses a hashtag icon for tag completions in both menu implementations", () => {
    expect(appStyles).toMatch(
      /\.cm-tooltip\.cm-tooltip-autocomplete ul li \.cm-completionIcon-tag:after\s*\{[\s\S]*content:\s*"#";/
    );
    expect(overlaySource).toMatch(/if \(type === "tag"\) \{\s*return "#";\s*\}/);
  });
});
