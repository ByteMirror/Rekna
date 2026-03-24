import type {
  CompletionOverlayFrame,
  CompletionOverlayInfoSide,
  CompletionOverlayRenderState,
  CompletionOverlayUpdate,
} from "@linea/shared";
import type { BrowserWindow, Display } from "electrobun/bun";

const COMPLETION_OVERLAY_GAP = 10;
const COMPLETION_OVERLAY_INFO_BASE_HEIGHT = 92;
const COMPLETION_OVERLAY_INFO_BODY_CHARS_PER_LINE = 34;
const COMPLETION_OVERLAY_INFO_BOTTOM_THRESHOLD = 180;
const COMPLETION_OVERLAY_INFO_DETAIL_CHARS_PER_LINE = 28;
const COMPLETION_OVERLAY_INFO_LINE_HEIGHT = 18;
const HIDDEN_OVERLAY_FRAME: CompletionOverlayFrame = {
  x: -10_000,
  y: -10_000,
  width: 1,
  height: 1,
};
const COMPLETION_OVERLAY_INFO_MAX_WIDTH = 280;
const COMPLETION_OVERLAY_INFO_MAX_HEIGHT = 260;
const COMPLETION_OVERLAY_INFO_MIN_HEIGHT = 164;
const COMPLETION_OVERLAY_INFO_MIN_VISIBLE_WIDTH = 80;
const COMPLETION_OVERLAY_LIST_MAX_HEIGHT = 320;
const COMPLETION_OVERLAY_MIN_HEIGHT = 64;
const COMPLETION_OVERLAY_ROW_HEIGHT = 38;
const COMPLETION_OVERLAY_SHADOW_PADDING = 40;
const COMPLETION_OVERLAY_VERTICAL_PADDING = 12;

