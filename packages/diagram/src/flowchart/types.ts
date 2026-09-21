import type { ActorId, StepId } from "@sopflow/core";
import type { DiagramEdgeKind, DiagramNodeKind, DiagramPoint } from "../types.js";

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
}

export interface SopFlowchartModel {
  lanes: SopFlowchartLane[];
  nodes: SopFlowchartNode[];
  edges: SopFlowchartEdge[];
  width: number;
  height: number;
  headerHeight: number;
  rowHeight: number;
}
