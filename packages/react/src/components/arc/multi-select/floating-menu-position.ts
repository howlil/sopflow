/** Geometry is in CSS viewport pixels because the menu uses a body portal with position: fixed. */
export interface FloatingMenuPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  side: "top" | "bottom";
}

export interface FloatingMenuBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
}

const GAP = 6;
const EDGE = 8;
const MAX_HEIGHT = 320;

/** Pure positioning policy: prefer bottom, flip when needed, clamp both axes. */
export function positionFloatingMenu(
  anchor: FloatingMenuBounds,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): FloatingMenuPosition {
  const width = Math.min(anchor.width, Math.max(1, viewportWidth - EDGE * 2));
  const left = Math.min(
    Math.max(EDGE, anchor.left),
    Math.max(EDGE, viewportWidth - EDGE - width),
  );
  const below = Math.max(0, viewportHeight - EDGE - anchor.bottom - GAP);
  const above = Math.max(0, anchor.top - EDGE - GAP);
  const wanted = Math.min(MAX_HEIGHT, Math.max(0, contentHeight));
  const side: "top" | "bottom" =
    below >= wanted || below >= above ? "bottom" : "top";
  const maxHeight = Math.min(MAX_HEIGHT, side === "bottom" ? below : above);
  const renderedHeight = Math.min(maxHeight, wanted);
  const top =
    side === "bottom"
      ? anchor.bottom + GAP
      : Math.max(EDGE, anchor.top - GAP - renderedHeight);

  return { left, top, width, maxHeight, side };
}
