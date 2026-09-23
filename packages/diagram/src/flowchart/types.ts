import type { ActorId, StepId } from "@sopflow/core";
import type {
  DiagramDiagnostic,
  DiagramEdgeKind,
  DiagramNodeKind,
  DiagramPoint,
  DiagramRouteKind,
  DiagramRouteQuality,
  DiagramSide,
} from "../types.js";
import type { WorkflowConnection } from "../workflow.js";

export interface SopFlowchartLane {
  actorId: ActorId | null;
  label: string;
  x: number;
  width: number;
}

export interface SopFlowchartNodePlacement {
  actorId: ActorId | null;
  x: number;
  y: number;
}

export interface SopFlowchartNode {
  id: StepId;
  kind: DiagramNodeKind;
  label: string;
  actorIds: readonly ActorId[];
  row: number;
  width: number;
  height: number;
  placements: SopFlowchartNodePlacement[];
}

export interface SopFlowchartEdge {
  id: string;
  from: StepId;
  to: StepId;
  kind: DiagramEdgeKind;
  label?: string;
  points: DiagramPoint[];
  labelPosition?: DiagramPoint;
  routeKind?: DiagramRouteKind;
  sourceSide?: DiagramSide;
  targetSide?: DiagramSide;
  quality?: DiagramRouteQuality;
  routeDiagnostics?: readonly DiagramDiagnostic[];
}

export interface SopFlowchartModel {
  lanes: SopFlowchartLane[];
  nodes: SopFlowchartNode[];
  connections: readonly WorkflowConnection[];
  edges: SopFlowchartEdge[];
  diagnostics: readonly DiagramDiagnostic[];
  width: number;
  height: number;
  headerHeight: number;
  rowHeight: number;
}
