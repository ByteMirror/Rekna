import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import type { CompletionOverlayRenderState } from "@linea/shared";

import {
  COMPLETION_OVERLAY_LIST_MAX_HEIGHT,
  COMPLETION_OVERLAY_SHADOW_PADDING,
} from "../lib/completion-overlay";
import { getElectrobun } from "../lib/rpc";

const HIDDEN_OVERLAY_STATE: CompletionOverlayRenderState = {
  visible: false,
  theme: "dark",
  items: [],
  selectedIndex: 0,
  info: null,
  placement: "below",
  infoSide: "right",
  infoWidth: null,
  listWidth: 250,
};

export function CompletionOverlayApp() {
  const [overlayState, setOverlayState] =
    useState<CompletionOverlayRenderState>(HIDDEN_OVERLAY_STATE);
  const listRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    document.body.dataset.window = "completion-overlay";

    return () => {
      delete document.body.dataset.window;
    };
  }, []);

  useEffect(() => {
    const electrobun = getElectrobun();

    if (!electrobun?.rpc) {
      return;
    }

    const rpc = electrobun.rpc;

    const handleRender = (nextState: CompletionOverlayRenderState) => {
      setOverlayState(nextState);
    };

    rpc.addMessageListener("renderCompletionOverlay", handleRender);
    rpc.send.completionOverlayReady();

    return () => {
      rpc.removeMessageListener("renderCompletionOverlay", handleRender);
    };
  }, []);

  useEffect(() => {
    if (!overlayState.visible) {
      return;
    }

    const listElement = listRef.current;

    if (!listElement) {
      return;
    }

    const selectedItem = listElement.querySelector<HTMLElement>(
      '[aria-selected="true"]'
    );

    if (typeof selectedItem?.scrollIntoView !== "function") {
      return;
    }

    selectedItem.scrollIntoView({ block: "nearest" });
  }, [overlayState.items, overlayState.selectedIndex, overlayState.visible]);

  const infoPanel =
    overlayState.info !== null ? (
      <aside
        aria-label={`${overlayState.info.title} details`}
        className="linea-completion-overlay-info"
        style={
          overlayState.infoWidth !== null
            ? ({ width: `${overlayState.infoWidth}px` } as CSSProperties)
            : undefined
        }
      >
        <div className="linea-completion-overlay-info__title">
          {overlayState.info.title}
        </div>
        {overlayState.info.detail ? (
          <div className="linea-completion-overlay-info__detail">
            {overlayState.info.detail}
          </div>
        ) : null}
        <p className="linea-completion-overlay-info__body">
          {overlayState.info.body}
        </p>
      </aside>
    ) : null;

  return (
    <div
      className="linea-completion-overlay-root"
      data-theme={overlayState.theme}
      style={
        {
          "--linea-completion-list-max-height": `${COMPLETION_OVERLAY_LIST_MAX_HEIGHT}px`,
          "--linea-completion-shadow-padding": `${COMPLETION_OVERLAY_SHADOW_PADDING}px`,
        } as CSSProperties
      }
    >
      {overlayState.visible ? (
        <div
          className="linea-completion-overlay-shell"
          style={resolveCompletionOverlayShellStyle(overlayState)}
        >
          {overlayState.infoSide === "left" ? infoPanel : null}

          <section
            aria-label="Completions"
            className="linea-completion-overlay-list"
            ref={listRef}
            role="listbox"
          >
            {overlayState.items.map((item, index) => (
              <div
                aria-selected={index === overlayState.selectedIndex}
                className="linea-completion-overlay-item"
                key={`${item.label}-${index}`}
                role="option"
              >
                <span
                  aria-hidden="true"
                  className="linea-completion-overlay-icon"
                >
                  {completionGlyph(item.type)}
                </span>
                <span className="linea-completion-overlay-label">
                  {item.label}
                </span>
                {item.detail ? (
                  <span className="linea-completion-overlay-detail">
                    {item.detail}
                  </span>
                ) : null}
              </div>
            ))}
          </section>

          {overlayState.infoSide !== "left" ? infoPanel : null}
        </div>
      ) : null}
    </div>
  );
}

export function resolveCompletionOverlayShellStyle(
  overlayState: Pick<
    CompletionOverlayRenderState,
    "infoSide" | "listWidth" | "placement"
  >
): CSSProperties {
  const placement = overlayState.placement ?? "below";

  return {
    "--linea-completion-list-width": `${overlayState.listWidth}px`,
    alignItems:
      overlayState.infoSide === "bottom"
        ? "stretch"
        : placement === "above"
          ? "flex-end"
          : "flex-start",
    flexDirection:
      overlayState.infoSide === "bottom"
        ? placement === "above"
          ? "column-reverse"
          : "column"
        : "row",
  } as CSSProperties;
}

function completionGlyph(type?: string) {
  if (type === "tag") {
    return "#";
  }

  if (type === "function") {
    return "f";
  }

  if (type === "variable") {
    return "v";
  }

  return "•";
}
