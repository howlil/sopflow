import type { StepId } from "@sopflow/core";

export type DiagramNodeKind = "start" | "task" | "decision" | "end";

export type DiagramEdgeKind = "next" | "yes" | "no";

export type DiagramSide = "top" | "right" | "bottom" | "left";

export type DiagramRouteKind = "automatic" | "manual" | "fallback";

export interface DiagramPoint {
  x: number;
  y: number;
}

export interface DiagramSize {
  width: number;
  height: number;
}

export interface DiagramTextLayout {
  lines: string[];
  lineHeight: number;
}

export interface DiagramNode {
  id: StepId;
  kind: DiagramNodeKind;
  label: string;
  text: DiagramTextLayout;
  position: DiagramPoint;
  size: DiagramSize;
}

export interface DiagramEdge {
  id: string;
  from: StepId;
  to: StepId;
  kind: DiagramEdgeKind;
  label?: string;
}

export interface DiagramRoutedEdge extends DiagramEdge {
  points: DiagramPoint[];
  routeKind?: DiagramRouteKind;
  sourceSide?: DiagramSide;
  targetSide?: DiagramSide;
  labelPosition?: DiagramPoint;
  quality?: DiagramRouteQuality;
  routeDiagnostics?: DiagramDiagnostic[];
}

export interface DiagramRouteQuality {
  length: number;
  bends: number;
  obstacleHits: number;
  overlaps: number;
  crossings: number;
}

export interface DiagramDiagnostic {
  code:
    | "MISSING_EDGE_TARGET"
    | "MISSING_EDGE_SOURCE"
    | "INVALID_MANUAL_ROUTE"
    | "MISSING_ANCHOR"
    | "INVALID_GEOMETRY"
    | "NON_ORTHOGONAL_PATH"
    | "PATH_INTERSECTS_NODE"
    | "PATH_OVERLAPS_EDGE"
    | "PATH_CROSSES_EDGE"
    | "PATH_OUT_OF_BOUNDS"
    | "ROUTE_FALLBACK_USED"
    | "UNASSIGNED_ACTOR"
    | "UNKNOWN_ACTOR_LANE"
    | "STALE_ROUTE_OVERRIDE"
    | "ROUTE_RECONCILED";
  edgeId: string;
  from: StepId;
  to: StepId;
}

export interface DiagramModel {
  nodes: DiagramNode[];
  /** Semantic connections are retained even when an edge is not renderable. */
  connections?: readonly DiagramEdge[];
  edges: DiagramEdge[];
  routedEdges: DiagramRoutedEdge[];
  diagnostics: DiagramDiagnostic[];
  width: number;
  height: number;
}