const HIDDEN_OVERLAY_RENDER_STATE: CompletionOverlayRenderState = {
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

export class CompletionOverlayController {
  private lastAppliedFrame: CompletionOverlayFrame | null = null;
  private lastUpdate: CompletionOverlayUpdate = {
    ...HIDDEN_OVERLAY_RENDER_STATE,
    frame: null,
  };
  private mainWindowFocused = true;
  private ready = false;

  constructor(
    private readonly mainWindow: BrowserWindow,
    private readonly overlayWindow: BrowserWindow,
    private readonly resolveDisplayForFrame: (
      frame: BrowserWindow["frame"]
    ) => Display | null = () => null
  ) {}

  handleReady() {
    this.ready = true;
    this.pushRenderState();
    this.syncOverlayWindow();
  }

  handleUpdate(update: CompletionOverlayUpdate) {
    this.lastUpdate = update;

    this.pushRenderState();
    this.syncOverlayWindow();
  }

  handleMainBlur() {
    this.mainWindowFocused = false;
    this.syncOverlayWindow();
  }

  handleMainFocus() {
    this.mainWindowFocused = true;
    this.syncOverlayWindow();
  }

  handleMainMove({ x, y }: { x: number; y: number }) {
    this.mainWindow.frame.x = x;
    this.mainWindow.frame.y = y;
    this.syncOverlayWindow();
  }

  handleMainResize(frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    this.mainWindow.frame = frame;
    this.syncOverlayWindow();
  }

  close() {
    this.overlayWindow.close();
  }

  private pushRenderState() {
    if (!this.ready) {
      return;
    }

    const presentation = this.resolveVisiblePresentation();
    const renderState: CompletionOverlayRenderState =
      presentation?.renderState ?? {
        ...HIDDEN_OVERLAY_RENDER_STATE,
        theme: this.lastUpdate.theme,
      };
    const overlayRpc = this.overlayWindow.webview.rpc as
      | {
          send?: {
            renderCompletionOverlay?: (
              payload: CompletionOverlayRenderState
            ) => void;
          };
        }
      | undefined;

    overlayRpc?.send?.renderCompletionOverlay?.(renderState);
  }

  private syncOverlayWindow() {
    const nextFrame = this.resolveVisiblePresentation()?.frame ?? null;

    if (!nextFrame) {
      this.applyOverlayFrame(HIDDEN_OVERLAY_FRAME);
      return;
    }

    this.applyOverlayFrame(nextFrame);
  }

  private resolveVisiblePresentation() {
    if (
      !this.mainWindowFocused ||
      !this.lastUpdate.visible ||
      !this.lastUpdate.frame
    ) {
      return null;
    }

    const baseFrame = {
      ...this.lastUpdate.frame,
      x: this.mainWindow.frame.x + this.lastUpdate.frame.x,
      y: this.mainWindow.frame.y + this.lastUpdate.frame.y,
    };
    const display = this.resolveDisplayForFrame(this.mainWindow.frame);

    return resolveVisibleOverlayPresentation(
      {
        frame: baseFrame,
        update: this.lastUpdate,
      },
      display
    );
  }

  private applyOverlayFrame(frame: CompletionOverlayFrame) {
    if (framesEqual(frame, this.lastAppliedFrame)) {
      return;
    }

    this.lastAppliedFrame = frame;
    this.overlayWindow.setFrame(frame.x, frame.y, frame.width, frame.height);
  }
}

function framesEqual(
  left: CompletionOverlayFrame,
  right: CompletionOverlayFrame | null
) {
  return (
    right !== null &&
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

function clampFrameToDisplayWorkArea(
  frame: CompletionOverlayFrame,
  display: Display | null
) {
  if (!display) {
    return frame;
  }

  const maxX = display.workArea.x + display.workArea.width - frame.width;
  const maxY = display.workArea.y + display.workArea.height - frame.height;

  return {
    ...frame,
    x: clamp(frame.x, display.workArea.x, Math.max(display.workArea.x, maxX)),
    y: clamp(frame.y, display.workArea.y, Math.max(display.workArea.y, maxY)),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveVisibleOverlayPresentation(
  {
    frame,
    update,
  }: {
    frame: CompletionOverlayFrame;
    update: CompletionOverlayUpdate;
  },
  display: Display | null
): {
  frame: CompletionOverlayFrame;
  renderState: CompletionOverlayRenderState;
} {
  if (!display || !update.info || update.infoWidth === null) {
    return {
      frame: clampFrameToDisplayWorkArea(frame, display),
      renderState: stripFrame(update),
    };
  }

  const listLeft =
    frame.x +
    COMPLETION_OVERLAY_SHADOW_PADDING +
    (update.infoSide === "left"
      ? update.infoWidth + COMPLETION_OVERLAY_GAP
      : 0);
  const listRight = listLeft + update.listWidth;
  const leftAvailable = Math.max(
    0,
    listLeft - display.workArea.x - COMPLETION_OVERLAY_GAP
  );
  const rightAvailable = Math.max(
    0,
    display.workArea.x +
      display.workArea.width -
      listRight -
      COMPLETION_OVERLAY_GAP
  );
  const preferredSide = resolvedPreferredSide(
    update.infoSide,
    leftAvailable,
    rightAvailable
  );
  const currentSideAvailable =
    preferredSide === "right" ? rightAvailable : leftAvailable;
  const alternateSideAvailable =
    preferredSide === "right" ? leftAvailable : rightAvailable;
  const currentSideWidth = fitOverlayInfoWidth(
    update.infoWidth,
    currentSideAvailable
  );
  const alternateSideWidth = fitOverlayInfoWidth(
    update.infoWidth,
    alternateSideAvailable
  );
  const stackedBottomWidth = fitBottomOverlayInfoWidth(update, display);

  if (
    Math.max(currentSideWidth, alternateSideWidth) <
    COMPLETION_OVERLAY_INFO_BOTTOM_THRESHOLD
  ) {
    const listHeight = getOverlayListHeight(update.items.length);
    const infoHeight = estimateOverlayInfoHeight(
      update.info,
      stackedBottomWidth
    );
    const nextFrame = clampFrameToDisplayWorkArea(
      {
        ...frame,
        x: listLeft - COMPLETION_OVERLAY_SHADOW_PADDING,
        width:
          Math.max(update.listWidth, stackedBottomWidth) +
          COMPLETION_OVERLAY_SHADOW_PADDING * 2,
        height:
          listHeight +
          COMPLETION_OVERLAY_GAP +
          infoHeight +
          COMPLETION_OVERLAY_SHADOW_PADDING * 2,
      },
      display
    );

    return {
      frame: nextFrame,
      renderState: {
        ...stripFrame(update),
        infoSide: "bottom" as const,
        infoWidth: stackedBottomWidth,
      },
    };
  }

  const infoSide: CompletionOverlayInfoSide =
    alternateSideWidth > currentSideWidth
      ? flipInfoSide(preferredSide)
      : preferredSide;
  const infoWidth =
    infoSide === preferredSide ? currentSideWidth : alternateSideWidth;
  const hasInfoPanel = infoWidth > 0;
  const contentLeft =
    infoSide === "left" && hasInfoPanel
      ? listLeft - infoWidth - COMPLETION_OVERLAY_GAP
      : listLeft;
  const contentWidth =
    update.listWidth + (hasInfoPanel ? infoWidth + COMPLETION_OVERLAY_GAP : 0);
  const nextFrame = clampFrameToDisplayWorkArea(
    {
      ...frame,
      x: contentLeft - COMPLETION_OVERLAY_SHADOW_PADDING,
      width: contentWidth + COMPLETION_OVERLAY_SHADOW_PADDING * 2,
    },
    display
  );

  return {
    frame: nextFrame,
    renderState: {
      ...stripFrame(update),
      infoSide,
      infoWidth: hasInfoPanel ? infoWidth : null,
    },
  };
}

function fitOverlayInfoWidth(requestedWidth: number, availableWidth: number) {
  const cappedWidth = Math.min(
    requestedWidth,
    COMPLETION_OVERLAY_INFO_MAX_WIDTH,
    Math.max(0, availableWidth)
  );
  const minimumVisibleWidth = Math.min(
    COMPLETION_OVERLAY_INFO_MIN_VISIBLE_WIDTH,
    Math.max(0, availableWidth)
  );

  return Math.max(cappedWidth, minimumVisibleWidth);
}

function fitBottomOverlayInfoWidth(
  update: CompletionOverlayUpdate,
  display: Display
) {
  const maxWidth = Math.max(
    0,
    display.workArea.width - COMPLETION_OVERLAY_SHADOW_PADDING * 2
  );

  return clamp(
    Math.max(update.listWidth, COMPLETION_OVERLAY_INFO_MAX_WIDTH),
    Math.min(COMPLETION_OVERLAY_INFO_MIN_VISIBLE_WIDTH, maxWidth),
    maxWidth
  );
}

function resolvedPreferredSide(
  side: CompletionOverlayInfoSide,
  leftAvailable: number,
  rightAvailable: number
): "left" | "right" {
  if (side === "left" || side === "right") {
    return side;
  }

  return rightAvailable >= leftAvailable ? "right" : "left";
}

function flipInfoSide(
  side: CompletionOverlayInfoSide
): CompletionOverlayInfoSide {
  return side === "left" ? "right" : "left";
}

function stripFrame(
  update: CompletionOverlayUpdate
): CompletionOverlayRenderState {
  const { frame: _frame, ...renderState } = update;
  return renderState;
}

function getOverlayListHeight(optionCount: number) {
  return Math.min(
    COMPLETION_OVERLAY_LIST_MAX_HEIGHT,
    Math.max(
      COMPLETION_OVERLAY_MIN_HEIGHT,
      optionCount * COMPLETION_OVERLAY_ROW_HEIGHT +
        COMPLETION_OVERLAY_VERTICAL_PADDING
    )
  );
}

function estimateOverlayInfoHeight(
  info: CompletionOverlayUpdate["info"],
  infoWidth: number
) {
  if (!info) {
    return 0;
  }

  const widthScale = infoWidth / COMPLETION_OVERLAY_INFO_MAX_WIDTH;
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
