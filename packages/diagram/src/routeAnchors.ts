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
