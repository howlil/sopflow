import type { DiagramPoint } from "../../types.js";
import type { FormalFlowchartRect } from "./types.js";

export interface FormalEdgeLabelPlacementInput {
  readonly path: readonly DiagramPoint[];
  readonly label?: string | null;
  readonly obstacles?: readonly FormalFlowchartRect[];
  readonly distanceAlongEdge?: number;
  readonly perpendicularOffset?: number;
}

export function placeFormalEdgeLabel(
  input: FormalEdgeLabelPlacementInput,
): DiagramPoint | null {
  const { path, label, obstacles = [] } = input;
  if (path.length < 2) return null;

  const start = path[0];
  const next = path[1];
  if (!start || !next) return null;

  const dx = next.x - start.x;
  const dy = next.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return { ...start };

  const distance = input.distanceAlongEdge ?? 30;
  const t = Math.min(1, distance / length);
  const px = start.x + dx * t;
  const py = start.y + dy * t;
  const baseOffset =
    input.perpendicularOffset ?? (isDecisionLikeLabel(label) ? 22 : 19);
  const nx = -dy / length;
  const ny = dx / length;

  const candidates = [
    { x: px + nx * baseOffset, y: py + ny * baseOffset },
    { x: px - nx * baseOffset, y: py - ny * baseOffset },
    {
      x: px + nx * (baseOffset + 12),
      y: py + ny * (baseOffset + 12),
    },
    { x: px, y: py - baseOffset },
    { x: px, y: py + baseOffset },
  ];

  return (
    candidates.find(
      (candidate) =>
        !obstacles.some((obstacle) => pointInRect(candidate, obstacle)),
    ) ??
    candidates[0] ??
    null
  );
}

function pointInRect(
  point: DiagramPoint,
  rect: FormalFlowchartRect,
  margin = 4,
): boolean {
  return (
    point.x >= rect.left - margin &&
    point.x <= rect.left + rect.width + margin &&
    point.y >= rect.top - margin &&
    point.y <= rect.top + rect.height + margin
  );
}

function isDecisionLikeLabel(label: string | null | undefined): boolean {
  const value = (label ?? "").trim().toLowerCase();

  return ["ya", "yes", "y", "tidak", "no", "n"].includes(value);
}
