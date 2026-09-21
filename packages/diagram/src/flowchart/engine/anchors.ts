import type { FlowchartRect, FlowchartSide } from "./types.js";

export const CENTER_SNAP_THRESHOLD_PX = 14;
export const ANCHOR_CHANNEL_SPACING_PX = 14;
export const ANCHOR_OFF_CENTER_PENALTY_PER_TENTH = 150;

export function sideLengthPx(
  rect: FlowchartRect,
  side: FlowchartSide,
): number {
  return side === "top" || side === "bottom" ? rect.width : rect.height;
}

export function channelAnchorDistance(
  channelIndex: number,
  sideLength: number,
): number {
  if (sideLength <= 0 || channelIndex <= 0) return 0.5;

  const step = ANCHOR_CHANNEL_SPACING_PX / sideLength;
  const half = Math.ceil(channelIndex / 2);
  const sign = channelIndex % 2 === 1 ? -1 : 1;

  return Math.max(0.08, Math.min(0.92, 0.5 + sign * half * step));
}

export function preferCenterAnchorDistance(
  usedCount: number,
  sideLength: number,
): number {
  return usedCount <= 0
    ? 0.5
    : channelAnchorDistance(usedCount, sideLength);
}

export function scoreAnchorOffCenter(distance: number): number {
  return (
    Math.abs(distance - 0.5) *
    10 *
    ANCHOR_OFF_CENTER_PENALTY_PER_TENTH
  );
}
