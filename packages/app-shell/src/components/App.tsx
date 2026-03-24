import {
  type DesktopSettings,
  OPEN_SHEET_SEARCH_EVENT,
  type SearchResult,
  type SheetRecord,
  type WorkspaceSelection,
  extractSheetTags,
} from "@linea/shared";
import { Menu, Plus } from "lucide-react";
import {
  type CSSProperties,
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { getElectrobun } from "../lib/rpc";
import type { SheetSymbol } from "../lib/sheet-autocomplete";
import type { SheetEvaluationSheet } from "../lib/sheet-evaluation";
import {
  type SheetEvaluationService,
  createSheetEvaluationService,
  isSheetEvaluationAbortError,
} from "../lib/sheet-evaluation-service";
import { LibraryPanel } from "./LibraryPanel";
import {
  type AppSettings,
  type AppThemeMode,
  SettingsPanel,
} from "./SettingsPanel";
import { SheetEditor, type SheetEditorLine } from "./SheetEditor";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";

type BootstrapState = {
  activeSheet: SheetRecord;
  sheets: SheetRecord[];
};

type AppRequest = {
  bootstrap: (_params: Record<string, never>) => Promise<BootstrapState>;
  createSheet: (params: { title?: string }) => Promise<SheetRecord>;
  deleteSheet?: (params: { id: string }) => Promise<{ id: string }>;
  markSheetOpened: (params: { id: string }) => Promise<SheetRecord>;
  renameSheet?: (params: { id: string; title: string }) => Promise<SheetRecord>;
  searchSheets: (params: {
    query: string;
    tags?: string[];
  }) => Promise<SearchResult[]>;
  getDesktopSettings?: (
    _params: Record<string, never>
  ) => Promise<DesktopSettings>;
  getWorkspaceSelection?: (
    _params: Record<string, never>
  ) => Promise<WorkspaceSelection | null>;
  openWorkspaceFolder?: (
    _params: Record<string, never>
  ) => Promise<WorkspaceSelection | null>;
  updateSheet: (params: {
    body: string;
    id: string;
    title?: string;
  }) => Promise<SheetRecord>;
  updateDesktopSettings?: (
    settings: DesktopSettings
  ) => Promise<DesktopSettings>;
};

type AppProps = {
  EditorComponent?: typeof SheetEditor;
  evaluationService?: SheetEvaluationService;
  initialLibraryQuery?: string;
  request?: AppRequest;
};

type FooterShortcut = {
  hideClassName?: string;
  keys: string[];
  label: string;
};

type SyntaxGuideSection = {
  items: Array<{
    description: string;
    syntax: string;
  }>;
  title: string;
};

const BOOTSTRAP_RETRY_DELAYS_MS = [250, 500];
const COLOR_SCHEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";
const SEARCH_SHORTCUT: FooterShortcut = { keys: ["Cmd", "F"], label: "Search" };
const LIBRARY_SHORTCUTS: FooterShortcut[] = [
  {
    hideClassName: "max-[760px]:hidden",
    keys: ["Cmd", "N"],
    label: "New sheet",
  },
  {
    hideClassName: "max-[920px]:hidden",
    keys: ["Cmd", ","],
    label: "Settings",
  },
];
const EDITOR_SHORTCUTS: FooterShortcut[] = [
  { keys: ["Cmd", "/"], label: "Comment" },
  {
    hideClassName: "max-[860px]:hidden",
    keys: ["Cmd", "."],
    label: "Autocomplete",
  },
];
const SYNTAX_GUIDE_SECTIONS: SyntaxGuideSection[] = [
  {
    items: [
      { description: "Section heading", syntax: "# Revenue" },
      { description: "Comment line", syntax: "// Notes" },
      { description: "Sheet tags", syntax: "#berlin #travel" },
    ],
    title: "Structure",
  },
  {
    items: [
      { description: "Variable assignment", syntax: "subtotal = 125 EUR" },
      { description: "Labeled result", syntax: "Price: subtotal in USD" },
      { description: "Object block", syntax: "plan { tax = 19% }" },
    ],
    title: "Values",
  },
  {
    items: [
      { description: "Expose a namespace", syntax: "Export subscriptions" },
      { description: "Import a namespace", syntax: "Import subscriptions" },
      { description: "Reuse block totals", syntax: "sum, avg, prev" },
    ],
    title: "Flow",
  },
  {
    items: [
      { description: "Shorthand math", syntax: "sqrt 16" },
      { description: "Root and log", syntax: "root 2 (8), log 2 (10)" },
      {
        description: "Time helpers",
        syntax: "now, Berlin time, fromunix(1710763200)",
      },
    ],
    title: "Functions",
  },
];
const WEBSITE_DISPLAY_FONT =
  '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif';
const REKNA_DESKTOP_ICON_URL = new URL(
  "../../../../apps/desktop/icon.iconset/icon_512x512.png",
  import.meta.url
).href;

export function App({
  EditorComponent = SheetEditor,
  evaluationService,
  initialLibraryQuery = "",
  request,
}: AppProps = {}) {
  const requestRef = useRef<AppRequest | null>(request ?? null);
  const [ownedEvaluationService] = useState<SheetEvaluationService>(
    () => evaluationService ?? createSheetEvaluationService()
  );
  const [requestReady, setRequestReady] = useState(() => request !== undefined);
  const [settings, setSettings] = useState<AppSettings>(readAppSettings);
  const [systemTheme, setSystemTheme] = useState<ResolvedAppTheme>(
    readSystemThemePreference
  );
  const [desktopSettings, setDesktopSettings] = useState<DesktopSettings>(
    defaultDesktopSettings
  );
  const [workspaceSelection, setWorkspaceSelection] =
    useState<WorkspaceSelection | null>(null);
  const [workspaceSelectionReady, setWorkspaceSelectionReady] = useState(
    () => request === undefined
  );
  const [workspaceActionState, setWorkspaceActionState] = useState<
    "opening" | null
  >(null);
  const [workspaceActionError, setWorkspaceActionError] = useState<
    string | null
  >(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState<BootstrapState | null>(null);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelView, setPanelView] = useState<"library" | "settings">("library");
  const [librarySearchFocusToken, setLibrarySearchFocusToken] = useState(0);
  const [query, setQuery] = useState(initialLibraryQuery);
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [evaluatedLines, setEvaluatedLines] = useState<SheetEditorLine[]>([]);
  const [completionSymbols, setCompletionSymbols] = useState<SheetSymbol[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [headerElevated, setHeaderElevated] = useState(false);
  const [syntaxGuideOpen, setSyntaxGuideOpen] = useState(false);
  const [headerTitleDraft, setHeaderTitleDraft] = useState("");
  const [editingTitleSheetId, setEditingTitleSheetId] = useState<string | null>(
    null
  );
  const sheetEvaluationService = evaluationService ?? ownedEvaluationService;

  const deferredQuery = useDeferredValue(query);
  const deferredDraft = useDeferredValue(draft);
  const evaluationDraft =
    deferredDraft.length === 0 && draft.length > 0 ? draft : deferredDraft;
  const activeSheetRef = useRef<SheetRecord | null>(null);
  const draftRef = useRef(draft);
  const persistedDraftRef = useRef("");
  const latestSaveSequenceRef = useRef(0);
  const lastMarkedSheetIdRef = useRef<string | null>(null);
  const headerTitleInputRef = useRef<HTMLInputElement | null>(null);
  const skipNextHeaderTitleCommitRef = useRef(false);
  const resolvedTheme = resolveAppTheme(settings.themeMode, systemTheme);
  draftRef.current = draft;

  useEffect(() => {
    if (evaluationService) {
      return;
    }

    return () => {
      ownedEvaluationService.dispose();
    };
  }, [evaluationService, ownedEvaluationService]);

  useEffect(() => {
    if (request) {
      requestRef.current = request;
      setRequestReady(true);
      return;
    }

    let cancelled = false;
    let timeoutId = 0;

    const resolveRequest = () => {
      const rpc = tryGetRpc();
      if (rpc?.request) {
        requestRef.current = rpc.request as unknown as AppRequest;
        setRequestReady(true);
        return;
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(resolveRequest, 50);
      }
    };

    resolveRequest();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [request]);

  useEffect(() => {
    const mediaQuery = getColorSchemeMediaQuery();
    if (!mediaQuery) {
      return;
    }

    const handleChange = () => {
      setSystemTheme(readSystemThemePreference(mediaQuery.matches));
    };

    handleChange();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    mediaQuery.addListener?.(handleChange);
    return () => {
      mediaQuery.removeListener?.(handleChange);
    };
  }, []);

  useEffect(() => {
    if (!requestReady || !requestRef.current) {
      return;
    }

    if (!requestRef.current.getWorkspaceSelection) {
      setWorkspaceSelectionReady(true);
      return;
    }

    let cancelled = false;
    setWorkspaceSelectionReady(false);
    setWorkspaceActionError(null);

    void requestRef.current
      .getWorkspaceSelection({})
      .then((selection) => {
        if (cancelled) {
          return;
        }

        setWorkspaceSelection(selection);
        setWorkspaceSelectionReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setStartupError(getErrorMessage(error));
        setWorkspaceSelectionReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [requestReady]);

  useEffect(() => {
    if (!requestReady || !requestRef.current) {
      return;
    }

    if (!workspaceSelectionReady) {
      return;
    }

    if (requestRef.current.getWorkspaceSelection && !workspaceSelection) {
      setBootstrapped(null);
      setActiveSheetId(null);
      setDraft("");
      setStartupError(null);
      return;
    }

    const abortController = new AbortController();
    const { bootstrap } = requestRef.current;
    setStartupError(null);

    void loadBootstrapState(bootstrap, abortController.signal)
      .then((state: BootstrapState) => {
        if (abortController.signal.aborted) {
          return;
        }

        const initialDraft = readDraftSnapshot(
          state.activeSheet.id,
          state.activeSheet.body
        );

        setBootstrapped(state);
        setActiveSheetId(state.activeSheet.id);
        setDraft(initialDraft);
        persistedDraftRef.current = state.activeSheet.body;
        lastMarkedSheetIdRef.current = state.activeSheet.id;
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) {
          return;
        }

        setStartupError(getErrorMessage(error));
      });

    return () => {
      abortController.abort();
    };
  }, [requestReady, workspaceSelection, workspaceSelectionReady]);

  useEffect(() => {
    if (!requestReady || !requestRef.current?.getDesktopSettings) {
      return;
    }

    let cancelled = false;

    void requestRef.current
      .getDesktopSettings({})
      .then((nextSettings) => {
        if (!cancelled) {
          setDesktopSettings(nextSettings);
        }
      })
      .catch(() => {
        // Keep using the local defaults if desktop settings fail to load.
      });

    return () => {
      cancelled = true;
    };
  }, [requestReady]);

  useEffect(() => {
    if (!deferredQuery.trim()) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const currentRequest = requestRef.current;
    if (!currentRequest) {
      return;
    }
    const { searchSheets } = currentRequest;

    void searchSheets({
      query: deferredQuery,
      tags: selectedTagFilters,
    }).then((nextResults: SearchResult[]) => {
      if (!cancelled) {
        setResults(nextResults);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [deferredQuery, selectedTagFilters]);

  const activeSheet =
    bootstrapped?.sheets.find((sheet) => sheet.id === activeSheetId) ?? null;
  activeSheetRef.current = activeSheet;
  const sheetsWithActiveDraftTags = (bootstrapped?.sheets ?? []).map((sheet) =>
    sheet.id === activeSheetId
      ? { ...sheet, tags: extractSheetTags(draft) }
      : sheet
  );
  const availableTags = collectSheetTags(sheetsWithActiveDraftTags);
  const availableTagsKey = availableTags.join("\u0000");
  const visibleSheets = filterSheetsByTags(
    deferredQuery.trim() ? [] : sheetsWithActiveDraftTags,
    selectedTagFilters
  );

  useEffect(() => {
    if (!activeSheet || editingTitleSheetId !== null) {
      return;
    }

    setHeaderTitleDraft(activeSheet.title);
  }, [activeSheet, editingTitleSheetId]);

  useEffect(() => {
    const nextAvailableTags = availableTagsKey
      ? availableTagsKey.split("\u0000")
      : [];

    setSelectedTagFilters((current) => {
      const next = current.filter((tag) => nextAvailableTags.includes(tag));
      return next.length === current.length &&
        next.every((tag, index) => tag === current[index])
        ? current
        : next;
    });
  }, [availableTagsKey]);

  useEffect(() => {
    if (!activeSheetId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      writeDraftSnapshot(activeSheetId, draft);
    }, 180);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activeSheetId, draft]);

  useEffect(() => {
    if (
      !bootstrapped ||
      !activeSheet ||
      lastMarkedSheetIdRef.current === activeSheet.id
    ) {
      return;
    }

    lastMarkedSheetIdRef.current = activeSheet.id;
    const currentRequest = requestRef.current;
    if (!currentRequest) {
      return;
    }
    const { markSheetOpened } = currentRequest;

    void markSheetOpened({ id: activeSheet.id }).then((openedSheet) => {
      if (activeSheetRef.current?.id !== openedSheet.id) {
        return;
      }

      setBootstrapped((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          activeSheet: openedSheet,
          sheets: current.sheets
            .map((sheet) => (sheet.id === openedSheet.id ? openedSheet : sheet))
            .sort((left, right) =>
              right.lastOpenedAt.localeCompare(left.lastOpenedAt)
            ),
        };
      });
    });
  }, [activeSheet, bootstrapped]);

  useEffect(() => {
    if (!bootstrapped || !activeSheetId) {
      setEvaluatedLines([]);
      setCompletionSymbols([]);
      return;
    }

    sheetEvaluationService.syncSheets(
      createSheetEvaluationSnapshot(bootstrapped.sheets)
    );
  }, [activeSheetId, bootstrapped, sheetEvaluationService]);

  useEffect(() => {
    if (!bootstrapped || !activeSheetId) {
      setEvaluatedLines([]);
      setCompletionSymbols([]);
      return;
    }

    if (editingTitleSheetId !== null) {
      return;
    }

    let cancelled = false;
    void sheetEvaluationService
      .evaluate({
        activeDraft: evaluationDraft,
        activeSheetId,
        carryRoundedValues: settings.carryRoundedValues,
        decimalSeparator: settings.decimalSeparator,
        precision: settings.precision,
      })
      .then((nextEvaluation) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setCompletionSymbols((current) =>
            sheetSymbolsEqual(current, nextEvaluation.completionSymbols)
              ? current
              : nextEvaluation.completionSymbols
          );
          setEvaluatedLines((current) =>
            sheetEditorLinesEqual(current, nextEvaluation.lines)
              ? current
              : nextEvaluation.lines
          );
        });
      })
      .catch((error: unknown) => {
        if (cancelled || isSheetEvaluationAbortError(error)) {
          return;
        }

        console.error("Failed to evaluate sheet", error);
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeSheetId,
    bootstrapped,
    editingTitleSheetId,
    evaluationDraft,
    sheetEvaluationService,
    settings.carryRoundedValues,
    settings.decimalSeparator,
    settings.precision,
  ]);

  useEffect(() => {
    writeAppSettings(settings);
  }, [settings]);

  const handleWindowKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const usesPrimaryModifier =
      (event.metaKey || event.ctrlKey) && !event.altKey;
    const usesSyntaxGuideShortcut =
      usesPrimaryModifier &&
      event.shiftKey &&
      (event.key === "?" || event.code === "Slash");

    if (usesSyntaxGuideShortcut) {
      if (isEditableEventTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setSyntaxGuideOpen((current) => !current);
      return;
    }

    if (!usesPrimaryModifier || event.shiftKey) {
      return;
    }

    if (event.key === ",") {
      event.preventDefault();
      openSettingsPanel();
      return;
    }

    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openLibraryPanel({ focusSearch: true });
      return;
    }

    if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      void handleCreateSheet();
    }
  });

  const handleNativeSheetSearchRequest = useEffectEvent(() => {
    openLibraryPanel({ focusSearch: true });
  });

  useEffect(() => {
    window.addEventListener("keydown", handleWindowKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown, true);
    };
  }, [handleWindowKeyDown]);

  useEffect(() => {
    const handleOpenSheetSearch = () => {
      handleNativeSheetSearchRequest();
    };

    window.addEventListener(OPEN_SHEET_SEARCH_EVENT, handleOpenSheetSearch);
    return () => {
      window.removeEventListener(
        OPEN_SHEET_SEARCH_EVENT,
        handleOpenSheetSearch
      );
    };
  }, [handleNativeSheetSearchRequest]);

  useEffect(() => {
    if (!bootstrapped || !activeSheet) {
      return;
    }

    if (draft === persistedDraftRef.current) {
      setSaveState("saved");
      return;
    }

    setSaveState("saving");
    const currentRequest = requestRef.current;
    if (!currentRequest) {
      return;
    }
    const { updateSheet } = currentRequest;
    const saveSequence = latestSaveSequenceRef.current + 1;
    latestSaveSequenceRef.current = saveSequence;
    const draftToPersist = draft;

    const timeout = window.setTimeout(() => {
      void updateSheet({
        body: draftToPersist,
        id: activeSheet.id,
        title: activeSheet.title,
      }).then((nextSheet: SheetRecord) => {
        if (saveSequence !== latestSaveSequenceRef.current) {
          return;
        }

        if (activeSheetRef.current?.id !== nextSheet.id) {
          return;
        }

        persistedDraftRef.current = nextSheet.body;

        setBootstrapped((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            activeSheet: nextSheet,
            sheets: current.sheets.map((sheet) =>
              sheet.id === nextSheet.id ? nextSheet : sheet
            ),
          };
        });

        if (draftRef.current === draftToPersist) {
          clearDraftSnapshot(nextSheet.id);
          setSaveState("saved");
          return;
        }

        setSaveState("saving");
      });
    }, 400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activeSheet, bootstrapped, draft]);

  if (startupError) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-6 text-center text-foreground">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-semibold">
            Rekna couldn’t finish opening.
          </p>
          <p className="text-sm text-muted-foreground">{startupError}</p>
        </div>
      </div>
    );
  }

  if (
    requestRef.current?.getWorkspaceSelection &&
    workspaceSelectionReady &&
    !workspaceSelection
  ) {
    const workspaceChooserBackdropStyle: CSSProperties = {
      backgroundImage: [
        "radial-gradient(circle at 50% 26%, color-mix(in oklab, var(--primary) 22%, transparent) 0%, transparent 18%)",
        "radial-gradient(circle at 50% 100%, color-mix(in oklab, black 20%, transparent) 0%, transparent 48%)",
      ].join(", "),
      opacity: resolvedTheme === "dark" ? 0.9 : 0.58,
    };

    return (
      <div
        className="relative flex h-full items-center justify-center overflow-hidden bg-background px-4 py-6 text-foreground sm:px-6 sm:py-8"
        data-theme={resolvedTheme}
        style={getAppStyle(settings)}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={workspaceChooserBackdropStyle}
        />
        <div className="relative w-full max-w-sm">
          <div className="flex flex-col items-center gap-7 px-8 py-10 text-center">
            <div className="relative">
              <div className="absolute inset-2 rounded-[2rem] bg-primary/26 blur-3xl" />
              <img
                alt="Rekna app icon"
                className="relative size-32 rounded-[2rem] shadow-[0_22px_44px_rgba(0,0,0,0.28)]"
                src={REKNA_DESKTOP_ICON_URL}
              />
            </div>

            <h1
              className="text-4xl font-semibold tracking-tight text-foreground sm:text-[2.9rem]"
              style={{ fontFamily: WEBSITE_DISPLAY_FONT }}
            >
              Rekna
            </h1>

            <Button
              className="h-11 w-full rounded-xl bg-primary text-foreground shadow-[0_16px_34px_rgba(0,0,0,0.24)] hover:bg-primary/90 hover:text-foreground"
              disabled={workspaceActionState !== null}
              onClick={() => void handleOpenWorkspaceFolder()}
              type="button"
            >
              {workspaceActionState === "opening"
                ? "Opening..."
                : "Open Folder as Workspace"}
            </Button>

            {workspaceActionError ? (
              <p className="text-sm leading-6 text-destructive">
                {workspaceActionError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (!bootstrapped || !activeSheet) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-foreground">
        Opening Rekna…
      </div>
    );
  }

  return (
    <div
      className="relative grid h-full min-h-0 grid-rows-[2.5rem_minmax(0,1fr)_auto] overflow-hidden bg-background text-foreground"
      data-theme={resolvedTheme}
      style={getAppStyle(settings)}
    >
      <div
        aria-label="Sheet controls"
        className={`electrobun-webkit-app-region-drag window-drag-region relative z-30 flex h-10 shrink-0 items-center justify-end bg-background pl-4 pr-1.5 transition-shadow duration-150 ${
          headerElevated
            ? "shadow-[0_10px_26px_rgba(0,0,0,0.22)]"
            : "shadow-none"
        }`}
        role="toolbar"
      >
        <div className="pointer-events-none absolute inset-x-0 inset-y-0 flex items-center justify-center px-20">
          <div className="electrobun-webkit-app-region-no-drag window-no-drag pointer-events-auto w-full max-w-sm">
            <Input
              aria-label="Sheet title"
              chrome="ghost"
              className="h-8 text-center text-[0.8125rem] font-medium text-foreground/80 hover:text-foreground focus-visible:text-foreground"
              onBlur={(event) =>
                commitHeaderTitleRename(event.currentTarget.value)
              }
              onChange={(event) => setHeaderTitleDraft(event.target.value)}
              onFocus={(event) => {
                setEditingTitleSheetId(activeSheet.id);
                event.currentTarget.select();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                  return;
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelHeaderTitleRename();
                }
              }}
              placeholder="Untitled"
              ref={headerTitleInputRef}
              spellCheck={false}
              value={headerTitleDraft}
            />
          </div>
        </div>

        <div className="electrobun-webkit-app-region-no-drag window-no-drag flex items-center gap-2">
          <Button
            aria-label="Create new sheet"
            onClick={() => void handleCreateSheet()}
            size="icon-sm"
            title={saveState === "saving" ? "Saving..." : "Create new sheet"}
            type="button"
            variant="ghost"
          >
            <Plus className="size-4" />
          </Button>
          <Button
            aria-label="Open library"
            onClick={() => openLibraryPanel()}
            size="icon-sm"
            title="Open library"
            type="button"
            variant="ghost"
          >
            <Menu className="size-4" />
          </Button>
        </div>
      </div>

      <main className="relative z-0 flex min-h-0 overflow-hidden">
        <EditorComponent
          completionSymbols={completionSymbols}
          documentId={activeSheet.id}
          lines={evaluatedLines}
          onChange={setDraft}
          onScrollStateChange={setHeaderElevated}
          value={draft}
          workspaceTags={availableTags}
        />
      </main>

      <footer
        className="relative w-full max-w-full shrink-0 p-2.5 font-sans text-[0.6875rem] leading-none text-muted-foreground/80"
        data-testid="shortcut-footer"
      >
        <div
          className="pointer-events-none absolute inset-x-2.5 top-0 h-px bg-gradient-to-r from-transparent via-foreground/22 to-transparent"
          data-testid="shortcut-footer-accent"
        />
        <div
          className="flex w-full min-w-0 items-center justify-between gap-2.5"
          data-testid="shortcut-footer-content"
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <ShortcutHint
                ariaLabel="Open sheet search"
                keys={SEARCH_SHORTCUT.keys}
                label={SEARCH_SHORTCUT.label}
                onClick={() => openLibraryPanel({ focusSearch: true })}
              />
              {LIBRARY_SHORTCUTS.map((shortcut) => (
                <ShortcutHint
                  hideClassName={shortcut.hideClassName}
                  key={shortcut.label}
                  keys={shortcut.keys}
                  label={shortcut.label}
                />
              ))}
            </div>
            <span
              aria-hidden="true"
              className="h-3.5 w-px shrink-0 bg-border/70 max-[640px]:hidden"
            />
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 max-[640px]:hidden">
              {EDITOR_SHORTCUTS.map((shortcut) => (
                <ShortcutHint
                  hideClassName={shortcut.hideClassName}
                  key={shortcut.label}
                  keys={shortcut.keys}
                  label={shortcut.label}
                />
              ))}
            </div>
          </div>

          <button
            aria-haspopup="dialog"
            aria-label="Open syntax guide"
            className="inline-flex shrink-0 items-center gap-2 rounded-sm border border-border/60 bg-secondary/25 px-2 py-0.5 text-[0.625rem] text-foreground/92 transition-colors hover:border-primary/45 hover:bg-secondary/45 focus-visible:outline-none"
            onClick={() => setSyntaxGuideOpen(true)}
            type="button"
          >
            <span className="inline-flex items-center whitespace-nowrap text-muted-foreground/92">
              Syntax
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <kbd className="inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-sm border border-border/80 bg-background/92 p-1 font-mono text-[0.625rem] font-medium leading-none text-foreground shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
                Cmd
              </kbd>
              <kbd className="inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-sm border border-border/80 bg-background/92 p-1 font-mono text-[0.625rem] font-medium leading-none text-foreground shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
                ?
              </kbd>
            </span>
          </button>
        </div>
      </footer>

      <Dialog open={syntaxGuideOpen} onOpenChange={setSyntaxGuideOpen}>
        <DialogContent className="w-[min(calc(100vw-2rem),44rem)] max-h-[calc(100vh-3rem)] p-0">
          <DialogHeader className="border-b border-border/65 px-4 py-3 pr-12">
            <DialogTitle>Syntax guide</DialogTitle>
            <DialogDescription className="sr-only">
              Quick reference for Rekna headings, tags, values, imports, and
              helpers.
            </DialogDescription>
          </DialogHeader>
          <DialogBody
            className="px-4 py-4"
            data-testid="syntax-guide-dialog-body"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {SYNTAX_GUIDE_SECTIONS.map((section) => (
                <section
                  className="space-y-2 rounded-xl border border-border/60 bg-background/55 p-3"
                  key={section.title}
                >
                  <h3 className="text-[0.625rem] font-medium uppercase tracking-[0.16em] text-muted-foreground/90">
                    {section.title}
                  </h3>
                  <ul className="space-y-2">
                    {section.items.map((item) => (
                      <li className="space-y-1" key={item.syntax}>
                        <code className="block rounded-md bg-secondary/40 px-2 py-1 font-mono text-[0.6875rem] text-foreground/95">
                          {item.syntax}
                        </code>
                        <p className="text-[0.6875rem] leading-4 text-muted-foreground/85">
                          {item.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Sheet
        modal={false}
        open={panelOpen}
        onOpenChange={handlePanelOpenChange}
      >
        <SheetContent
          className="p-0"
          forceMount
          floating
          showCloseButton={false}
          side="right"
        >
          <SheetTitle className="sr-only">
            {panelView === "library" ? "Library" : "Settings"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {panelView === "library"
              ? "Browse, search, and open your saved sheets."
              : "Adjust how Rekna looks and formats your calculations."}
          </SheetDescription>
          {panelView === "library" ? (
            <LibraryPanel
              activeSheetId={activeSheetId}
              availableTags={availableTags}
              onClose={closePanel}
              onCreateSheet={() => void handleCreateSheet()}
              onDeleteSheet={(sheetId) => void handleDeleteSheet(sheetId)}
              onDeleteSheets={(sheetIds) => void handleDeleteSheets(sheetIds)}
              onOpenSettings={() => setPanelView("settings")}
              onOpenSheet={(sheetId, options) => {
                startTransition(() => {
                  const nextSheet = bootstrapped.sheets.find(
                    (sheet) => sheet.id === sheetId
                  );
                  if (!nextSheet) {
                    return;
                  }

                  persistedDraftRef.current = nextSheet.body;
                  setActiveSheetId(nextSheet.id);
                  setDraft(readDraftSnapshot(nextSheet.id, nextSheet.body));

                  if (!options?.keepPanelOpen) {
                    closePanel();
                  }
                });
              }}
              onQueryChange={setQuery}
              onRenameSheet={(sheetId, title) =>
                void handleRenameSheet(sheetId, title)
              }
              onSelectedTagsChange={setSelectedTagFilters}
              open={panelOpen}
              selectedTags={selectedTagFilters}
              query={query}
              results={results}
              searchFocusToken={librarySearchFocusToken}
              sheets={visibleSheets}
            />
          ) : (
            <SettingsPanel
              desktopSettings={desktopSettings}
              onBack={() => setPanelView("library")}
              onClose={closePanel}
              onCarryRoundedValuesChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  carryRoundedValues: value,
                }))
              }
              onDecimalSeparatorChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  decimalSeparator: value,
                }))
              }
              onFontModeChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  fontMode: value,
                }))
              }
              onKeepRunningAfterCloseChange={(value) => {
                const nextSettings = {
                  ...desktopSettings,
                  keepRunningAfterWindowClose: value,
                };
                setDesktopSettings(nextSettings);
                void persistDesktopSettings(nextSettings);
              }}
              onLaunchOnLoginChange={(value) => {
                const nextSettings = {
                  ...desktopSettings,
                  keepRunningAfterWindowClose:
                    value || desktopSettings.keepRunningAfterWindowClose,
                  launchOnLogin: value,
                };
                setDesktopSettings(nextSettings);
                void persistDesktopSettings(nextSettings);
              }}
              onThemeModeChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  themeMode: value,
                }))
              }
              onOpenWorkspaceFolder={() => void handleOpenWorkspaceFolder()}
              onPrecisionChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  precision: clampPrecision(value),
                }))
              }
              settings={settings}
              workspaceActionError={workspaceActionError}
              workspaceActionState={workspaceActionState}
              workspaceSelection={workspaceSelection}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );

  async function handleCreateSheet() {
    const currentRequest = requestRef.current;
    if (!currentRequest) {
      return;
    }
    const { createSheet } = currentRequest;
    const nextSheet = await createSheet({
      title: "Untitled",
    });

    setBootstrapped((current) =>
      current
        ? {
            ...current,
            activeSheet: nextSheet,
            sheets: [nextSheet, ...current.sheets],
          }
        : current
    );
    persistedDraftRef.current = nextSheet.body;
    setActiveSheetId(nextSheet.id);
    setDraft(readDraftSnapshot(nextSheet.id, nextSheet.body));
    closePanel();
    syncSearchResultsAfterMutation(nextSheet);
  }

  function openLibraryPanel({
    focusSearch = false,
  }: { focusSearch?: boolean } = {}) {
    setSyntaxGuideOpen(false);
    setPanelView("library");
    setPanelOpen(true);

    if (focusSearch) {
      setLibrarySearchFocusToken((current) => current + 1);
    }
  }

  function openSettingsPanel() {
    setSyntaxGuideOpen(false);
    setPanelView("settings");
    setPanelOpen(true);
  }

  async function handleOpenWorkspaceFolder() {
    const openWorkspaceFolder = requestRef.current?.openWorkspaceFolder;

    if (!openWorkspaceFolder) {
      return;
    }

    try {
      setWorkspaceActionError(null);
      setWorkspaceActionState("opening");
      const selection = await openWorkspaceFolder({});

      if (selection) {
        await applyWorkspaceSelection(selection);
      }
    } catch (error: unknown) {
      setWorkspaceActionError(getErrorMessage(error));
    } finally {
      setWorkspaceActionState(null);
    }
  }

  function closePanel() {
    setPanelOpen(false);
    setQuery("");
  }

  async function refreshDesktopSettings() {
    const getDesktopSettings = requestRef.current?.getDesktopSettings;

    if (!getDesktopSettings) {
      return;
    }

    try {
      setDesktopSettings(await getDesktopSettings({}));
    } catch {
      // Keep the current in-memory settings if the workspace settings fail to load.
    }
  }

  async function applyWorkspaceSelection(selection: WorkspaceSelection) {
    closePanel();
    setBootstrapped(null);
    setActiveSheetId(null);
    setDraft("");
    persistedDraftRef.current = "";
    lastMarkedSheetIdRef.current = null;
    setWorkspaceSelection(selection);
    await refreshDesktopSettings();
  }

  function handlePanelOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setPanelOpen(true);
      return;
    }

    closePanel();
  }

  function cancelHeaderTitleRename() {
    skipNextHeaderTitleCommitRef.current = true;
    setEditingTitleSheetId(null);
    setHeaderTitleDraft(activeSheet?.title ?? "");
    headerTitleInputRef.current?.blur();
  }

  function commitHeaderTitleRename(nextValue = headerTitleDraft) {
    if (skipNextHeaderTitleCommitRef.current) {
      skipNextHeaderTitleCommitRef.current = false;
      return;
    }

    setEditingTitleSheetId(null);

    if (!activeSheet || !requestRef.current?.renameSheet) {
      setHeaderTitleDraft(activeSheet?.title ?? "");
      return;
    }

    const nextTitle = nextValue.trim();

    if (!nextTitle || nextTitle === activeSheet.title) {
      setHeaderTitleDraft(activeSheet.title);
      return;
    }

    setHeaderTitleDraft(nextTitle);
    void handleRenameSheet(activeSheet.id, nextTitle);
  }

  async function handleRenameSheet(sheetId: string, title: string) {
    const currentRequest = requestRef.current;
    if (!currentRequest?.renameSheet) {
      return;
    }

    const nextSheet = await currentRequest.renameSheet({ id: sheetId, title });
    applySheetUpdate(nextSheet);
  }

  async function handleDeleteSheet(sheetId: string) {
    await handleDeleteSheets([sheetId]);
  }

  async function handleDeleteSheets(sheetIds: string[]) {
    const currentRequest = requestRef.current;
    if (!currentRequest?.deleteSheet || !bootstrapped) {
      return;
    }

    const nextSheetIds = [...new Set(sheetIds)].filter((sheetId) =>
      bootstrapped.sheets.some((sheet) => sheet.id === sheetId)
    );

    if (nextSheetIds.length === 0) {
      return;
    }

    for (const sheetId of nextSheetIds) {
      await currentRequest.deleteSheet({ id: sheetId });
      clearDraftSnapshot(sheetId);
    }

    const deletedSheetIds = new Set(nextSheetIds);

    const remainingSheets = bootstrapped.sheets.filter(
      (sheet) => !deletedSheetIds.has(sheet.id)
    );

    if (remainingSheets.length === 0) {
      const replacement = await currentRequest.createSheet({
        title: "Untitled",
      });
      setBootstrapped({
        activeSheet: replacement,
        sheets: [replacement],
      });
      persistedDraftRef.current = replacement.body;
      setActiveSheetId(replacement.id);
      setDraft(readDraftSnapshot(replacement.id, replacement.body));
      syncSearchResultsAfterDelete(nextSheetIds);
      return;
    }

    const nextActiveSheet =
      activeSheetId && deletedSheetIds.has(activeSheetId)
        ? remainingSheets[0]
        : (remainingSheets.find((sheet) => sheet.id === activeSheetId) ??
          remainingSheets[0]);

    setBootstrapped({
      activeSheet: nextActiveSheet,
      sheets: remainingSheets,
    });
    syncSearchResultsAfterDelete(nextSheetIds);

    if (
      !activeSheetId ||
      !deletedSheetIds.has(activeSheetId) ||
      !nextActiveSheet
    ) {
      return;
    }

    persistedDraftRef.current = nextActiveSheet.body;
    setActiveSheetId(nextActiveSheet.id);
    setDraft(readDraftSnapshot(nextActiveSheet.id, nextActiveSheet.body));
  }

  function applySheetUpdate(nextSheet: SheetRecord) {
    setBootstrapped((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        activeSheet:
          current.activeSheet.id === nextSheet.id
            ? nextSheet
            : current.activeSheet,
        sheets: current.sheets.map((sheet) =>
          sheet.id === nextSheet.id ? nextSheet : sheet
        ),
      };
    });
    syncSearchResultsAfterMutation(nextSheet);
  }

  function syncSearchResultsAfterMutation(nextSheet: SheetRecord) {
    if (!query.trim()) {
      return;
    }

    setResults((current) =>
      current.map((result) =>
        result.id === nextSheet.id
          ? {
              ...result,
              tags: nextSheet.tags,
              title: nextSheet.title,
            }
          : result
      )
    );
    void refreshSearchResults();
  }

  function syncSearchResultsAfterDelete(sheetIds: string[]) {
    if (!query.trim()) {
      return;
    }

    const deletedSheetIds = new Set(sheetIds);
    setResults((current) =>
      current.filter((result) => !deletedSheetIds.has(result.id))
    );
    void refreshSearchResults();
  }

  async function refreshSearchResults() {
    const currentRequest = requestRef.current;
    if (!currentRequest || !query.trim()) {
      return;
    }

    const nextResults = await currentRequest.searchSheets({
      query,
      tags: selectedTagFilters,
    });
    setResults(nextResults);
  }

  async function persistDesktopSettings(nextSettings: DesktopSettings) {
    const currentRequest = requestRef.current;
    if (!currentRequest?.updateDesktopSettings) {
      return;
    }

    const confirmedSettings =
      await currentRequest.updateDesktopSettings(nextSettings);
    setDesktopSettings(confirmedSettings);
  }
}

