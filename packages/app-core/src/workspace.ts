import {
  buildSheetPlainText,
  extractSheetTags,
  fuzzySearch,
  inferSheetTitle,
  normalizeSheetTags,
} from "@linea/shared";
import type { SearchResult, SheetRecord } from "@linea/shared";

export type AppWorkspace = {
  activeSheetId: string | null;
  sheets: SheetRecord[];
};

type PersistedWorkspace = {
  version: 1;
  workspace: AppWorkspace;
};

type BootstrapOptions = {
  idFactory?: () => string;
  now?: () => string;
};

type CreateSheetOptions = BootstrapOptions & {
  title?: string;
};

type UpdateSheetBodyOptions = {
  body: string;
  id: string;
  now?: () => string;
  title?: string;
};

type RenameSheetOptions = {
  id: string;
  now?: () => string;
  title: string;
};

export function bootstrapWorkspace(
  workspace: AppWorkspace | null,
  options: BootstrapOptions = {}
) {
  if (!workspace || workspace.sheets.length === 0) {
    const nextWorkspace = createWorkspaceWithStarterSheet(options);
    return {
      activeSheet: nextWorkspace.sheets[0] ?? null,
      workspace: nextWorkspace,
    };
  }

  const activeSheet = getActiveSheet(workspace) ?? workspace.sheets[0] ?? null;

  if (!activeSheet) {
    const nextWorkspace = createWorkspaceWithStarterSheet(options);
    return {
      activeSheet: nextWorkspace.sheets[0] ?? null,
      workspace: nextWorkspace,
    };
  }

  return {
    activeSheet,
    workspace: {
      activeSheetId: activeSheet.id,
      sheets: sortSheets(workspace.sheets),
    },
  };
}

export function createSheet(
  workspace: AppWorkspace,
  options: CreateSheetOptions = {}
) {
  const timestamp = options.now?.() ?? now();
  const sheet = createSheetRecord({
    id: options.idFactory?.() ?? createSheetId(),
    timestamp,
    title: options.title,
  });

  const nextWorkspace = {
    activeSheetId: sheet.id,
    sheets: sortSheets([sheet, ...workspace.sheets]),
  } satisfies AppWorkspace;

  return {
    activeSheet: sheet,
    workspace: nextWorkspace,
  };
}

export function setActiveSheet(workspace: AppWorkspace, id: string) {
  const targetSheet = workspace.sheets.find((sheet) => sheet.id === id) ?? null;

  if (!targetSheet) {
    return {
      activeSheet: getActiveSheet(workspace),
      workspace,
    };
  }

  const openedSheet = {
    ...targetSheet,
    lastOpenedAt: now(),
  };

  const nextWorkspace = {
    activeSheetId: openedSheet.id,
    sheets: sortSheets(
      workspace.sheets.map((sheet) => (sheet.id === id ? openedSheet : sheet))
    ),
  } satisfies AppWorkspace;

  return {
    activeSheet: openedSheet,
    workspace: nextWorkspace,
  };
}

export function updateSheetBody(
  workspace: AppWorkspace,
  { body, id, now: nowOverride, title }: UpdateSheetBodyOptions
) {
  const currentSheet = workspace.sheets.find((sheet) => sheet.id === id);

  if (!currentSheet) {
    return {
      activeSheet: getActiveSheet(workspace),
      workspace,
    };
  }

  const updatedAt = nowOverride?.() ?? now();
  const nextSheet: SheetRecord = {
    ...currentSheet,
    body,
    tags: extractSheetTags(body),
    lastOpenedAt: updatedAt,
    plainText: buildSheetPlainText(body),
    title: title?.trim() || inferSheetTitle(body, currentSheet.title),
    updatedAt,
  };

  const nextWorkspace = {
    activeSheetId:
      workspace.activeSheetId === id ? id : workspace.activeSheetId,
    sheets: sortSheets(
      workspace.sheets.map((sheet) => (sheet.id === id ? nextSheet : sheet))
    ),
  } satisfies AppWorkspace;

  return {
    activeSheet:
      nextWorkspace.activeSheetId === nextSheet.id
        ? nextSheet
        : getActiveSheet(nextWorkspace),
    workspace: nextWorkspace,
  };
}

export function renameSheet(
  workspace: AppWorkspace,
  { id, now: nowOverride, title }: RenameSheetOptions
) {
  const currentSheet = workspace.sheets.find((sheet) => sheet.id === id);

  if (!currentSheet) {
    return {
      activeSheet: getActiveSheet(workspace),
      workspace,
    };
  }

  const updatedAt = nowOverride?.() ?? now();
  const nextSheet: SheetRecord = {
    ...currentSheet,
    title: title.trim() || currentSheet.title,
    updatedAt,
  };

  const nextWorkspace = {
    activeSheetId: workspace.activeSheetId,
    sheets: sortSheets(
      workspace.sheets.map((sheet) => (sheet.id === id ? nextSheet : sheet))
    ),
  } satisfies AppWorkspace;

  return {
    activeSheet:
      nextWorkspace.activeSheetId === nextSheet.id
        ? nextSheet
        : getActiveSheet(nextWorkspace),
    workspace: nextWorkspace,
  };
}

