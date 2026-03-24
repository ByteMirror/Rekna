import {
  autocompletion,
  completionStatus,
  currentCompletions,
  selectedCompletion,
  selectedCompletionIndex,
  startCompletion,
} from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState, Prec } from "@codemirror/state";
import {
  Direction,
  EditorView,
  type Rect,
  drawSelection,
  keymap,
  tooltips,
} from "@codemirror/view";
import { basicSetup } from "codemirror";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CircleHelp, Copy } from "lucide-react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";

import type { EvaluatedLine } from "@linea/calc-engine";
import {
  calculateCompletionInfoLayout,
  type CompletionOverlayUpdate,
  OPEN_SHEET_SEARCH_EVENT,
  getDesktopWindowContext,
} from "@linea/shared";

import {
  type LineaCompletion,
  calculateCompletionOverlayLayout,
  createHiddenCompletionOverlayUpdate,
  getCompletionOverlayInfo,
} from "../lib/completion-overlay";
import { getElectrobun } from "../lib/rpc";
import {
  SELECTION_BOTTOM_LEFT_CLASS,
  SELECTION_BOTTOM_RIGHT_CLASS,
  SELECTION_TOP_LEFT_CLASS,
  SELECTION_TOP_RIGHT_CLASS,
  selectionShapeExtension,
} from "../lib/selection-shape";
import {
  type SheetSymbol,
  sheetCompletionSource,
} from "../lib/sheet-autocomplete";
import { sheetSyntaxHighlighting } from "../lib/sheet-syntax-highlighting";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export type SheetEditorLine = EvaluatedLine & {
  displayValueMeta?: {
    carryMode: "full-precision" | "rounded";
    fullPrecisionValue: string;
  };
};

type SheetEditorProps = {
  completionSymbols?: SheetSymbol[];
  documentId: string;
  lines: SheetEditorLine[];
  onChange: (value: string) => void;
  onScrollStateChange?: (isScrolled: boolean) => void;
  value: string;
  workspaceTags?: string[];
};

const EDITOR_LINE_HEIGHT = 32;
const EDITOR_CONTENT_TOP_PADDING = 16;
const EDITOR_CONTENT_BOTTOM_PADDING = 30;
const EDITOR_CONTENT_HORIZONTAL_PADDING = 4;
const LINEA_CLIPBOARD_MIME = "application/x-linea-clipboard";
const MAX_RESULT_DISPLAY_CHARACTERS = 10;
const RESULT_TRUNCATION_ELLIPSIS = "...";
const FIXED_RESULT_VALUE_WIDTH_CH =
  MAX_RESULT_DISPLAY_CHARACTERS + RESULT_TRUNCATION_ELLIPSIS.length;
const FIXED_RESULTS_COLUMN_PADDING_REM = 3;
const FIXED_RESULTS_ROUNDED_DETAIL_ALLOWANCE_REM = 2;
export type ResultLineSlot = {
  height: number;
  top: number;
};

