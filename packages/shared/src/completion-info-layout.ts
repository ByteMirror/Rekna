export type CompletionInfoRect = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export type CompletionInfoLayout = {
  className: string;
  maxHeight: number;
  maxWidth: number;
  offset: number;
  offsetSide: "bottom" | "top";
  style: string;
};

type CompletionInfoLayoutOptions = {
  info: CompletionInfoRect;
  list: CompletionInfoRect;
  option?: CompletionInfoRect;
  rtl?: boolean;
  space: CompletionInfoRect;
};

const INFO_MAX_WIDTH = 300;
const INFO_VIEWPORT_PADDING = 16;

export function calculateCompletionInfoLayout({
  info,
  list,
  rtl = false,
  space,
}: CompletionInfoLayoutOptions): CompletionInfoLayout {
  const spaceLeft = Math.max(0, list.left - space.left);
  const spaceRight = Math.max(0, space.right - list.right);
  const infoWidth = Math.max(0, info.right - info.left);
  const infoHeight = Math.max(0, info.bottom - info.top);
  const listHeight = Math.max(0, list.bottom - list.top);
  let placeLeft = spaceLeft === spaceRight ? rtl : spaceLeft > spaceRight;

  if ((placeLeft ? spaceLeft : spaceRight) <= 0) {
    placeLeft = !placeLeft;
  }

  const viewportWidth = Math.max(
    0,
    space.right - space.left - INFO_VIEWPORT_PADDING * 2
  );
  const maxWidth = Math.min(
    INFO_MAX_WIDTH,
    Math.max(0, placeLeft ? spaceLeft : spaceRight),
    viewportWidth
  );

  const centeredTop = list.top + (listHeight - infoHeight) / 2;
  const minTop = space.top + INFO_VIEWPORT_PADDING;
  const maxTop = space.bottom - infoHeight - INFO_VIEWPORT_PADDING;
  const clampedTop =
    maxTop >= minTop ? clamp(centeredTop, minTop, maxTop) : minTop;
  const safeMaxHeight = Math.max(
    0,
    Math.round(space.bottom - clampedTop - INFO_VIEWPORT_PADDING)
  );
  const safeMaxWidth = Math.max(
    0,
    Math.min(Math.round(maxWidth), Math.round(viewportWidth))
  );
  const safeOffset = Math.round(clampedTop - list.top);
  const className = `cm-completionInfo-${placeLeft ? "left" : "right"}`;
  const widthStyle =
    safeMaxWidth > 0 && safeMaxWidth < Math.round(infoWidth)
      ? ` width: ${safeMaxWidth}px;`
      : "";

  return {
    className,
    maxHeight: safeMaxHeight,
    maxWidth: safeMaxWidth,
    offset: safeOffset,
    offsetSide: "top",
    style: `top: ${safeOffset}px;${widthStyle} max-width: ${safeMaxWidth}px; max-height: ${safeMaxHeight}px;`,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
