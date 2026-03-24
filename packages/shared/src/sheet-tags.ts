const SHEET_TAG_LINE_PATTERN =
  /^\s*(?:#[A-Za-z0-9][A-Za-z0-9_-]*)(?:\s+#[A-Za-z0-9][A-Za-z0-9_-]*)*\s*$/;
const SHEET_TAG_TOKEN_PATTERN = /#[A-Za-z0-9][A-Za-z0-9_-]*/g;
const SHEET_TAG_PREFIX_PATTERN = /^#[A-Za-z0-9_-]*$/;

export function buildSheetPlainText(body: string) {
  return body
    .split(/\r?\n/)
    .filter((line) => !isSheetTagLine(line))
    .join("\n");
}

export function extractSheetTags(body: string) {
  const tags: string[] = [];

  for (const line of body.split(/\r?\n/)) {
    if (!isSheetTagLine(line)) {
      continue;
    }

    for (const match of line.matchAll(SHEET_TAG_TOKEN_PATTERN)) {
      tags.push(match[0].slice(1));
    }
  }

  return normalizeSheetTags(tags);
}

export function inferSheetTitle(body: string, fallback = "Untitled") {
  const firstMeaningfulLine = buildSheetPlainText(body)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstMeaningfulLine ? firstMeaningfulLine.slice(0, 48) : fallback;
}

export function isSheetTagLine(line: string) {
  return SHEET_TAG_LINE_PATTERN.test(line);
}

export function isSheetTagPrefix(value: string) {
  return SHEET_TAG_PREFIX_PATTERN.test(value);
}

export function normalizeSheetTag(tag: string) {
  return tag.trim().replace(/^#+/, "").toLowerCase();
}

export function normalizeSheetTags(tags: readonly string[] | undefined) {
  return [...new Set((tags ?? []).map(normalizeSheetTag).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
}
