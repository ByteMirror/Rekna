import { evaluateSheet } from "@linea/calc-engine";
import {
  type DesktopSettings,
  type SearchResult,
  type SheetRecord,
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

import { OPEN_SHEET_SEARCH_EVENT } from "../../shared/sheet-search-shortcut";
import { getElectrobun } from "../lib/rpc";
import type { SheetSymbol } from "../lib/sheet-autocomplete";
import { buildSheetLinkingState } from "../lib/sheet-linking";
import { LibraryPanel } from "./LibraryPanel";
import { type AppSettings, SettingsPanel } from "./SettingsPanel";
import { SheetEditor, type SheetEditorLine } from "./SheetEditor";
import { Button } from "./ui/button";
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
  initialLibraryQuery?: string;
  request?: AppRequest;
};

type FooterShortcut = {
  hideClassName?: string;
  keys: string[];
  label: string;
};

const LIBRARY_SHORTCUTS: FooterShortcut[] = [
  { keys: ["Cmd", "F"], label: "Search" },
  { hideClassName: "max-[760px]:hidden", keys: ["Cmd", "N"], label: "New sheet" },
  { hideClassName: "max-[920px]:hidden", keys: ["Cmd", ","], label: "Settings" },
];
const EDITOR_SHORTCUTS: FooterShortcut[] = [
  { keys: ["Cmd", "/"], label: "Comment" },
  {
    hideClassName: "max-[860px]:hidden",
    keys: ["Cmd", "."],
    label: "Autocomplete",
  },
];

