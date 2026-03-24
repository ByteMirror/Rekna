import Fuse, { type IFuseOptions } from "fuse.js";

const DEFAULT_FUZZY_OPTIONS = {
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 1,
  shouldSort: true,
  threshold: 0.3,
} as const;

type SharedFuzzyOptions<T> = Omit<
  IFuseOptions<T>,
  | "ignoreLocation"
  | "includeScore"
  | "minMatchCharLength"
  | "shouldSort"
  | "threshold"
>;

export function fuzzySearch<T>(
  items: T[],
  query: string,
  options: SharedFuzzyOptions<T> = {}
) {
  const normalizedQuery = normalizeFuzzyQuery(query);
  const terms = normalizedQuery.split(" ").filter(Boolean);

  if (terms.length === 0) {
    return items;
  }

  const fuse = new Fuse(items, {
    ...DEFAULT_FUZZY_OPTIONS,
    ...options,
  });
  const rankedMatches = new Map<
    number,
    { item: T; matchCount: number; score: number }
  >();

  for (const term of terms) {
    const termResults = fuse.search(term);

    if (termResults.length === 0) {
      return [];
    }

    for (const result of termResults) {
      const refIndex = result.refIndex;

      if (refIndex === undefined) {
        continue;
      }

      const existing = rankedMatches.get(refIndex);
      const nextScore = result.score ?? 0;

      rankedMatches.set(refIndex, {
        item: result.item,
        matchCount: (existing?.matchCount ?? 0) + 1,
        score: (existing?.score ?? 0) + nextScore,
      });
    }
  }

  return [...rankedMatches.values()]
    .filter((match) => match.matchCount === terms.length)
    .sort((left, right) => left.score - right.score)
    .map((match) => match.item);
}

export function fuzzySearchStrings(items: string[], query: string) {
  return fuzzySearch(
    items.map((value) => ({ value })),
    query,
    {
      keys: ["value"],
    }
  ).map((entry) => entry.value);
}

export function normalizeFuzzyQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}
