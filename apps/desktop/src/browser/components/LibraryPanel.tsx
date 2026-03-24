import { buildSheetPlainText, fuzzySearchStrings } from "@linea/shared";
import {
  Check,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";

type LibrarySheetRecord = {
  body: string;
  id: string;
  tags?: string[];
  title: string;
};

type LibrarySearchResult = {
  id: string;
  snippet: string;
  tags?: string[];
  title: string;
};

type OpenSheetOptions = {
  keepPanelOpen?: boolean;
};

type LibraryPanelProps = {
  activeSheetId?: string | null;
  availableTags?: string[];
  onClose: () => void;
  onCreateSheet: () => void;
  onDeleteSheet?: (sheetId: string) => void;
  onDeleteSheets?: (sheetIds: string[]) => void;
  onOpenSettings: () => void;
  onOpenSheet: (sheetId: string, options?: OpenSheetOptions) => void;
  onQueryChange: (value: string) => void;
  onRenameSheet?: (sheetId: string, title: string) => void;
  onSelectedTagsChange?: (tags: string[]) => void;
  open?: boolean;
  query: string;
  results: LibrarySearchResult[];
  searchFocusToken?: number;
  selectedTags?: string[];
  sheets: LibrarySheetRecord[];
};

export function LibraryPanel({
  activeSheetId,
  availableTags = [],
  onClose,
  onCreateSheet,
  onDeleteSheet,
  onDeleteSheets,
  onOpenSettings,
  onOpenSheet,
  onQueryChange,
  onRenameSheet,
  onSelectedTagsChange,
  open = true,
  query,
  results,
  searchFocusToken = 0,
  selectedTags = [],
  sheets,
}: LibraryPanelProps) {
  const items = query ? results : sheets;
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const lastFocusedSearchTokenRef = useRef(searchFocusToken);
  const [renameSheetId, setRenameSheetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteSheetId, setDeleteSheetId] = useState<string | null>(null);
  const [openSheetActionsId, setOpenSheetActionsId] = useState<string | null>(
    null
  );
  const [pendingSheetActionsId, setPendingSheetActionsId] = useState<
    string | null
  >(null);
  const [selectedSheetIds, setSelectedSheetIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(
    null
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const itemIds = items.map((item) => item.id);
  const itemIdsKey = itemIds.join("\u0000");
  const selectedSheetCount = selectedSheetIds.length;
  const itemIdsRef = useRef(itemIds);
  const activeSheetIdRef = useRef(activeSheetId);
  const selectionAnchorIdRef = useRef(selectionAnchorId);

  itemIdsRef.current = itemIds;
  activeSheetIdRef.current = activeSheetId;
  selectionAnchorIdRef.current = selectionAnchorId;

  useEffect(() => {
    const nextItemIds = itemIdsKey ? itemIdsKey.split("\u0000") : [];

    setSelectedSheetIds((current) => {
      const next = current.filter((sheetId) => nextItemIds.includes(sheetId));
      return next.length === current.length &&
        next.every((sheetId, index) => sheetId === current[index])
        ? current
        : next;
    });
    setSelectionAnchorId((current) =>
      current && nextItemIds.includes(current) ? current : null
    );
  }, [itemIdsKey]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

    const nextItemIds = itemIdsKey ? itemIdsKey.split("\u0000") : [];
    const nextSelectionAnchorId = nextItemIds[0] ?? null;

    setSelectedSheetIds((current) => (current.length === 0 ? current : []));
    setSelectionAnchorId((current) =>
      current === nextSelectionAnchorId ? current : nextSelectionAnchorId
    );
  }, [itemIdsKey, open, query]);

  useEffect(() => {
    if (!open) {
      clearSelection();
      setOpenSheetActionsId(null);
      setPendingSheetActionsId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!pendingSheetActionsId) {
      return;
    }

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button !== 2) {
        return;
      }

      setOpenSheetActionsId(pendingSheetActionsId);
      setPendingSheetActionsId(null);
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [pendingSheetActionsId]);

  useEffect(() => {
    if (!open || searchFocusToken === lastFocusedSearchTokenRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    lastFocusedSearchTokenRef.current = searchFocusToken;

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open, searchFocusToken]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const nextItemIds = itemIdsRef.current;
      const activeElement = document.activeElement;
      const activeSheetId = activeSheetIdRef.current;
      const selectionAnchorId = selectionAnchorIdRef.current;
      const getNavigableSheetId = () =>
        selectionAnchorId && nextItemIds.includes(selectionAnchorId)
          ? selectionAnchorId
          : activeSheetId && nextItemIds.includes(activeSheetId)
            ? activeSheetId
            : (nextItemIds[0] ?? null);

      if (
        (event.key === "ArrowDown" || event.key === "ArrowUp") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        canNavigateVisibleSheets(activeElement, searchInputRef.current)
      ) {
        const currentSheetId = getNavigableSheetId();
        const currentIndex = currentSheetId
          ? nextItemIds.indexOf(currentSheetId)
          : -1;
        const targetIndex =
          event.key === "ArrowDown"
            ? currentIndex === -1
              ? 0
              : Math.min(currentIndex + 1, nextItemIds.length - 1)
            : currentIndex === -1
              ? nextItemIds.length - 1
              : Math.max(currentIndex - 1, 0);
        const targetSheetId = nextItemIds[targetIndex];

        if (!targetSheetId) {
          return;
        }

        event.preventDefault();
        setSelectedSheetIds([]);
        setSelectionAnchorId(targetSheetId);
        return;
      }

      if (
        event.key === "Enter" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        canNavigateVisibleSheets(activeElement, searchInputRef.current)
      ) {
        const targetSheetId = getNavigableSheetId();

        if (!targetSheetId) {
          return;
        }

        event.preventDefault();
        setSelectedSheetIds([]);
        setSelectionAnchorId(targetSheetId);
        onOpenSheet(targetSheetId);
        return;
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "a" &&
        !isTextEntryElement(activeElement)
      ) {
        event.preventDefault();
        setSelectedSheetIds(nextItemIds);
        setSelectionAnchorId(nextItemIds.at(-1) ?? null);
        return;
      }

      if (event.key === "Escape") {
        setBulkDeleteOpen(false);
        clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpenSheet, open]);

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4 bg-popover px-4 py-3.5 text-popover-foreground">
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">
            Library
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            aria-label="New sheet"
            onClick={onCreateSheet}
            size="icon-sm"
            title="New sheet"
            type="button"
            variant="ghost"
          >
            <Plus className="size-4" />
          </Button>
          <Button
            aria-label="Open settings"
            onClick={onOpenSettings}
            size="icon-sm"
            title="Open settings"
            type="button"
            variant="ghost"
          >
            <Settings2 className="size-4" />
          </Button>
          <Button
            aria-label="Close"
            onClick={onClose}
            size="icon-sm"
            title="Close"
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1.5" htmlFor="sheet-search">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                className="pr-2.5 pl-8"
                id="sheet-search"
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search..."
                type="search"
                value={query}
              />
            </div>
            <TagFilterPopover
              availableTags={availableTags}
              onChange={onSelectedTagsChange}
              selectedTags={selectedTags}
            />
          </div>
        </label>

        {selectedTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <RemovableTagChip
                key={tag}
                label={tag}
                onRemove={() =>
                  onSelectedTagsChange?.(
                    selectedTags.filter((selectedTag) => selectedTag !== tag)
                  )
                }
                removeLabel={`Remove ${tag} filter`}
              />
            ))}
          </div>
        ) : null}
      </div>

      {selectedSheetCount > 0 ? (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 py-2 shadow-xs">
          <p className="text-[0.75rem] font-medium">{`${selectedSheetCount} selected`}</p>
          <div className="flex items-center gap-1">
            <Button
              onClick={clearSelection}
              size="xs"
              type="button"
              variant="ghost"
            >
              Clear
            </Button>
            <Button
              onClick={() => setBulkDeleteOpen(true)}
              size="xs"
              type="button"
              variant="destructive"
            >
              <Trash2 className="size-3" />
              Delete selected
            </Button>
          </div>
        </div>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-2">
            {items.map((item) => {
              const itemTags = normalizeTags(item.tags);
              const isRenaming = renameSheetId === item.id;
              const isActive = activeSheetId === item.id;
              const isSelected = selectedSheetIds.includes(item.id);
              const isKeyboardActive =
                !isSelected &&
                selectionAnchorId === item.id &&
                selectionAnchorId !== activeSheetId;
              const subtitle =
                "snippet" in item
                  ? item.snippet
                  : (buildSheetPlainText(item.body)
                      .split(/\r?\n/)
                      .find(Boolean) ?? "Empty sheet");

              return (
                <div
                  className={[
                    "min-w-0 max-w-full rounded-2xl border bg-background/80 p-2 shadow-xs transition-colors duration-150 hover:duration-0",
                    isSelected
                      ? "border-primary/40 bg-secondary/45 hover:border-primary/45 hover:bg-secondary/50"
                      : isKeyboardActive
                        ? "border-primary/20 bg-accent/18 hover:border-primary/25 hover:bg-accent/24"
                        : isActive
                          ? "border-primary/25 bg-secondary/30 hover:border-primary/30 hover:bg-secondary/35"
                          : "border-border/60 hover:border-border/80 hover:bg-accent/20",
                  ].join(" ")}
                  data-active={isActive ? "true" : "false"}
                  data-highlighted={isKeyboardActive ? "true" : "false"}
                  key={item.id}
                  onContextMenu={(event) =>
                    handleSheetContextMenu(event, item.id)
                  }
                >
                  <div className="flex min-w-0 max-w-full items-start gap-2">
                    <Checkbox
                      aria-label={`Select ${item.title}`}
                      checked={isSelected}
                      className="mt-2.5"
                      onClick={(event) => {
                        event.preventDefault();
                        handleSheetSelection(item.id, {
                          append: true,
                          range: event.shiftKey,
                        });
                      }}
                    />

                    {isRenaming ? (
                      <Input
                        aria-label={`Rename ${item.title}`}
                        autoFocus
                        onBlur={(event) => {
                          commitRename(
                            item.id,
                            item.title,
                            event.currentTarget.value
                          );
                        }}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitRename(
                              item.id,
                              item.title,
                              event.currentTarget.value
                            );
                          }

                          if (event.key === "Escape") {
                            event.preventDefault();
                            cancelRename();
                          }
                        }}
                        value={renameValue}
                      />
                    ) : (
                      <div className="flex min-w-0 max-w-full flex-1 flex-col gap-2">
                        <div className="flex min-w-0 max-w-full items-start gap-2">
                          <Button
                            className="h-auto min-w-0 max-w-full flex-1 shrink items-start justify-start overflow-hidden rounded-xl px-2.5 py-2.5 text-left whitespace-normal hover:bg-transparent hover:text-foreground active:bg-transparent dark:hover:bg-transparent"
                            onClick={(event) =>
                              handleSheetClick(event, item.id)
                            }
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="truncate text-[0.8125rem] font-medium">
                                {item.title}
                              </span>
                              <span className="text-muted-foreground line-clamp-2 text-[0.75rem] leading-[1.15rem]">
                                {subtitle}
                              </span>
                            </div>
                          </Button>

                          <div className="flex shrink-0 items-center gap-1">
                            <DropdownMenu
                              onOpenChange={(open) => {
                                setPendingSheetActionsId((current) =>
                                  current === item.id ? null : current
                                );
                                setOpenSheetActionsId((current) =>
                                  open
                                    ? item.id
                                    : current === item.id
                                      ? null
                                      : current
                                );
                              }}
                              open={openSheetActionsId === item.id}
                            >
                              <Button asChild size="icon-xs" variant="ghost">
                                <DropdownMenuTrigger
                                  aria-label={`Sheet actions for ${item.title}`}
                                  type="button"
                                >
                                  <MoreHorizontal className="size-3.5" />
                                </DropdownMenuTrigger>
                              </Button>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setRenameSheetId(item.id);
                                    setRenameValue(item.title);
                                  }}
                                >
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => setDeleteSheetId(item.id)}
                                  variant="destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {itemTags.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 px-2.5">
                            {itemTags.map((tag) => (
                              <Badge
                                className="rounded-full px-2 py-0 text-[0.625rem]"
                                key={tag}
                                variant="secondary"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <AlertDialog
                    onOpenChange={(open) => {
                      if (!open && deleteSheetId === item.id) {
                        setDeleteSheetId(null);
                      }
                    }}
                    open={deleteSheetId === item.id}
                  >
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete sheet?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {`This will permanently remove "${item.title}".`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel type="button">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            setDeleteSheetId(null);
                            onDeleteSheet?.(item.id);
                          }}
                          type="button"
                        >
                          Delete sheet
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })}

            {items.length === 0 ? (
              <p className="text-muted-foreground px-1 text-xs">
                Nothing matched yet.
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </section>

      <AlertDialog onOpenChange={setBulkDeleteOpen} open={bulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`Delete ${formatSheetCount(selectedSheetCount)}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {`This will permanently remove ${formatSheetCount(selectedSheetCount)}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const nextSelectedSheetIds = [...selectedSheetIds];
                setBulkDeleteOpen(false);
                clearSelection();
                onDeleteSheets?.(nextSelectedSheetIds);
              }}
              type="button"
            >
              {`Delete ${formatSheetCount(selectedSheetCount)}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );

  function handleSheetClick(
    event: ReactMouseEvent<HTMLButtonElement>,
    sheetId: string
  ) {
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      event.preventDefault();
      handleSheetSelection(sheetId, {
        append: event.metaKey || event.ctrlKey,
        range: event.shiftKey,
      });
      return;
    }

    clearSelection();
    setSelectionAnchorId(sheetId);
    onOpenSheet(sheetId);
  }

  function handleSheetContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    sheetId: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (!selectedSheetIds.includes(sheetId)) {
      clearSelection();
    }

    setSelectionAnchorId(sheetId);
    if (event.button === 2) {
      setOpenSheetActionsId(null);
      setPendingSheetActionsId(sheetId);
      return;
    }

    setPendingSheetActionsId(null);
    setOpenSheetActionsId(sheetId);
  }

  function handleSheetSelection(
    sheetId: string,
    {
      append = false,
      range = false,
    }: {
      append?: boolean;
      range?: boolean;
    }
  ) {
    setSelectedSheetIds((current) => {
      if (range) {
        const anchorId = selectionAnchorId ?? current.at(-1) ?? sheetId;
        const anchorIndex = itemIds.indexOf(anchorId);
        const targetIndex = itemIds.indexOf(sheetId);

        if (anchorIndex === -1 || targetIndex === -1) {
          return appendSelection(current, [sheetId]);
        }

        return appendSelection(
          current,
          itemIds.slice(
            Math.min(anchorIndex, targetIndex),
            Math.max(anchorIndex, targetIndex) + 1
          )
        );
      }

      if (append) {
        return current.includes(sheetId)
          ? current.filter((currentSheetId) => currentSheetId !== sheetId)
          : [...current, sheetId];
      }

      return current.includes(sheetId) && current.length === 1 ? [] : [sheetId];
    });

    setSelectionAnchorId(sheetId);
  }

  function clearSelection() {
    setSelectedSheetIds([]);
    setSelectionAnchorId(null);
  }

  function appendSelection(current: string[], nextSheetIds: string[]) {
    return uniqueSheetIds([...current, ...nextSheetIds]);
  }

  function cancelRename() {
    setRenameSheetId(null);
    setRenameValue("");
  }

  function commitRename(
    sheetId: string,
    currentTitle: string,
    nextValue = renameValue
  ) {
    const nextTitle = nextValue.trim();
    cancelRename();

    if (!nextTitle || nextTitle === currentTitle) {
      return;
    }

    onRenameSheet?.(sheetId, nextTitle);
  }
}

function uniqueSheetIds(sheetIds: string[]) {
  return [...new Set(sheetIds)];
}

function formatSheetCount(count: number) {
  return `${count} ${count === 1 ? "sheet" : "sheets"}`;
}

function isTextEntryElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  return (
    element.isContentEditable ||
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA"
  );
}

function canNavigateVisibleSheets(
  activeElement: Element | null,
  searchInput: HTMLInputElement | null
) {
  return !isTextEntryElement(activeElement) || activeElement === searchInput;
}

type RemovableTagChipProps = {
  label: string;
  onRemove: () => void;
  removeLabel: string;
  size?: "default" | "sm";
};

function RemovableTagChip({
  label,
  onRemove,
  removeLabel,
  size = "default",
}: RemovableTagChipProps) {
  return (
    <Badge
      className={[
        "group gap-1 rounded-full pr-1",
        size === "sm" ? "px-2 py-0 text-[0.625rem]" : "",
      ].join(" ")}
      variant="secondary"
    >
      <span>{label}</span>
      <button
        aria-label={removeLabel}
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/10 focus-visible:opacity-100 focus-visible:outline-none dark:hover:bg-white/10"
        onClick={onRemove}
        type="button"
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}

type TagFilterPopoverProps = {
  availableTags: string[];
  onChange?: (tags: string[]) => void;
  selectedTags: string[];
};

function TagFilterPopover({
  availableTags,
  onChange,
  selectedTags,
}: TagFilterPopoverProps) {
  const [query, setQuery] = useState("");
  const visibleTags = fuzzySearchStrings(availableTags, query);

  return (
    <Popover>
      <Button
        asChild
        size="icon"
        variant={selectedTags.length > 0 ? "secondary" : "ghost"}
      >
        <PopoverTrigger aria-label="Filter by tags" type="button">
          <Filter className="size-4" />
        </PopoverTrigger>
      </Button>
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-end">
            {selectedTags.length > 0 ? (
              <Button
                onClick={() => onChange?.([])}
                size="xs"
                type="button"
                variant="ghost"
              >
                Clear
              </Button>
            ) : null}
          </div>
          <Input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tags"
            type="search"
            value={query}
          />
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {visibleTags.map((tag) => (
              <TagOptionButton
                checked={selectedTags.includes(tag)}
                key={tag}
                label={tag}
                onClick={() =>
                  onChange?.(
                    selectedTags.includes(tag)
                      ? selectedTags.filter(
                          (selectedTag) => selectedTag !== tag
                        )
                      : uniqueTags([...selectedTags, tag])
                  )
                }
              />
            ))}

            {visibleTags.length === 0 ? (
              <p className="text-muted-foreground px-1 py-2 text-xs">
                No tags found.
              </p>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type TagOptionButtonProps = {
  checked: boolean;
  label: string;
  onClick: () => void;
};

function TagOptionButton({ checked, label, onClick }: TagOptionButtonProps) {
  return (
    <button
      className="flex items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition hover:bg-accent hover:text-accent-foreground"
      onClick={onClick}
      type="button"
    >
      <span
        aria-hidden="true"
        className={[
          "flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-input bg-input/40 text-primary transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "text-transparent",
        ].join(" ")}
      >
        <Check className="size-3" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {checked ? <Check className="size-3.5 text-muted-foreground" /> : null}
    </button>
  );
}

function normalizeTags(tags: string[] | undefined) {
  return uniqueTags(tags ?? []);
}

function uniqueTags(tags: string[]) {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}