export function App({
  EditorComponent = SheetEditor,
  initialLibraryQuery = "",
  request,
}: AppProps = {}) {
  const requestRef = useRef<AppRequest | null>(request ?? null);
  const [requestReady, setRequestReady] = useState(() => request !== undefined);
  const [settings, setSettings] = useState<AppSettings>(readAppSettings);
  const [desktopSettings, setDesktopSettings] = useState<DesktopSettings>(
    defaultDesktopSettings
  );
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
  const [importableSymbols, setImportableSymbols] = useState<SheetSymbol[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [headerElevated, setHeaderElevated] = useState(false);
  const [headerTitleDraft, setHeaderTitleDraft] = useState("");
  const [editingTitleSheetId, setEditingTitleSheetId] = useState<string | null>(
    null
  );

  const deferredQuery = useDeferredValue(query);
  const deferredEvaluationInput = useDeferredValue({
    draft,
    sheetId: activeSheetId,
  });
  const evaluationDraft =
    deferredEvaluationInput.sheetId === activeSheetId
      ? deferredEvaluationInput.draft
      : draft;
  const activeSheetRef = useRef<SheetRecord | null>(null);
  const draftRef = useRef(draft);
  const persistedDraftRef = useRef("");
  const latestSaveSequenceRef = useRef(0);
  const lastMarkedSheetIdRef = useRef<string | null>(null);
  const headerTitleInputRef = useRef<HTMLInputElement | null>(null);
  const skipNextHeaderTitleCommitRef = useRef(false);
  draftRef.current = draft;

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
    if (!requestReady || !requestRef.current) {
      return;
    }

    let cancelled = false;
    const { bootstrap } = requestRef.current;
    setStartupError(null);

    void bootstrap({})
      .then((state: BootstrapState) => {
        if (cancelled) {
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
        if (cancelled) {
          return;
        }

        setStartupError(
          error instanceof Error ? error.message : "Unknown startup error"
        );
      });

    return () => {
      cancelled = true;
    };
  }, [requestReady]);

  useEffect(() => {
    if (!requestReady || !requestRef.current?.getDesktopSettings) {
      return;
    }

    let cancelled = false;

    void requestRef.current.getDesktopSettings({}).then((nextSettings) => {
      if (!cancelled) {
        setDesktopSettings(nextSettings);
      }
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
      setImportableSymbols([]);
      return;
    }

    if (editingTitleSheetId !== null) {
      return;
    }

    let cancelled = false;
    const task = scheduleBackgroundWork(() => {
      void buildSheetLinkingState({
        activeDraft: evaluationDraft,
        activeSheetId,
        carryRoundedValues: settings.carryRoundedValues,
        precision: settings.precision,
        readDraftSnapshot,
        sheets: bootstrapped.sheets,
      }).then(async (linkingState) => {
        if (cancelled) {
          return;
        }

        const evaluation = await evaluateSheet(evaluationDraft, {
          carryRoundedValues: settings.carryRoundedValues,
          importedSymbols: linkingState.importedSymbols,
          precision: settings.precision,
        });

        if (cancelled) {
          return;
        }

        const nextLines = applyPrecisionToLines(
          evaluation.lines,
          settings.precision,
          settings.carryRoundedValues,
          settings.decimalSeparator
        );

        startTransition(() => {
          setCompletionSymbols((current) =>
            sheetSymbolsEqual(current, linkingState.completionSymbols)
              ? current
              : linkingState.completionSymbols
          );
          setImportableSymbols((current) =>
            sheetSymbolsEqual(current, linkingState.importableSymbols)
              ? current
              : linkingState.importableSymbols
          );
          setEvaluatedLines((current) =>
            sheetEditorLinesEqual(current, nextLines) ? current : nextLines
          );
        });
      });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [
    activeSheetId,
    bootstrapped,
    editingTitleSheetId,
    evaluationDraft,
    settings.carryRoundedValues,
    settings.decimalSeparator,
    settings.precision,
  ]);

  useEffect(() => {
    writeAppSettings(settings);
  }, [settings]);

  const handleWindowKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const usesPrimaryModifier =
      (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;

    if (!usesPrimaryModifier) {
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
    window.addEventListener("keydown", handleWindowKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown, true);
    };
  }, [handleWindowKeyDown]);

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

  if (!bootstrapped || !activeSheet) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-foreground">
        Opening Rekna…
      </div>
    );
  }

  return (
    <div
      className="relative grid h-full min-h-0 grid-rows-[2.5rem_minmax(0,1fr)_1.75rem] overflow-hidden bg-background text-foreground"
      data-theme={settings.nightMode ? "dark" : "light"}
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
          importableSymbols={importableSymbols}
          lines={evaluatedLines}
          onChange={setDraft}
          onScrollStateChange={setHeaderElevated}
          value={draft}
          workspaceTags={availableTags}
        />
      </main>

      <footer
        className="flex h-7 w-full max-w-full shrink-0 items-center overflow-hidden border-t border-border/60 px-4 font-sans text-[0.6875rem] leading-none text-muted-foreground/80"
        data-testid="shortcut-footer"
      >
        <div className="flex w-full min-w-0 items-center justify-between gap-4 overflow-hidden">
          <div className="flex min-w-0 items-center gap-3 overflow-hidden whitespace-nowrap">
            {LIBRARY_SHORTCUTS.map((shortcut, index) => (
              <ShortcutHint
                hideClassName={shortcut.hideClassName}
                key={shortcut.label}
                keys={shortcut.keys}
                label={shortcut.label}
                showSeparator={index < LIBRARY_SHORTCUTS.length - 1}
              />
            ))}
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap max-[640px]:hidden">
            {EDITOR_SHORTCUTS.map((shortcut, index) => (
              <ShortcutHint
                hideClassName={shortcut.hideClassName}
                key={shortcut.label}
                keys={shortcut.keys}
                label={shortcut.label}
                showSeparator={index < EDITOR_SHORTCUTS.length - 1}
              />
            ))}
          </div>
        </div>
      </footer>

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

                  activateSheet(nextSheet);

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
              onCreateWorkspace={() => {}}
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
              onNightModeChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  nightMode: value,
                }))
              }
              onOpenWorkspaceFolder={() => {}}
              onPrecisionChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  precision: clampPrecision(value),
                }))
              }
              settings={settings}
              workspaceActionError={null}
              workspaceActionState={null}
              workspaceSelection={null}
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
    activateSheet(nextSheet);
    closePanel();
    syncSearchResultsAfterMutation(nextSheet);
  }

  function openLibraryPanel({
    focusSearch = false,
  }: { focusSearch?: boolean } = {}) {
    setPanelView("library");
    setPanelOpen(true);

    if (focusSearch) {
      setLibrarySearchFocusToken((current) => current + 1);
    }
  }

  function openSettingsPanel() {
    setPanelView("settings");
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setQuery("");
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
      activateSheet(replacement);
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

    activateSheet(nextActiveSheet);
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

  function activateSheet(nextSheet: SheetRecord) {
    persistedDraftRef.current = nextSheet.body;
    setCompletionSymbols([]);
    setImportableSymbols([]);
    setEvaluatedLines([]);
    setActiveSheetId(nextSheet.id);
    setDraft(readDraftSnapshot(nextSheet.id, nextSheet.body));
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
  hideClassName,
  keys,
  label,
  showSeparator,
}: {
  hideClassName?: string;
  keys: string[];
  label: string;
  showSeparator?: boolean;
}) {
  return (
    <>
      <div
        className={`flex min-w-0 items-center gap-2 ${hideClassName ?? ""}`.trim()}
      >
        <span className="truncate text-muted-foreground/85">{label}</span>
        <span className="flex shrink-0 items-center gap-1">
          {keys.map((key) => (
            <kbd
              className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm border border-border/80 bg-secondary/70 px-1 font-mono text-[0.625rem] font-medium text-foreground/90 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]"
              key={key}
            >
              {key}
            </kbd>
          ))}
        </span>
      </div>
      {showSeparator ? (
        <span aria-hidden="true" className="shrink-0 text-border/80">
          •
        </span>
      ) : null}
    </>
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

function readAppSettings(): AppSettings {
  if (typeof window === "undefined") {
    return defaultAppSettings();
  }

  try {
    const cached = window.sessionStorage.getItem("linea:settings");
    if (!cached) {
      return defaultAppSettings();
    }

    const parsed = JSON.parse(cached) as Partial<AppSettings>;

    return {
      carryRoundedValues: parsed.carryRoundedValues ?? false,
      decimalSeparator: parsed.decimalSeparator === "comma" ? "comma" : "dot",
      fontMode:
        parsed.fontMode === "compact" ||
        parsed.fontMode === "dynamic" ||
        parsed.fontMode === "large"
          ? parsed.fontMode
          : "dynamic",
      nightMode: parsed.nightMode ?? true,
      precision: clampPrecision(parsed.precision ?? 2),
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
    nightMode: true,
    precision: 2,
  };
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

function filterSheetsByTags(sheets: SheetRecord[], selectedTags: string[]) {
  if (selectedTags.length === 0) {
    return sheets;
  }

  return sheets.filter((sheet) => {
    const tagSet = new Set(sheet.tags ?? []);
    return selectedTags.every((tag) => tagSet.has(tag));
  });
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

function applyPrecisionToLines(
  lines: Awaited<ReturnType<typeof evaluateSheet>>["lines"],
  precision: number,
  carryRoundedValues: boolean,
  decimalSeparator: "comma" | "dot"
): SheetEditorLine[] {
  return lines.map(
    (line: Awaited<ReturnType<typeof evaluateSheet>>["lines"][number]) => ({
      ...line,
      displayValueMeta: getDisplayValueMeta(
        line.displayValue,
        precision,
        carryRoundedValues,
        decimalSeparator
      ),
      displayValue: formatDisplayValue(
        line.displayValue,
        precision,
        decimalSeparator
      ),
    })
  );
}

function formatDisplayValue(
  displayValue: string | null,
  precision: number,
  decimalSeparator: "comma" | "dot"
) {
  if (!displayValue) {
    return displayValue;
  }

  const parts = parseDisplayValueParts(displayValue);

  if (!parts) {
    return displayValue;
  }

  const formattedNumber = new Intl.NumberFormat(
    decimalSeparator === "comma" ? "de-DE" : "en-US",
    {
      maximumFractionDigits: precision,
      useGrouping: false,
    }
  ).format(parts.numericValue);

  return `${formattedNumber}${parts.suffix}`;
}

function parseDisplayValueParts(displayValue: string) {
  const exactNumberMatch = displayValue.match(
    /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i
  );

  if (exactNumberMatch) {
    const numericValue = Number(displayValue);

    if (!Number.isFinite(numericValue)) {
      return null;
    }

    return {
      numericValue,
      suffix: "",
    };
  }

  const numberWithSuffixMatch = displayValue.match(
    /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(\s+[^\d].*)$/i
  );

  if (!numberWithSuffixMatch) {
    return null;
  }

  const numericValue = Number(numberWithSuffixMatch[1]);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return {
    numericValue,
    suffix: numberWithSuffixMatch[2] ?? "",
  };
}

function getDisplayValueMeta(
  displayValue: string | null,
  precision: number,
  carryRoundedValues: boolean,
  decimalSeparator: "comma" | "dot"
) {
  if (!displayValue) {
    return undefined;
  }

  const formattedValue = formatDisplayValue(
    displayValue,
    precision,
    decimalSeparator
  );

  if (formattedValue === displayValue) {
    return undefined;
  }

  return {
    carryMode: carryRoundedValues ? "rounded" : "full-precision",
    fullPrecisionValue: displayValue,
  } satisfies SheetEditorLine["displayValueMeta"];
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

function scheduleBackgroundWork(task: () => void) {
  const browserWindow = globalThis as typeof globalThis & Window;

  if (typeof browserWindow.setTimeout !== "function") {
    return {
      cancel: () => {},
    };
  }

  if (typeof browserWindow.requestIdleCallback === "function") {
    const idleId = browserWindow.requestIdleCallback(task, { timeout: 120 });
    return {
      cancel: () => browserWindow.cancelIdleCallback(idleId),
    };
  }

  const timeoutId = browserWindow.setTimeout(task, 16);
  return {
    cancel: () => browserWindow.clearTimeout(timeoutId),
  };
}

function tryGetRpc() {
  const electrobun = getElectrobun();

  return electrobun?.rpc ?? null;
}