function ShortcutHint({
  ariaLabel,
  hideClassName,
  keys,
  label,
  onClick,
}: {
  ariaLabel?: string;
  hideClassName?: string;
  keys: string[];
  label: string;
  onClick?: () => void;
}) {
  const className =
    `inline-flex min-w-0 items-center gap-2 rounded-sm border border-border/55 bg-secondary/20 px-2 py-0.5 ${hideClassName ?? ""}`.trim();
  const content = (
    <>
      <span className="inline-flex items-center truncate text-muted-foreground/88">
        {label}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((key) => (
          <kbd
            className="inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-sm border border-border/80 bg-background/92 p-1 font-mono text-[0.625rem] font-medium leading-none text-foreground shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]"
            key={key}
          >
            {key}
          </kbd>
        ))}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        aria-label={ariaLabel}
        className={`${className} text-left transition-colors hover:border-primary/45 hover:bg-secondary/45 focus-visible:outline-none`.trim()}
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  // Let sheet-level shortcuts work while the CodeMirror editor is focused.
  if (target.closest(".cm-editor") !== null) {
    return false;
  }

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  ) {
    return true;
  }

  return (
    target.closest(
      "input, textarea, [contenteditable='true'], [role='textbox']"
    ) !== null
  );
}

function readDraftSnapshot(sheetId: string, fallback: string) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const cached = window.sessionStorage.getItem(getDraftSnapshotKey(sheetId));
    return cached ?? fallback;
  } catch {
    return fallback;
  }
}

