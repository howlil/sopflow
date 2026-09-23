import type { DiagramPoint } from "../../types.js";
import {
  placeRouteLabel,
  type RouteLabelPlacement,
} from "../../routeLabels.js";
import type { FormalFlowchartRect } from "./types.js";

export interface FormalEdgeLabelPlacementInput {
  readonly path: readonly DiagramPoint[];
  readonly label?: string | null;
  readonly obstacles?: readonly FormalFlowchartRect[];
  readonly occupiedLabels?: readonly FormalFlowchartRect[];
  readonly distanceAlongEdge?: number;
  readonly perpendicularOffset?: number;
}

export function placeFormalEdgeLabelPlacement(
  input: FormalEdgeLabelPlacementInput,
): RouteLabelPlacement | null {
  const label = input.label?.trim();
  if (!label) return null;

  return placeRouteLabel({
    path: input.path,
    label,
    obstacles: input.obstacles ?? [],
    occupiedLabels: input.occupiedLabels ?? [],
    perpendicularOffset:
      input.perpendicularOffset ?? (isDecisionLikeLabel(label) ? 22 : 19),
  });
}

export function placeFormalEdgeLabel(
  input: FormalEdgeLabelPlacementInput,
): DiagramPoint | null {
  return placeFormalEdgeLabelPlacement(input)?.position ?? null;
}

function isDecisionLikeLabel(label: string | null | undefined): boolean {
  const value = (label ?? "").trim().toLowerCase();

  return ["ya", "yes", "y", "tidak", "no", "n"].includes(value);
}