export function SheetEditor({
  completionSymbols = [],
  documentId,
  lines,
  onChange,
  onScrollStateChange,
  value,
  workspaceTags = [],
}: SheetEditorProps) {
  const electrobunRef = useRef(getElectrobun());
  const overlaySyncFrameRef = useRef<number | null>(null);
  const horizontalOverflowSyncFrameRef = useRef<number | null>(null);
  const resultSlotSyncFrameRef = useRef<number | null>(null);
  const lastOverlaySignatureRef = useRef<string | null>(null);
  const horizontalScrollViewportRef = useRef<HTMLDivElement | null>(null);
  const sheetScrollRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const initialValueRef = useRef(value);
  const latestChangeRef = useRef(onChange);
  const latestScrollStateChangeRef = useRef(onScrollStateChange);
  const latestCompletionSymbolsRef = useRef(completionSymbols);
  const latestWorkspaceTagsRef = useRef(workspaceTags);
  const activeDocumentIdRef = useRef(documentId);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [resultsColumnWidthCh, setResultsColumnWidthCh] = useState(() =>
    getResultsColumnWidthCh(lines)
  );
  const [resultLineSlots, setResultLineSlots] = useState<ResultLineSlot[]>(() =>
    createFallbackResultLineSlots(lines.length)
  );
  const [resultColumnHeight, setResultColumnHeight] = useState(() =>
    getFallbackResultColumnHeight(lines.length)
  );
  const [showHorizontalOverflowShadow, setShowHorizontalOverflowShadow] =
    useState(false);
  const latestLinesRef = useRef(lines);
  const resultsColumnWidthDocumentIdRef = useRef(documentId);
  const resultsColumnAccessoryDocumentIdRef = useRef(documentId);
  const [resultsColumnAccessoryWidthRem, setResultsColumnAccessoryWidthRem] =
    useState(() => getResultsColumnAccessoryWidthRem(lines));
  const resultsColumnWidth = formatResultsColumnWidth(
    resultsColumnWidthCh,
    resultsColumnAccessoryWidthRem
  );

  latestChangeRef.current = onChange;
  latestLinesRef.current = lines;
  latestScrollStateChangeRef.current = onScrollStateChange;
  latestCompletionSymbolsRef.current = completionSymbols;
  latestWorkspaceTagsRef.current = workspaceTags;

  useEffect(() => {
    if (!rootRef.current || viewRef.current) {
      return;
    }

    const nativeCompletionOverlayEnabled =
      getDesktopWindowContext()?.nativeCompletionOverlayEnabled === true;
    const tooltipParent = resolveTooltipParent(rootRef.current);
    const scheduleResultLineSlotSync = (view: EditorView) => {
      if (resultSlotSyncFrameRef.current !== null) {
        cancelEditorFrame(resultSlotSyncFrameRef.current);
      }

      resultSlotSyncFrameRef.current = requestEditorFrame(() => {
        resultSlotSyncFrameRef.current = null;

        const { height, slots } = measureResultLineSlots(
          view,
          latestLinesRef.current.length
        );

        setResultLineSlots((currentSlots) =>
          resultLineSlotsEqual(currentSlots, slots) ? currentSlots : slots
        );
        setResultColumnHeight((currentHeight) =>
          Math.abs(currentHeight - height) <= 0.5 ? currentHeight : height
        );
      });
    };
    const scheduleCompletionOverlaySync = (view: EditorView) => {
      const root = rootRef.current;

      if (!nativeCompletionOverlayEnabled || !root) {
        return;
      }

      if (overlaySyncFrameRef.current !== null) {
        cancelEditorFrame(overlaySyncFrameRef.current);
      }

      overlaySyncFrameRef.current = requestEditorFrame(() => {
        overlaySyncFrameRef.current = null;
        const nextRoot = rootRef.current;
        const overlayRpc = electrobunRef.current?.rpc;

        if (!nextRoot || !overlayRpc) {
          return;
        }

        const nextUpdate = buildCompletionOverlayUpdate(view, nextRoot);
        const nextSignature = JSON.stringify(nextUpdate);

        if (nextSignature === lastOverlaySignatureRef.current) {
          return;
        }

        lastOverlaySignatureRef.current = nextSignature;
        overlayRpc.send.updateCompletionOverlay(nextUpdate);
      });
    };
    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        basicSetup,
        Prec.highest(
          EditorState.languageData.of(() => [
            {
              commentTokens: {
                line: "//",
              },
            },
          ])
        ),
        markdown(),
        tooltips({
          parent: tooltipParent,
        }),
        autocompletion({
          activateOnTyping: true,
          activateOnTypingDelay: 75,
          override: [
            (context) =>
              sheetCompletionSource(context, {
                externalSymbols: latestCompletionSymbolsRef.current,
                workspaceTags: latestWorkspaceTagsRef.current,
              }),
          ],
          positionInfo: nativeCompletionOverlayEnabled
            ? positionHiddenCompletionInfo
            : positionCompletionInfo,
          selectOnOpen: true,
          tooltipClass: nativeCompletionOverlayEnabled
            ? () => "linea-completion-tooltip-hidden"
            : undefined,
        }),
        Prec.highest(
          keymap.of([
            {
              key: "Mod-f",
              run() {
                dispatchOpenSheetSearch();
                return true;
              },
            },
          ])
        ),
        Prec.high(
          keymap.of([
            {
              key: "Mod-/",
              run: handleToggleLineComment,
            },
            {
              key: "Mod-.",
              run: startCompletion,
            },
            {
              key: "Ctrl-.",
              run: startCompletion,
            },
          ])
        ),
        drawSelection({
          cursorBlinkRate: 1100,
        }),
        Prec.high(
          EditorView.domEventHandlers({
            copy(event, view) {
              return handleClipboardCopy(view, event, latestLinesRef.current);
            },
            cut(event, view) {
              return handleClipboardCut(view, event, latestLinesRef.current);
            },
            keydown(event, view) {
              if (isToggleLineCommentShortcut(event)) {
                event.preventDefault();
                event.stopPropagation();
                handleToggleLineComment(view);
                return true;
              }

              if (
                event.key.toLowerCase() === "f" &&
                (event.metaKey || event.ctrlKey) &&
                !event.altKey &&
                !event.shiftKey
              ) {
                event.preventDefault();
                event.stopPropagation();
                dispatchOpenSheetSearch();
                return true;
              }

              if (
                event.key === "." &&
                (event.metaKey || event.ctrlKey) &&
                !event.altKey
              ) {
                event.preventDefault();
                return startCompletion(view);
              }

              return false;
            },
            paste(event, view) {
              return handleClipboardPaste(view, event);
            },
          })
        ),
        selectionShapeExtension,
        sheetSyntaxHighlighting(),
        EditorView.theme({
          "&": {
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--editor-font-size, 18px)",
            height: "auto !important",
            minHeight: "100%",
            overflow: "visible",
            position: "relative",
          },
          ".cm-content": {
            backgroundColor: "transparent",
            caretColor: "var(--caret-color)",
            color: "var(--foreground)",
            minHeight: "100%",
            minWidth: "100%",
            padding: `${EDITOR_CONTENT_TOP_PADDING}px ${EDITOR_CONTENT_HORIZONTAL_PADDING}px ${EDITOR_CONTENT_BOTTOM_PADDING}px ${EDITOR_CONTENT_HORIZONTAL_PADDING}px`,
            whiteSpace: "pre",
            width: "max-content",
          },
          ".cm-line": {
            lineHeight: `${EDITOR_LINE_HEIGHT}px`,
            padding: "0 20px 0 6px",
            whiteSpace: "pre",
            width: "max-content",
          },
          ".cm-gutters": {
            display: "none",
          },
          ".cm-scroller": {
            backgroundColor: "transparent",
            fontFamily: "var(--font-mono)",
            height: "auto !important",
            overflowX: "visible !important",
            overflowY: "visible !important",
          },
          ".cm-cursorLayer": {
            animation: "none !important",
          },
          ".cm-activeLine": {
            backgroundColor: "transparent",
          },
          ".cm-cursor, .cm-dropCursor": {
            borderLeftColor: "var(--caret-color)",
          },
          ".cm-cursor": {
            backgroundColor: "var(--caret-color)",
            borderLeftWidth: "0",
            borderRadius: "999px",
            marginLeft: "-1px",
            opacity: "1",
            transition:
              "left 90ms cubic-bezier(0.2, 0, 0, 1), top 90ms cubic-bezier(0.2, 0, 0, 1), height 90ms cubic-bezier(0.2, 0, 0, 1), opacity 120ms ease-in-out",
            width: "3px",
          },
          ".cm-cursor.cm-cursor-primary": {
            animation: "linea-caret-blink 1.1s ease-in-out infinite",
          },
          "&.cm-focused": {
            outline: "none",
          },
          ".cm-selectionBackground": {
            background: "var(--selection)",
            backgroundColor: "var(--selection)",
            boxSizing: "border-box",
            height: "calc(100% + (var(--selection-inset) * 2))",
            margin: "calc(var(--selection-inset) * -1)",
            opacity: "1",
            borderRadius: "0",
            width: "calc(100% + (var(--selection-inset) * 2))",
          },
          "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground":
            {
              background: "var(--selection)",
              backgroundColor: "var(--selection)",
              opacity: "1",
            },
          [`.cm-selectionBackground.${SELECTION_TOP_LEFT_CLASS}`]: {
            borderTopLeftRadius: "var(--selection-radius)",
          },
          [`.cm-selectionBackground.${SELECTION_TOP_RIGHT_CLASS}`]: {
            borderTopRightRadius: "var(--selection-radius)",
          },
          [`.cm-selectionBackground.${SELECTION_BOTTOM_LEFT_CLASS}`]: {
            borderBottomLeftRadius: "var(--selection-radius)",
          },
          [`.cm-selectionBackground.${SELECTION_BOTTOM_RIGHT_CLASS}`]: {
            borderBottomRightRadius: "var(--selection-radius)",
          },
          ".linea-token-comment": {
            color: "var(--syntax-comment)",
            fontStyle: "italic",
          },
          ".linea-token-heading, .linea-token-heading *": {
            borderBottom: "none",
            color: "var(--syntax-heading)",
            fontWeight: "700",
            letterSpacing: "-0.01em",
            textDecoration: "none",
          },
          ".linea-token-label": {
            color: "var(--syntax-label)",
            fontWeight: "600",
          },
          ".linea-token-object": {
            color: "var(--syntax-object)",
            fontWeight: "600",
          },
          ".linea-token-variable": {
            color: "var(--syntax-variable)",
          },
          ".linea-token-function": {
            color: "var(--syntax-function)",
            fontWeight: "500",
          },
          ".linea-token-keyword": {
            color: "var(--syntax-keyword)",
            fontWeight: "600",
          },
          ".linea-token-operator": {
            color: "var(--syntax-operator)",
          },
          ".linea-token-number": {
            color: "var(--syntax-number)",
          },
          ".linea-token-unit": {
            color: "var(--syntax-unit)",
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            latestChangeRef.current(update.state.doc.toString());
          }

          if (
            update.docChanged ||
            update.geometryChanged ||
            update.viewportChanged
          ) {
            scheduleResultLineSlotSync(update.view);
          }

          if (nativeCompletionOverlayEnabled) {
            scheduleCompletionOverlaySync(update.view);
          }
        }),
      ],
    });

    viewRef.current = new EditorView({
      parent: rootRef.current,
      state,
    });
    const sheetScroller = sheetScrollRef.current;

    const handleSheetScroll = () => {
      latestScrollStateChangeRef.current?.(
        (sheetScroller?.scrollTop ?? 0) > 0.5
      );

      if (viewRef.current) {
        scheduleCompletionOverlaySync(viewRef.current);
      }
    };

    sheetScroller?.addEventListener("scroll", handleSheetScroll, {
      passive: true,
    });

    const handleWindowResize = () => {
      if (viewRef.current) {
        scheduleCompletionOverlaySync(viewRef.current);
      }
    };

    if (nativeCompletionOverlayEnabled) {
      window.addEventListener("resize", handleWindowResize);
      scheduleCompletionOverlaySync(viewRef.current);
    }

    scheduleResultLineSlotSync(viewRef.current);

    latestScrollStateChangeRef.current?.((sheetScroller?.scrollTop ?? 0) > 0.5);

    return () => {
      sheetScroller?.removeEventListener("scroll", handleSheetScroll);

      if (overlaySyncFrameRef.current !== null) {
        cancelEditorFrame(overlaySyncFrameRef.current);
        overlaySyncFrameRef.current = null;
      }

      if (resultSlotSyncFrameRef.current !== null) {
        cancelEditorFrame(resultSlotSyncFrameRef.current);
        resultSlotSyncFrameRef.current = null;
      }

      if (nativeCompletionOverlayEnabled) {
        window.removeEventListener("resize", handleWindowResize);
        const hiddenOverlay = createHiddenCompletionOverlayUpdate(
          readCompletionOverlayTheme(rootRef.current ?? document.body)
        );
        const overlayRpc = electrobunRef.current?.rpc;

        lastOverlaySignatureRef.current = JSON.stringify(hiddenOverlay);
        overlayRpc?.send.updateCompletionOverlay(hiddenOverlay);
      }

      viewRef.current?.destroy();
      viewRef.current = null;
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    if (activeDocumentIdRef.current === documentId) {
      return;
    }

    activeDocumentIdRef.current = documentId;

    const currentValue = view.state.doc.toString();

    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
    });
  }, [documentId, value]);

  useEffect(() => {
    const nextWidthCh = getResultsColumnWidthCh(lines);

    setResultsColumnWidthCh((currentWidthCh) => {
      if (resultsColumnWidthDocumentIdRef.current !== documentId) {
        resultsColumnWidthDocumentIdRef.current = documentId;
        return nextWidthCh;
      }

      return Math.max(currentWidthCh, nextWidthCh);
    });
  }, [documentId, lines]);

  useEffect(() => {
    const nextAccessoryWidthRem = getResultsColumnAccessoryWidthRem(lines);

    setResultsColumnAccessoryWidthRem((currentWidthRem) => {
      if (resultsColumnAccessoryDocumentIdRef.current !== documentId) {
        resultsColumnAccessoryDocumentIdRef.current = documentId;
        return nextAccessoryWidthRem;
      }

      return Math.max(currentWidthRem, nextAccessoryWidthRem);
    });
  }, [documentId, lines]);

  useEffect(() => {
    const viewport = horizontalScrollViewportRef.current;

    if (!viewport) {
      return;
    }

    const syncOverflowShadow = () => {
      if (horizontalOverflowSyncFrameRef.current !== null) {
        cancelEditorFrame(horizontalOverflowSyncFrameRef.current);
      }

      horizontalOverflowSyncFrameRef.current = requestEditorFrame(() => {
        horizontalOverflowSyncFrameRef.current = null;
        const nextViewport = horizontalScrollViewportRef.current;

        if (!nextViewport) {
          return;
        }

        const shouldShowShadow =
          shouldShowHorizontalOverflowShadow(nextViewport);
        setShowHorizontalOverflowShadow((current) =>
          current === shouldShowShadow ? current : shouldShowShadow
        );
      });
    };

    syncOverflowShadow();
    viewport.addEventListener("scroll", syncOverflowShadow, {
      passive: true,
    });
    window.addEventListener("resize", syncOverflowShadow);

    return () => {
      viewport.removeEventListener("scroll", syncOverflowShadow);
      window.removeEventListener("resize", syncOverflowShadow);

      if (horizontalOverflowSyncFrameRef.current !== null) {
        cancelEditorFrame(horizontalOverflowSyncFrameRef.current);
        horizontalOverflowSyncFrameRef.current = null;
      }
    };
  }, [documentId, lines, value]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    const frame = requestEditorFrame(() => {
      const { height, slots } = measureResultLineSlots(view, lines.length);

      setResultLineSlots((currentSlots) =>
        resultLineSlotsEqual(currentSlots, slots) ? currentSlots : slots
      );
      setResultColumnHeight((currentHeight) =>
        Math.abs(currentHeight - height) <= 0.5 ? currentHeight : height
      );
    });

    return () => {
      cancelEditorFrame(frame);
    };
  }, [lines.length]);

  return (
    <div
      className="relative h-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      data-testid="sheet-scroll"
      ref={sheetScrollRef}
    >
      <div
        className="grid min-h-full overflow-visible"
        data-testid="sheet-layout"
        style={{
          gridTemplateColumns: `minmax(0, 1fr) ${resultsColumnWidth}`,
        }}
      >
        <ScrollArea
          className="relative z-0 min-h-full overflow-hidden"
          data-testid="sheet-horizontal-scroll"
          horizontalScrollbarClassName="h-2.5 px-[10px] pb-1 pl-7 pr-4 max-[960px]:pl-4"
          showHorizontalScrollbar
          showVerticalScrollbar={false}
          type="scroll"
          viewportClassName="h-full min-h-full"
          viewportRef={horizontalScrollViewportRef}
        >
          <div
            className="relative z-10 min-h-full min-w-full w-max overflow-visible px-[10px] pl-7 max-[960px]:pl-4"
            ref={rootRef}
          />
        </ScrollArea>
        <div
          aria-label="Calculated results"
          className={`linea-results-surface relative z-10 min-h-full overflow-visible pl-6 pr-6 text-right font-mono text-[18px] transition-shadow duration-150 max-[960px]:pl-4 max-[960px]:pr-4 ${
            showHorizontalOverflowShadow
              ? "shadow-[-18px_0_24px_-18px_rgba(15,23,42,0.48)]"
              : "shadow-none"
          }`}
          data-horizontal-overflow={
            showHorizontalOverflowShadow ? "true" : "false"
          }
          data-testid="sheet-results"
          style={{
            boxSizing: "border-box",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--editor-font-size, 18px)",
            width: "100%",
          }}
        >
          <TooltipProvider delayDuration={0}>
            <div
              className="relative min-h-full"
              style={{
                minHeight: `${Math.max(
                  getFallbackResultColumnHeight(lines.length),
                  resultColumnHeight
                )}px`,
              }}
            >
              {lines.map((line, index) => {
                const slot =
                  resultLineSlots[index] ?? createFallbackResultLineSlot(index);
                const directiveStatus = getDirectiveStatus(line);
                const displayValue = line.displayValue;
                const isTruncatedDisplay =
                  typeof displayValue === "string" &&
                  isResultDisplayTruncated(displayValue);
                const renderedDisplayValue =
                  typeof displayValue === "string" && isTruncatedDisplay
                    ? truncateResultDisplay(displayValue)
                    : displayValue;

                if (directiveStatus) {
                  return (
                    <div
                      className={resultClassName(line)}
                      key={`${line.raw}-${index}`}
                      style={{
                        height: `${slot.height}px`,
                        position: "absolute",
                        right: "0",
                        top: `${slot.top}px`,
                        width: "100%",
                      }}
                    >
                      {renderDirectiveStatus(directiveStatus)}
                    </div>
                  );
                }

                if (!isCopyableResult(line)) {
                  return (
                    <div
                      className={resultClassName(line)}
                      key={`${line.raw}-${index}`}
                      style={{
                        height: `${slot.height}px`,
                        position: "absolute",
                        right: "0",
                        top: `${slot.top}px`,
                        width: "100%",
                      }}
                    >
                      {renderResultValueSlot(
                        renderResultValue(
                          displayValue,
                          isTruncatedDisplay,
                          renderResultLabel(renderedDisplayValue)
                        )
                      )}
                    </div>
                  );
                }

                const resultButton = (
                  <button
                    aria-label={`Copy result ${displayValue}`}
                    className="linea-result-button inline-block max-w-full min-w-0 cursor-pointer overflow-hidden border-0 bg-transparent p-0 font-mono text-right whitespace-nowrap align-top"
                    onClick={() => {
                      if (typeof displayValue === "string") {
                        void handleCopyResult(displayValue);
                      }
                    }}
                    type="button"
                  >
                    {renderedDisplayValue}
                  </button>
                );

                return (
                  <div
                    className={resultClassName(line)}
                    key={`${line.raw}-${index}`}
                    style={{
                      height: `${slot.height}px`,
                      position: "absolute",
                      right: "0",
                      top: `${slot.top}px`,
                      width: "100%",
                    }}
                  >
                    <div className="ml-auto inline-flex max-w-full min-w-0 items-center justify-end gap-2">
                      {renderRoundedDetail(line, handleCopyResult)}
                      {renderResultValueSlot(
                        renderResultValue(
                          displayValue,
                          isTruncatedDisplay,
                          resultButton
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        </div>
      </div>

      <AnimatePresence>
        {toastMessage ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            aria-live="polite"
            className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4"
            exit={{ opacity: 0, y: 8 }}
            initial={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <motion.output className="rounded-full border border-border bg-popover/95 px-4 py-2 text-[13px] font-medium text-popover-foreground shadow-[0_12px_36px_rgba(0,0,0,0.28)] backdrop-blur-sm">
              {toastMessage}
            </motion.output>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  async function handleCopyResult(displayValue: string) {
    const didCopy = await copyTextToClipboard(displayValue);

    if (!didCopy) {
      return;
    }

    setToastMessage(`Copied ${displayValue}`);

    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 1800);
  }
}

function resolveTooltipParent(rootElement: HTMLElement) {
  const themedRoot = rootElement.closest("[data-theme]");
  const defaultView = rootElement.ownerDocument.defaultView;

  if (defaultView && themedRoot instanceof defaultView.HTMLElement) {
    return themedRoot;
  }

  return rootElement.ownerDocument.body;
}

function positionCompletionInfo(
  view: EditorView,
  list: Rect,
  _option: Rect,
  info: Rect,
  space: Rect
) {
  const layout = calculateCompletionInfoLayout({
    info,
    list,
    option: _option,
    rtl: view.textDirection === Direction.RTL,
    space,
  });

  return {
    class: `linea-completion-info-panel ${layout.className}`,
    style: layout.style,
  };
}

function positionHiddenCompletionInfo() {
  return {
    class:
      "linea-completion-info-panel linea-completion-ui-hidden cm-completionInfo-right",
    style: "top: -10000px; left: -10000px; max-width: 0px; max-height: 0px;",
  };
}

function buildCompletionOverlayUpdate(
  view: EditorView,
  rootElement: HTMLElement
): CompletionOverlayUpdate {
  const theme = readCompletionOverlayTheme(rootElement);
  const hiddenOverlay = createHiddenCompletionOverlayUpdate(theme);

  if (!view.hasFocus) {
    return hiddenOverlay;
  }

  const status = completionStatus(view.state);
  const completions = currentCompletions(view.state);

  if (status !== "active" || completions.length === 0) {
    return hiddenOverlay;
  }

  const caretRect = view.coordsAtPos(view.state.selection.main.head);

  if (!caretRect) {
    return hiddenOverlay;
  }

  const overlayCaretRect = {
    left: caretRect.left,
    right: caretRect.right,
    top: caretRect.top,
    bottom: caretRect.bottom,
    width: caretRect.right - caretRect.left,
    height: caretRect.bottom - caretRect.top,
  };

  const items = completions.map((completion) => ({
    label: completion.label,
    detail: completion.detail ?? undefined,
    type: completion.type,
  }));
  const info = getCompletionOverlayInfo(
    selectedCompletion(view.state) as LineaCompletion | null
  );
  const layout = calculateCompletionOverlayLayout({
    caretRect: overlayCaretRect,
    info,
    items,
    optionCount: items.length,
    window: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  });

  return {
    visible: true,
    theme,
    items,
    selectedIndex: selectedCompletionIndex(view.state) ?? 0,
    info,
    placement: layout.placement,
    infoSide: layout.infoSide,
    infoWidth: layout.infoWidth,
    listWidth: layout.listWidth,
    frame: layout.frame,
  };
}

function readCompletionOverlayTheme(rootElement: HTMLElement) {
  const themedRoot = rootElement.closest("[data-theme]");

  if (themedRoot?.getAttribute("data-theme") === "light") {
    return "light";
  }

  return "dark";
}

function requestEditorFrame(callback: () => void) {
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(() => {
      callback();
    });
  }

  return window.setTimeout(callback, 0);
}

function cancelEditorFrame(frame: number) {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(frame);
    return;
  }

  window.clearTimeout(frame);
}

function resultClassName(line: EvaluatedLine) {
  const baseClassName =
    "flex h-full min-w-0 items-center justify-end tabular-nums";

  const directiveStatus = getDirectiveStatus(line);

  if (directiveStatus === "resolved") {
    return `${baseClassName} text-emerald-400`;
  }

  if (directiveStatus === "unresolved") {
    return `${baseClassName} text-amber-400 text-[15px]`;
  }

  if (
    line.kind === "blank" ||
    line.kind === "comment" ||
    line.kind === "heading"
  ) {
    return `${baseClassName} text-transparent`;
  }

  if (line.kind === "error") {
    return `${baseClassName} text-destructive text-[15px]`;
  }

  const tone = inferResultTone(line.displayValue);

  if (tone === "positive") {
    return `${baseClassName} text-emerald-400`;
  }

  if (tone === "negative") {
    return `${baseClassName} text-rose-400`;
  }

  return `${baseClassName} text-foreground`;
}

function shouldShowHorizontalOverflowShadow(viewport: HTMLElement) {
  const maxScrollLeft = Math.max(
    0,
    viewport.scrollWidth - viewport.clientWidth
  );

  return maxScrollLeft > 1 && viewport.scrollLeft < maxScrollLeft - 1;
}

function getResultsColumnWidthCh(lines: EvaluatedLine[]) {
  void lines;

  // Keep the results lane fixed so truncation doesn't shift based on sibling rows.
  return FIXED_RESULT_VALUE_WIDTH_CH;
}

function formatResultsColumnWidth(widthCh: number, accessoryWidthRem = 0) {
  return `calc(${widthCh}ch + ${
    FIXED_RESULTS_COLUMN_PADDING_REM + accessoryWidthRem
  }rem)`;
}

const fixedResultValueSlotStyle = {
  maxWidth: `${FIXED_RESULT_VALUE_WIDTH_CH}ch`,
  minWidth: `${FIXED_RESULT_VALUE_WIDTH_CH}ch`,
  width: `${FIXED_RESULT_VALUE_WIDTH_CH}ch`,
} satisfies React.CSSProperties;

function getResultsColumnAccessoryWidthRem(lines: SheetEditorLine[]) {
  return lines.some(hasRoundedDetail)
    ? FIXED_RESULTS_ROUNDED_DETAIL_ALLOWANCE_REM
    : 0;
}

function hasRoundedDetail(line: SheetEditorLine) {
  return Boolean(line.displayValue && line.displayValueMeta);
}

export function isResultDisplayTruncated(displayValue: string) {
  return Array.from(displayValue).length > MAX_RESULT_DISPLAY_CHARACTERS;
}

export function truncateResultDisplay(displayValue: string) {
  if (!isResultDisplayTruncated(displayValue)) {
    return displayValue;
  }

  return `${Array.from(displayValue)
    .slice(0, MAX_RESULT_DISPLAY_CHARACTERS)
    .join("")}${RESULT_TRUNCATION_ELLIPSIS}`;
}

function renderResultLabel(displayValue: string | null) {
  return (
    <span className="inline-block max-w-full min-w-0 overflow-hidden text-right whitespace-nowrap align-top">
      {displayValue}
    </span>
  );
}

function renderResultValueSlot(child: React.ReactElement) {
  return (
    <span
      className="inline-flex min-w-0 shrink-0 justify-end text-right"
      style={fixedResultValueSlotStyle}
    >
      {child}
    </span>
  );
}

function renderResultValue(
  displayValue: string | null,
  truncated: boolean,
  child: React.ReactElement
) {
  if (!truncated || !displayValue) {
    return child;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{child}</TooltipTrigger>
      <TooltipContent
        align="end"
        className="font-mono text-right break-words"
        side="left"
      >
        {displayValue}
      </TooltipContent>
    </Tooltip>
  );
}

export function buildResultLineSlots(
  blocks: ReadonlyArray<Pick<ResultLineSlot, "height" | "top">>,
  lineCount: number,
  totalHeight: number,
  fallbackHeight = EDITOR_LINE_HEIGHT
) {
  const slots: ResultLineSlot[] = [];

  for (let index = 0; index < lineCount; index += 1) {
    const block = blocks[index];
    const nextBlock = blocks[index + 1];

    if (!block) {
      slots.push(createFallbackResultLineSlot(index, fallbackHeight));
      continue;
    }

    const top = block.top;
    const height = nextBlock
      ? Math.max(fallbackHeight, nextBlock.top - top)
      : Math.max(fallbackHeight, block.height);

    slots.push({ height, top });
  }

  return slots;
}

function measureResultLineSlots(view: EditorView, lineCount: number) {
  const measuredLineCount = Math.min(lineCount, view.state.doc.lines);
  const blocks = Array.from({ length: measuredLineCount }, (_, index) => {
    const line = view.state.doc.line(index + 1);
    const block = view.lineBlockAt(line.from);

    return {
      height: block.height,
      top: view.documentPadding.top + block.top,
    };
  });
  const totalHeight =
    view.documentPadding.top + view.contentHeight + view.documentPadding.bottom;

  return {
    height: Math.max(getFallbackResultColumnHeight(lineCount), totalHeight),
    slots: buildResultLineSlots(blocks, lineCount, totalHeight),
  };
}

function createFallbackResultLineSlots(
  lineCount: number,
  fallbackHeight = EDITOR_LINE_HEIGHT
) {
  return Array.from({ length: lineCount }, (_, index) =>
    createFallbackResultLineSlot(index, fallbackHeight)
  );
}

function createFallbackResultLineSlot(
  index: number,
  fallbackHeight = EDITOR_LINE_HEIGHT
): ResultLineSlot {
  return {
    height: fallbackHeight,
    top: fallbackHeight * index,
  };
}

function getFallbackResultColumnHeight(
  lineCount: number,
  fallbackHeight = EDITOR_LINE_HEIGHT
) {
  return Math.max(fallbackHeight, lineCount * fallbackHeight);
}

function resultLineSlotsEqual(
  left: ReadonlyArray<ResultLineSlot>,
  right: ReadonlyArray<ResultLineSlot>
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((slot, index) => {
    const nextSlot = right[index];

    return (
      nextSlot !== undefined &&
      Math.abs(slot.height - nextSlot.height) <= 0.5 &&
      Math.abs(slot.top - nextSlot.top) <= 0.5
    );
  });
}

function isCopyableResult(line: EvaluatedLine): line is EvaluatedLine & {
  displayValue: string;
} {
  return (
    !getDirectiveStatus(line) &&
    typeof line.displayValue === "string" &&
    line.displayValue.length > 0
  );
}

function getDirectiveStatus(line: EvaluatedLine) {
  if (!/^(?:Import|Export)\s+/i.test(line.raw.trim())) {
    return null;
  }

  return line.kind === "error" ? "unresolved" : "resolved";
}

function inferResultTone(displayValue: string | null) {
  if (!displayValue) {
    return "neutral";
  }

  const match = displayValue.match(/[+-]?\d+(?:[.,]\d+)?/);

  if (!match) {
    return "neutral";
  }

  const numericValue = Number(match[0].replace(",", "."));

  if (!Number.isFinite(numericValue) || numericValue === 0) {
    return "neutral";
  }

  return numericValue > 0 ? "positive" : "negative";
}

function renderRoundedDetail(
  line: SheetEditorLine,
  onCopy: (displayValue: string) => Promise<void>
) {
  const displayValueMeta = line.displayValueMeta;

  if (!line.displayValue || !displayValueMeta) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={`Show full precision for ${line.displayValue}`}
          className="linea-result-button inline-flex cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-muted-foreground hover:text-foreground active:text-foreground data-[state=open]:text-foreground focus-visible:outline-none"
          type="button"
        >
          <Badge
            className="border-current px-1.5 py-0 font-mono text-[0.625rem] leading-none text-current transition-colors"
            variant="outline"
          >
            ≈
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-fit max-w-[calc(100vw-2rem)] p-3 font-mono"
        forceMount
      >
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm text-foreground">
            {displayValueMeta.fullPrecisionValue}
          </p>
          <Button
            aria-label={`Copy full precision value ${displayValueMeta.fullPrecisionValue}`}
            className="ml-1 font-mono"
            onClick={() => {
              void onCopy(displayValueMeta.fullPrecisionValue);
            }}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <Copy className="size-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function renderDirectiveStatus(status: "resolved" | "unresolved") {
  if (status === "resolved") {
    return (
      <span
        aria-label="Directive resolved"
        className="inline-flex items-center justify-end"
        role="img"
      >
        <Check className="size-4" />
      </span>
    );
  }

  return (
    <span
      aria-label="Directive unresolved"
      className="inline-flex items-center justify-end"
      role="img"
    >
      <CircleHelp className="size-4" />
    </span>
  );
}

function handleClipboardCopy(
  view: EditorView,
  event: ClipboardEvent,
  lines: SheetEditorLine[]
) {
  return writeEditorClipboard(view, event, lines, false);
}

function handleClipboardCut(
  view: EditorView,
  event: ClipboardEvent,
  lines: SheetEditorLine[]
) {
  return writeEditorClipboard(view, event, lines, true);
}

function writeEditorClipboard(
  view: EditorView,
  event: ClipboardEvent,
  lines: SheetEditorLine[],
  removeSelection: boolean
) {
  const clipboardData = event.clipboardData;

  if (!clipboardData) {
    return false;
  }

  const copiedContent = getCopiedContent(view.state);

  if (!copiedContent.text && !copiedContent.linewise) {
    return false;
  }

  clipboardData.clearData();
  clipboardData.setData(
    "text/plain",
    formatCopiedContentWithResults(view.state, lines, copiedContent.ranges)
  );
  clipboardData.setData(
    LINEA_CLIPBOARD_MIME,
    JSON.stringify({
      linewise: copiedContent.linewise,
      text: copiedContent.text,
      version: 1,
    })
  );

  if (removeSelection && !view.state.readOnly) {
    view.dispatch({
      changes: copiedContent.ranges,
      scrollIntoView: true,
      userEvent: "delete.cut",
    });
  }

  return true;
}

function handleClipboardPaste(view: EditorView, event: ClipboardEvent) {
  const clipboardData = event.clipboardData;

  if (!clipboardData) {
    return false;
  }

  const lineaClipboard = readLineaClipboard(
    clipboardData.getData(LINEA_CLIPBOARD_MIME)
  );

  if (lineaClipboard) {
    event.preventDefault();
    applyPastedText(view, lineaClipboard.text, lineaClipboard.linewise);
    return true;
  }

  const plainText = clipboardData.getData("text/plain");
  const strippedText = stripLineaClipboardResults(plainText);

  if (strippedText === plainText) {
    return false;
  }

  event.preventDefault();
  applyPastedText(view, strippedText, false);
  return true;
}

function getCopiedContent(state: EditorState) {
  const content: string[] = [];
  const ranges: Array<{ from: number; to: number }> = [];
  let linewise = false;

  for (const range of state.selection.ranges) {
    if (range.empty) {
      continue;
    }

    content.push(state.sliceDoc(range.from, range.to));
    ranges.push({ from: range.from, to: range.to });
  }

  if (content.length > 0) {
    return {
      linewise,
      ranges,
      text: content.join(state.lineBreak),
    };
  }

  let lastLineNumber = -1;

  for (const { from } of state.selection.ranges) {
    const line = state.doc.lineAt(from);

    if (line.number === lastLineNumber) {
      continue;
    }

    content.push(line.text);
    ranges.push({
      from: line.from,
      to: Math.min(state.doc.length, line.to + 1),
    });
    lastLineNumber = line.number;
  }

  linewise = true;

  return {
    linewise,
    ranges,
    text: content.join(state.lineBreak),
  };
}

function formatCopiedContentWithResults(
  state: EditorState,
  lines: SheetEditorLine[],
  ranges: Array<{ from: number; to: number }>
) {
  return ranges
    .map((range) => formatCopiedRangeWithResults(state, lines, range))
    .join(state.lineBreak);
}

function formatCopiedRangeWithResults(
  state: EditorState,
  lines: SheetEditorLine[],
  range: { from: number; to: number }
) {
  if (range.from === range.to) {
    return "";
  }

  const endPosition = Math.max(range.from, range.to - 1);
  const startLineNumber = state.doc.lineAt(range.from).number;
  const endLineNumber = state.doc.lineAt(endPosition).number;
  const copiedLines: string[] = [];

  for (
    let lineNumber = startLineNumber;
    lineNumber <= endLineNumber;
    lineNumber += 1
  ) {
    const line = state.doc.line(lineNumber);
    const selectionFrom =
      lineNumber === startLineNumber ? range.from : line.from;
    const selectionTo =
      lineNumber === endLineNumber ? Math.min(range.to, line.to) : line.to;
    const selectedText = state.sliceDoc(selectionFrom, selectionTo);
    const isWholeLineSelection =
      selectionFrom === line.from && selectionTo === line.to;

    copiedLines.push(
      isWholeLineSelection
        ? formatCopiedLineWithResult(selectedText, lines[lineNumber - 1])
        : selectedText
    );
  }

  return copiedLines.join(state.lineBreak);
}

function formatCopiedLineWithResult(
  text: string,
  line: SheetEditorLine | undefined
) {
  if (!line || line.raw !== text || !isCopyableResult(line)) {
    return text;
  }

  return `${text} = ${line.displayValue}`;
}

function readLineaClipboard(rawValue: string) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.text !== "string" ||
      typeof parsed.linewise !== "boolean" ||
      parsed.version !== 1
    ) {
      return null;
    }

    return parsed as {
      linewise: boolean;
      text: string;
      version: 1;
    };
  } catch {
    return null;
  }
}

function dispatchOpenSheetSearch() {
  window.dispatchEvent(new CustomEvent(OPEN_SHEET_SEARCH_EVENT));
}

function isToggleLineCommentShortcut(event: KeyboardEvent) {
  if ((!event.metaKey && !event.ctrlKey) || event.altKey) {
    return false;
  }

  if (event.key === "/" || event.code === "NumpadDivide") {
    return true;
  }

  return event.code === "Digit7" && event.shiftKey;
}

function handleToggleLineComment(view: EditorView) {
  const lineNumbers = getSelectedLineNumbers(view.state);

  if (lineNumbers.length === 0) {
    return false;
  }

  const shouldUncomment = lineNumbers.every((lineNumber) => {
    const line = view.state.doc.line(lineNumber);
    return line.text.trim().length === 0 || isLineCommented(line.text);
  });

  const changes = lineNumbers
    .map((lineNumber) =>
      getLineCommentChange(view.state.doc.line(lineNumber), shouldUncomment)
    )
    .filter(
      (
        change
      ): change is {
        from: number;
        insert: string;
        to?: number;
      } => change !== null
    );

  if (changes.length === 0) {
    return false;
  }

  view.dispatch({
    changes,
    scrollIntoView: true,
    userEvent: "input.type",
  });

  return true;
}

function getSelectedLineNumbers(state: EditorState) {
  const lineNumbers: number[] = [];
  let lastLineNumber = -1;

  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from).number;
    const endPosition = Math.max(range.from, range.to - 1);
    const endLine = state.doc.lineAt(endPosition).number;

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      if (lineNumber === lastLineNumber) {
        continue;
      }

      lineNumbers.push(lineNumber);
      lastLineNumber = lineNumber;
    }
  }

  return lineNumbers;
}