function writeDraftSnapshot(sheetId: string, draft: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(getDraftSnapshotKey(sheetId), draft);
  } catch {
    // Ignore storage quota and unavailable storage failures.
  }
}

function clearDraftSnapshot(sheetId: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(getDraftSnapshotKey(sheetId));
  } catch {
    // Ignore unavailable storage failures.
  }
}

function getDraftSnapshotKey(sheetId: string) {
  return `linea:draft:${sheetId}`;
}

type LegacyAppSettings = Partial<AppSettings> & {
  nightMode?: boolean;
};

type ResolvedAppTheme = Exclude<AppThemeMode, "system">;

function readAppSettings(): AppSettings {
  if (typeof window === "undefined") {
    return defaultAppSettings();
  }

  try {
    const cached = window.sessionStorage.getItem("linea:settings");
    if (!cached) {
      return defaultAppSettings();
    }

    const parsed = JSON.parse(cached) as LegacyAppSettings;

    return {
      carryRoundedValues: parsed.carryRoundedValues ?? false,
      decimalSeparator: parsed.decimalSeparator === "comma" ? "comma" : "dot",
      fontMode:
        parsed.fontMode === "compact" ||
        parsed.fontMode === "dynamic" ||
        parsed.fontMode === "large"
          ? parsed.fontMode
          : "dynamic",
      precision: clampPrecision(parsed.precision ?? 2),
      themeMode: readStoredThemeMode(parsed),
    };
  } catch {
    return defaultAppSettings();
  }
}