export function deleteSheet(workspace: AppWorkspace, id: string) {
  const remainingSheets = workspace.sheets.filter((sheet) => sheet.id !== id);
  const nextActiveSheetId =
    workspace.activeSheetId === id
      ? (remainingSheets[0]?.id ?? null)
      : workspace.activeSheetId;

  const nextWorkspace = {
    activeSheetId: nextActiveSheetId,
    sheets: sortSheets(remainingSheets),
  } satisfies AppWorkspace;

  return {
    activeSheet: getActiveSheet(nextWorkspace),
    workspace: nextWorkspace,
  };
}

export function searchSheets(
  workspace: AppWorkspace,
  { query, tags = [] }: { query: string; tags?: string[] }
) {
  const normalizedQuery = query.trim();
  const normalizedTags = normalizeSheetTags(tags);

  if (normalizedQuery.length === 0 && normalizedTags.length === 0) {
    return [];
  }

  const searchableSheets =
    normalizedQuery.length === 0
      ? workspace.sheets
      : fuzzySearch(workspace.sheets, normalizedQuery, {
          keys: ["title", "plainText", "tags"],
        });

  return searchableSheets
    .filter((sheet) => hasAllTags(sheet.tags, normalizedTags))
    .map(
      (sheet) =>
        ({
          id: sheet.id,
          snippet: buildSnippet(sheet.body, normalizedQuery),
          tags: sheet.tags,
          title: sheet.title,
          updatedAt: sheet.updatedAt,
        }) satisfies SearchResult
    );
}

export function getActiveSheet(workspace: AppWorkspace) {
  return (
    workspace.sheets.find((sheet) => sheet.id === workspace.activeSheetId) ??
    null
  );
}

export function parseWorkspaceSnapshot(serialized: string | null) {
  if (!serialized) {
    return null;
  }

  try {
    const parsed = JSON.parse(serialized) as
      | AppWorkspace
      | PersistedWorkspace
      | null;
    const workspace = extractWorkspace(parsed);

    if (!workspace) {
      return null;
    }

    return {
      activeSheetId:
        typeof workspace.activeSheetId === "string"
          ? workspace.activeSheetId
          : null,
      sheets: Array.isArray(workspace.sheets) ? workspace.sheets : [],
    } satisfies AppWorkspace;
  } catch {
    return null;
  }
}

export function serializeWorkspaceSnapshot(workspace: AppWorkspace) {
  return JSON.stringify({
    version: 1,
    workspace,
  } satisfies PersistedWorkspace);
}

function createWorkspaceWithStarterSheet(options: BootstrapOptions) {
  const timestamp = options.now?.() ?? now();
  const starter = createSheetRecord({
    id: options.idFactory?.() ?? createSheetId(),
    timestamp,
  });

  return {
    activeSheetId: starter.id,
    sheets: [starter],
  } satisfies AppWorkspace;
}

function createSheetRecord({
  id,
  timestamp,
  title,
}: {
  id: string;
  timestamp: string;
  title?: string;
}): SheetRecord {
  return {
    body: "",
    createdAt: timestamp,
    filePath: `native://sheets/${id}.md`,
    id,
    lastOpenedAt: timestamp,
    plainText: "",
    tags: [],
    title: title?.trim() || "Untitled",
    updatedAt: timestamp,
  };
}

function extractWorkspace(parsed: AppWorkspace | PersistedWorkspace | null) {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  if ("version" in parsed && "workspace" in parsed) {
    return parsed.version === 1 ? parsed.workspace : null;
  }

  return parsed;
}

function sortSheets(sheets: SheetRecord[]) {
  return [...sheets].sort((left, right) => {
    const lastOpenedComparison = right.lastOpenedAt.localeCompare(
      left.lastOpenedAt
    );
    if (lastOpenedComparison !== 0) {
      return lastOpenedComparison;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function hasAllTags(sheetTags: string[], selectedTags: string[]) {
  if (selectedTags.length === 0) {
    return true;
  }

  const tagSet = new Set(sheetTags);
  return selectedTags.every((tag) => tagSet.has(tag));
}

function buildSnippet(body: string, query: string) {
  const plainText = buildSheetPlainText(body);
  const fallback =
    plainText.split(/\r?\n/).find(Boolean)?.trim() ?? "Empty sheet";

  if (!query.trim()) {
    return fallback;
  }

  const lines = plainText.split(/\r?\n/);
  const match = lines.find((line) =>
    line.toLowerCase().includes(query.trim().toLowerCase())
  );

  return match?.trim() || fallback;
}

function createSheetId() {
  const randomUUID = globalThis.crypto?.randomUUID;

  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }

  return `sheet-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}