function isLineCommented(text: string) {
  return /^\s*\/\//.test(text);
}

function getLineCommentChange(
  line: { from: number; text: string },
  uncomment: boolean
) {
  const indentMatch = line.text.match(/^\s*/);
  const indent = indentMatch?.[0] ?? "";

  if (uncomment) {
    const commentMatch = line.text.match(/^(\s*)\/\/ ?/);

    if (!commentMatch) {
      return null;
    }

    const commentPrefix = commentMatch[0];
    return {
      from: line.from + indent.length,
      to: line.from + commentPrefix.length,
      insert: "",
    };
  }

  return {
    from: line.from + indent.length,
    insert: "// ",
  };
}

function stripLineaClipboardResults(text: string) {
  if (!text.includes(" = ")) {
    return text;
  }

  let changed = false;
  const strippedText = text
    .split(/\r?\n/)
    .map((line) => {
      const strippedLine = stripLineaClipboardResultFromLine(line);

      if (strippedLine !== line) {
        changed = true;
      }

      return strippedLine;
    })
    .join("\n");

  return changed ? strippedText : text;
}

function stripLineaClipboardResultFromLine(line: string) {
  const separator = " = ";
  const separatorIndex = line.lastIndexOf(separator);

  if (separatorIndex <= 0) {
    return line;
  }

  const prefix = line.slice(0, separatorIndex);
  const suffix = line.slice(separatorIndex + separator.length);

  if (!prefix.trim() || !suffix.trim()) {
    return line;
  }

  if (!looksLikeLineaExport(prefix, suffix, line)) {
    return line;
  }

  return prefix;
}

