import type { Completion } from "@codemirror/autocomplete";

import type {
  CompletionOverlayFrame,
  CompletionOverlayInfo,
  CompletionOverlayInfoSide,
  CompletionOverlayItem,
  CompletionOverlayPlacement,
  CompletionOverlayUpdate,
} from "@linea/shared";

const COMPLETION_OVERLAY_EDGE_MARGIN = 12;
const COMPLETION_OVERLAY_GAP = 10;
const COMPLETION_OVERLAY_INFO_BASE_HEIGHT = 92;
const COMPLETION_OVERLAY_INFO_BOTTOM_THRESHOLD = 180;
const COMPLETION_OVERLAY_INFO_BODY_CHARS_PER_LINE = 34;
const COMPLETION_OVERLAY_INFO_DETAIL_CHARS_PER_LINE = 28;
const COMPLETION_OVERLAY_INFO_LINE_HEIGHT = 18;
const COMPLETION_OVERLAY_INFO_MAX_HEIGHT = 260;
const COMPLETION_OVERLAY_INFO_MIN_HEIGHT = 164;
const COMPLETION_OVERLAY_INFO_MAX_WIDTH = 280;
const COMPLETION_OVERLAY_INFO_MIN_VISIBLE_WIDTH = 80;
const COMPLETION_OVERLAY_LIST_MAX_WIDTH = 380;
const COMPLETION_OVERLAY_LIST_MIN_WIDTH = 250;
export const COMPLETION_OVERLAY_LIST_MAX_HEIGHT = 320;
const COMPLETION_OVERLAY_MIN_HEIGHT = 64;
const COMPLETION_OVERLAY_ROW_HEIGHT = 38;
export const COMPLETION_OVERLAY_SHADOW_PADDING = 40;
const COMPLETION_OVERLAY_VERTICAL_PADDING = 12;
const COMPLETION_OVERLAY_WINDOW_GAP = 8;

export type LineaCompletionInfo = {
  title: string;
  body: string;
};

export type LineaCompletion = Completion & {
  lineaInfo?: LineaCompletionInfo;
};

export type CompletionOverlayLayout = {
  frame: CompletionOverlayFrame;
  infoSide: CompletionOverlayInfoSide;
  infoWidth: number | null;
  listWidth: number;
  placement: CompletionOverlayPlacement;
};

type OverlayRect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type OverlayWindowMetrics = {
  width: number;
  height: number;
};

export function calculateCompletionOverlayFrame({
  caretRect,
  info,
  items = [],
  optionCount,
  window,
}: {
  caretRect: OverlayRect;
  info: CompletionOverlayInfo | null;
  items?: CompletionOverlayItem[];
  optionCount: number;
  window: OverlayWindowMetrics;
}): CompletionOverlayFrame {
  return calculateCompletionOverlayLayout({
    caretRect,
    info,
    items,
    optionCount,
    window,
  }).frame;
}