function writeAppSettings(settings: AppSettings) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem("linea:settings", JSON.stringify(settings));
  } catch {
    // Ignore unavailable storage failures.
  }
}

function defaultAppSettings(): AppSettings {
  return {
    carryRoundedValues: false,
    decimalSeparator: "dot",
    fontMode: "dynamic",
    precision: 2,
    themeMode: "system",
  };
}

function readStoredThemeMode(settings: LegacyAppSettings): AppThemeMode {
  if (isAppThemeMode(settings.themeMode)) {
    return settings.themeMode;
  }

  if (typeof settings.nightMode === "boolean") {
    return settings.nightMode ? "dark" : "light";
  }

  return "system";
}

function isAppThemeMode(value: unknown): value is AppThemeMode {
  return value === "dark" || value === "light" || value === "system";
}

function readSystemThemePreference(
  prefersDarkMode = getColorSchemeMediaQuery()?.matches ?? true
): ResolvedAppTheme {
  return prefersDarkMode ? "dark" : "light";
}

function getColorSchemeMediaQuery() {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return null;
  }

  return window.matchMedia(COLOR_SCHEME_MEDIA_QUERY);
}

function resolveAppTheme(
  themeMode: AppThemeMode,
  systemTheme: ResolvedAppTheme
): ResolvedAppTheme {
  return themeMode === "system" ? systemTheme : themeMode;
}

