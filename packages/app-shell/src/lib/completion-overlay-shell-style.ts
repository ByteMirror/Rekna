import type { CSSProperties } from "react";

import type { CompletionOverlayRenderState } from "@linea/shared";

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