export function calculateCompletionOverlayLayout({
  caretRect,
  info,
  items = [],
  optionCount,
  window,
}: {
  caretRect: OverlayRect;
  info: CompletionOverlayInfo | null;
  items?: CompletionOverlayItem[];
  optionCount: number;
  window: OverlayWindowMetrics;
}): CompletionOverlayLayout {
  const listWidth = getCompletionOverlayListWidth(items);
  const listHeight = getCompletionOverlayListHeight(optionCount);
  const { infoSide, infoWidth } = resolveCompletionOverlayInfoLayout({
    caretRect,
    hasInfo: info !== null,
    listWidth,
    window,
  });
  const infoHeight = estimateCompletionOverlayInfoHeight(info, infoWidth);
  const contentWidth =
    infoWidth === null
      ? listWidth
      : infoSide === "bottom"
        ? Math.max(listWidth, infoWidth)
        : listWidth + infoWidth + COMPLETION_OVERLAY_GAP;
  const contentHeight =
    infoWidth === null
      ? listHeight
      : infoSide === "bottom"
        ? listHeight + COMPLETION_OVERLAY_GAP + infoHeight
        : Math.max(listHeight, infoHeight);
  const viewportTop = COMPLETION_OVERLAY_EDGE_MARGIN;
  const viewportBottom = Math.max(
    COMPLETION_OVERLAY_EDGE_MARGIN,
    window.height - COMPLETION_OVERLAY_EDGE_MARGIN
  );
  const contentTopBelow = caretRect.bottom + COMPLETION_OVERLAY_WINDOW_GAP;
  const contentTopAbove =
    caretRect.top - contentHeight - COMPLETION_OVERLAY_WINDOW_GAP;
  const widthWithShadow = contentWidth + COMPLETION_OVERLAY_SHADOW_PADDING * 2;
  const heightWithShadow =
    contentHeight + COMPLETION_OVERLAY_SHADOW_PADDING * 2;
  const frameTopBelow = contentTopBelow - COMPLETION_OVERLAY_SHADOW_PADDING;
  const frameTopAbove = contentTopAbove - COMPLETION_OVERLAY_SHADOW_PADDING;
  const availableBelow = viewportBottom - frameTopBelow;
  const availableAbove =
    caretRect.top -
    COMPLETION_OVERLAY_WINDOW_GAP -
    viewportTop +
    COMPLETION_OVERLAY_SHADOW_PADDING;
  let contentLeft =
    infoWidth !== null && infoSide === "left"
      ? caretRect.left - 18 - infoWidth - COMPLETION_OVERLAY_GAP
      : caretRect.left - 18;
  const maxContentLeft =
    window.width - COMPLETION_OVERLAY_EDGE_MARGIN - contentWidth;

  if (contentWidth <= window.width - COMPLETION_OVERLAY_EDGE_MARGIN * 2) {
    contentLeft = clamp(
      contentLeft,
      COMPLETION_OVERLAY_EDGE_MARGIN,
      Math.max(COMPLETION_OVERLAY_EDGE_MARGIN, maxContentLeft)
    );
  }

  const x = contentLeft - COMPLETION_OVERLAY_SHADOW_PADDING;
  const placement: CompletionOverlayPlacement =
    availableBelow >= heightWithShadow || availableBelow >= availableAbove
      ? "below"
      : "above";
  let y = placement === "below" ? frameTopBelow : frameTopAbove;

  if (heightWithShadow <= viewportBottom - viewportTop) {
    y = clamp(
      y,
      viewportTop,
      Math.max(viewportTop, viewportBottom - heightWithShadow)
    );
  }

  return {
    frame: {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(widthWithShadow),
      height: Math.round(heightWithShadow),
    },
    infoSide,
    infoWidth,
    listWidth,
    placement,
  };
}

export function getCompletionOverlayListWidth(items: CompletionOverlayItem[]) {
  const widestItem = items.reduce((maxWidth, item) => {
    const labelWidth = item.label.length * 9.5;
    const detailWidth = (item.detail?.length ?? 0) * 6.5;
    return Math.max(maxWidth, labelWidth + detailWidth + 88);
  }, COMPLETION_OVERLAY_LIST_MIN_WIDTH);

  return Math.max(
    COMPLETION_OVERLAY_LIST_MIN_WIDTH,
    Math.min(COMPLETION_OVERLAY_LIST_MAX_WIDTH, Math.ceil(widestItem))
  );
}

export function getCompletionOverlayInfo(
  completion:
    | (Pick<LineaCompletion, "detail" | "label" | "lineaInfo"> &
        Partial<Pick<LineaCompletion, "type">>)
    | null
): CompletionOverlayInfo | null {
  if (!completion?.lineaInfo) {
    return null;
  }

  return {
    title: completion.lineaInfo.title,
    body: completion.lineaInfo.body,
    detail: completion.detail ?? undefined,
  };
}

export function createHiddenCompletionOverlayUpdate(
  theme: "dark" | "light" = "dark"
): CompletionOverlayUpdate {
  return {
    visible: false,
    theme,
    items: [],
    selectedIndex: 0,
    info: null,
    placement: "below",
    infoSide: "right",
    infoWidth: null,
    listWidth: COMPLETION_OVERLAY_LIST_MIN_WIDTH,
    frame: null,
  };
}