function looksLikeLineaExport(prefix: string, suffix: string, line: string) {
  if (line.split(" = ").length > 2) {
    return true;
  }

  if (prefix.trim().startsWith("//") || prefix.trim().startsWith("#")) {
    return false;
  }

  if (suffix.includes(" = ")) {
    return false;
  }

  return /[:+\-*/%^()[\]\d]/.test(prefix);
}

function applyPastedText(view: EditorView, input: string, linewise: boolean) {
  const state = view.state;
  const text = state.toText(input);
  const byLine = text.lines === state.selection.ranges.length;
  let lineIndex = 1;

  if (linewise) {
    let lastLineFrom = -1;

    const changes = state.changeByRange((range) => {
      const line = state.doc.lineAt(range.from);

      if (line.from === lastLineFrom) {
        return { range };
      }

      lastLineFrom = line.from;
      const insertedLine = byLine ? text.line(lineIndex++).text : input;
      const { from, insertedText } = getLinewisePasteChange(
        state,
        line,
        insertedLine
      );

      return {
        changes: {
          from,
          insert: insertedText,
        },
        range: EditorSelection.cursor(from + insertedText.length),
      };
    });

    view.dispatch(changes, {
      scrollIntoView: true,
      userEvent: "input.paste",
    });
    return;
  }

  if (byLine) {
    const changes = state.changeByRange((range) => {
      const line = text.line(lineIndex++);

      return {
        changes: {
          from: range.from,
          insert: line.text,
          to: range.to,
        },
        range: EditorSelection.cursor(range.from + line.length),
      };
    });

    view.dispatch(changes, {
      scrollIntoView: true,
      userEvent: "input.paste",
    });
    return;
  }

  view.dispatch(state.replaceSelection(text), {
    scrollIntoView: true,
    userEvent: "input.paste",
  });
}

function getLinewisePasteChange(
  state: EditorState,
  line: { from: number; length: number; number: number },
  insertedLine: string
) {
  if (line.length > 0) {
    return {
      from: line.from,
      insertedText: state.toText(`${insertedLine}${state.lineBreak}`),
    };
  }

  if (line.number < state.doc.lines) {
    // Keep separator lines above the pasted content so block-based formulas detach.
    return {
      from: state.doc.line(line.number + 1).from,
      insertedText: state.toText(`${insertedLine}${state.lineBreak}`),
    };
  }

  return {
    from: line.from,
    insertedText: state.toText(
      `${state.doc.length > 0 ? state.lineBreak : ""}${insertedLine}${state.lineBreak}`
    ),
  };
}

async function copyTextToClipboard(value: string) {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.inset = "0";
  document.body.append(textarea);
  textarea.select();

  const didCopy =
    typeof document.execCommand === "function" && document.execCommand("copy");

  textarea.remove();
  return didCopy;
}
