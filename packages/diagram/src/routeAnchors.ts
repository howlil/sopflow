import type { DiagramPoint, DiagramSide } from "./types.js";
import type { DiagramRect } from "./routeGeometry.js";

export function pointOnRectSide(
  rect: DiagramRect,
  side: DiagramSide,
  distance = 0.5,
): DiagramPoint {
  const normalized = Math.max(0, Math.min(1, distance));

  switch (side) {
    case "top":
      return { x: rect.left + rect.width * normalized, y: rect.top };
    case "right":
      return {
        x: rect.left + rect.width,
        y: rect.top + rect.height * normalized,
      };
    case "bottom":
      return {
        x: rect.left + rect.width * normalized,
        y: rect.top + rect.height,
      };
    case "left":
      return { x: rect.left, y: rect.top + rect.height * normalized };
  }
}

export function distanceOnRectSide(
  rect: DiagramRect,
  side: DiagramSide,
  point: DiagramPoint,
): number {
  if (side === "top" || side === "bottom") {
    return rect.width <= 0 ? 0.5 : (point.x - rect.left) / rect.width;
  }

  return rect.height <= 0 ? 0.5 : (point.y - rect.top) / rect.height;
}

export function nearestRectSide(
  rect: DiagramRect,
  point: DiagramPoint,
): DiagramSide {
  const distances: Array<readonly [DiagramSide, number]> = [
    ["top", Math.abs(point.y - rect.top)],
    ["right", Math.abs(point.x - (rect.left + rect.width))],
    ["bottom", Math.abs(point.y - (rect.top + rect.height))],
    ["left", Math.abs(point.x - rect.left)],
  ];

  distances.sort((left, right) => left[1] - right[1]);
  return distances[0]?.[0] ?? "top";
}

export function extrudePoint(
  point: DiagramPoint,
  side: DiagramSide,
  distance: number,
): DiagramPoint {
  switch (side) {
    case "top":
      return { x: point.x, y: point.y - distance };
    case "right":
      return { x: point.x + distance, y: point.y };
    case "bottom":
      return { x: point.x, y: point.y + distance };
    case "left":
      return { x: point.x - distance, y: point.y };
  }
}

export const ROUTE_ANCHOR_MIN_DISTANCE = 0.08;
export const ROUTE_ANCHOR_MAX_DISTANCE = 0.92;
export const ROUTE_ANCHOR_CHANNEL_SPACING_PX = 14;

export function clampAnchorDistance(distance: number): number {
  if (!Number.isFinite(distance)) return 0.5;
  return Math.max(
    ROUTE_ANCHOR_MIN_DISTANCE,
    Math.min(ROUTE_ANCHOR_MAX_DISTANCE, distance),
  );
}

export function channelAnchorDistance(
  channelIndex: number,
  sideLengthPx: number,
  spacingPx = ROUTE_ANCHOR_CHANNEL_SPACING_PX,
): number {
  if (sideLengthPx <= 0 || channelIndex <= 0) return 0.5;

  const step = spacingPx / sideLengthPx;
  const offsetIndex = Math.ceil(channelIndex / 2);
  const direction = channelIndex % 2 === 1 ? -1 : 1;
  const physicalCandidate = 0.5 + direction * offsetIndex * step;

  if (
    physicalCandidate >= ROUTE_ANCHOR_MIN_DISTANCE &&
    physicalCandidate <= ROUTE_ANCHOR_MAX_DISTANCE
  ) {
    return physicalCandidate;
  }

  // Once the physical spacing cannot fit on a short side, keep allocating
  // deterministic distinct positions instead of collapsing every extra port
  // onto the same clamped endpoint.
  const safeSpan = ROUTE_ANCHOR_MAX_DISTANCE - ROUTE_ANCHOR_MIN_DISTANCE;
  return ROUTE_ANCHOR_MIN_DISTANCE + safeSpan * vanDerCorput(channelIndex + 1);
}

function vanDerCorput(value: number): number {
  let index = Math.max(1, Math.floor(value));
  let fraction = 0;
  let denominator = 1;

  while (index > 0) {
    denominator *= 2;
    fraction += (index % 2) / denominator;
    index = Math.floor(index / 2);
  }

  return fraction;
}