function estimateCompletionOverlayInfoHeight(
  info: CompletionOverlayInfo | null,
  infoWidth: number | null
) {
  if (!info) {
    return 0;
  }

  const resolvedInfoWidth = infoWidth ?? COMPLETION_OVERLAY_INFO_MAX_WIDTH;
  const widthScale = resolvedInfoWidth / COMPLETION_OVERLAY_INFO_MAX_WIDTH;
  const detailCharsPerLine = Math.max(
    12,
    Math.floor(COMPLETION_OVERLAY_INFO_DETAIL_CHARS_PER_LINE * widthScale)
  );
  const bodyCharsPerLine = Math.max(
    14,
    Math.floor(COMPLETION_OVERLAY_INFO_BODY_CHARS_PER_LINE * widthScale)
  );
  const detailLines = info.detail
    ? Math.max(1, Math.ceil(info.detail.length / detailCharsPerLine))
    : 0;
  const bodyLines = Math.max(2, Math.ceil(info.body.length / bodyCharsPerLine));

  return Math.min(
    COMPLETION_OVERLAY_INFO_MAX_HEIGHT,
    Math.max(
      COMPLETION_OVERLAY_INFO_MIN_HEIGHT,
      COMPLETION_OVERLAY_INFO_BASE_HEIGHT +
        detailLines * COMPLETION_OVERLAY_INFO_LINE_HEIGHT +
        bodyLines * COMPLETION_OVERLAY_INFO_LINE_HEIGHT
    )
  );
}

function resolveCompletionOverlayInfoLayout({
  caretRect,
  hasInfo,
  listWidth,
  window,
}: {
  caretRect: OverlayRect;
  hasInfo: boolean;
  listWidth: number;
  window: OverlayWindowMetrics;
}) {
  if (!hasInfo) {
    return {
      infoSide: "right" as const,
      infoWidth: null,
    };
  }

  const listLeft = caretRect.left - 18;
  const listRight = listLeft + listWidth;
  const viewportLeft = COMPLETION_OVERLAY_EDGE_MARGIN;
  const viewportRight = Math.max(
    COMPLETION_OVERLAY_EDGE_MARGIN,
    window.width - COMPLETION_OVERLAY_EDGE_MARGIN
  );
  const spaceLeft = Math.max(
    0,
    listLeft - viewportLeft - COMPLETION_OVERLAY_GAP
  );
  const spaceRight = Math.max(
    0,
    viewportRight - listRight - COMPLETION_OVERLAY_GAP
  );
  const preferLeft =
    spaceRight < Math.min(COMPLETION_OVERLAY_INFO_MAX_WIDTH, spaceLeft);
  const preferredSide = preferLeft ? "left" : "right";
  const alternateSide = preferLeft ? "right" : "left";
  const preferredSpace = preferredSide === "left" ? spaceLeft : spaceRight;
  const alternateSpace = alternateSide === "left" ? spaceLeft : spaceRight;
  const preferredWidth = fitCompletionOverlayInfoWidth(preferredSpace);
  const alternateWidth = fitCompletionOverlayInfoWidth(alternateSpace);

  if (
    Math.max(preferredWidth, alternateWidth) <
    COMPLETION_OVERLAY_INFO_BOTTOM_THRESHOLD
  ) {
    return {
      infoSide: "bottom" as const,
      infoWidth: fitBottomCompletionOverlayInfoWidth(
        listWidth,
        viewportRight - viewportLeft
      ),
    };
  }

  const resolvedSide: CompletionOverlayInfoSide =
    preferredWidth >= alternateWidth ? preferredSide : alternateSide;
  const infoWidth =
    resolvedSide === preferredSide ? preferredWidth : alternateWidth;

  return {
    infoSide: resolvedSide,
    infoWidth,
  };
}

function fitBottomCompletionOverlayInfoWidth(
  listWidth: number,
  viewportWidth: number
) {
  return clamp(
    Math.max(listWidth, COMPLETION_OVERLAY_INFO_MAX_WIDTH),
    Math.min(COMPLETION_OVERLAY_INFO_MIN_VISIBLE_WIDTH, viewportWidth),
    viewportWidth
  );
}

function fitCompletionOverlayInfoWidth(availableWidth: number) {
  const cappedWidth = Math.min(
    COMPLETION_OVERLAY_INFO_MAX_WIDTH,
    Math.max(0, availableWidth)
  );
  const minimumVisibleWidth = Math.min(
    COMPLETION_OVERLAY_INFO_MIN_VISIBLE_WIDTH,
    Math.max(0, availableWidth)
  );

  return Math.max(cappedWidth, minimumVisibleWidth);
}

function getCompletionOverlayListHeight(optionCount: number) {
  return Math.min(
    COMPLETION_OVERLAY_LIST_MAX_HEIGHT,
    Math.max(
      COMPLETION_OVERLAY_MIN_HEIGHT,
      optionCount * COMPLETION_OVERLAY_ROW_HEIGHT +
        COMPLETION_OVERLAY_VERTICAL_PADDING
    )
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