function defaultDesktopSettings(): DesktopSettings {
  return {
    keepRunningAfterWindowClose: false,
    launchOnLogin: false,
  };
}

function collectSheetTags(sheets: SheetRecord[]) {
  return [...new Set(sheets.flatMap((sheet) => sheet.tags ?? []))].sort(
    (a, b) => a.localeCompare(b)
  );
}

async function loadBootstrapState(
  bootstrap: AppRequest["bootstrap"],
  signal: AbortSignal
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await bootstrap({});
    } catch (error) {
      if (
        !isRetryableBootstrapError(error) ||
        attempt >= BOOTSTRAP_RETRY_DELAYS_MS.length
      ) {
        throw error;
      }

      await waitForDelay(BOOTSTRAP_RETRY_DELAYS_MS[attempt] ?? 0, signal);
    }
  }
}

function isRetryableBootstrapError(error: unknown) {
  return error instanceof Error && error.message === "RPC request timed out.";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown startup error";
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function waitForDelay(ms: number, signal: AbortSignal) {
  if (signal.aborted) {
    throw createAbortError();
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const handleAbort = () => {
      cleanup();
      reject(createAbortError());
    };

    const cleanup = () => {
      globalThis.clearTimeout(timeoutId);
      signal.removeEventListener("abort", handleAbort);
    };

    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

function filterSheetsByTags(sheets: SheetRecord[], selectedTags: string[]) {
  if (selectedTags.length === 0) {
    return sheets;
  }

  return sheets.filter((sheet) => {
    const tagSet = new Set(sheet.tags ?? []);
    return selectedTags.every((tag) => tagSet.has(tag));
  });
}

function createSheetEvaluationSnapshot(sheets: SheetRecord[]) {
  return sheets.map(
    (sheet) =>
      ({
        body: sheet.body,
        id: sheet.id,
      }) satisfies SheetEvaluationSheet
  );
}

function sheetSymbolsEqual(left: SheetSymbol[], right: SheetSymbol[]) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftItem = left[index];
    const rightItem = right[index];

    if (
      leftItem?.kind !== rightItem?.kind ||
      leftItem?.label !== rightItem?.label
    ) {
      return false;
    }
  }

  return true;
}

function clampPrecision(value: number) {
  return Math.min(8, Math.max(0, Math.round(value)));
}

function sheetEditorLinesEqual(
  left: SheetEditorLine[],
  right: SheetEditorLine[]
) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (!sheetEditorLineEqual(left[index], right[index])) {
      return false;
    }
  }

  return true;
}

function sheetEditorLineEqual(
  left: SheetEditorLine | undefined,
  right: SheetEditorLine | undefined
) {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.displayValue === right.displayValue &&
    left.expression === right.expression &&
    left.kind === right.kind &&
    left.label === right.label &&
    left.raw === right.raw &&
    left.displayValueMeta?.carryMode === right.displayValueMeta?.carryMode &&
    left.displayValueMeta?.fullPrecisionValue ===
      right.displayValueMeta?.fullPrecisionValue
  );
}

function getAppStyle(settings: AppSettings): CSSProperties {
  return {
    "--editor-font-size": `${fontSizeForMode(settings.fontMode)}px`,
  } as CSSProperties;
}

function fontSizeForMode(mode: AppSettings["fontMode"]) {
  if (mode === "compact") {
    return 16;
  }

  if (mode === "large") {
    return 21;
  }

  return 18;
}

function tryGetRpc() {
  const electrobun = getElectrobun();

  return electrobun?.rpc ?? null;
}
