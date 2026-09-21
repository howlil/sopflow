import type { DiagramPoint } from "../types.js";

export function pointsToPath(points: readonly DiagramPoint[]): string {
  const [first, ...rest] = points;

  if (!first) {
    return "";
  }

  return [
    `M ${first.x} ${first.y}`,
    ...rest.map((point) => `L ${point.x} ${point.y}`),
  ].join(" ");
}
