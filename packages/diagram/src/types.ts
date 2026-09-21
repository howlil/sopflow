import type { StepId } from "@sopflow/core";

export type DiagramNodeKind = "start" | "task" | "decision" | "end";

export type DiagramEdgeKind = "next" | "yes" | "no";

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
}

export interface DiagramDiagnostic {
  code: "MISSING_EDGE_TARGET" | "MISSING_EDGE_SOURCE";
  edgeId: string;
  from: StepId;
  to: StepId;
}

export interface DiagramModel {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  routedEdges: DiagramRoutedEdge[];
  diagnostics: DiagramDiagnostic[];
  width: number;
  height: number;
}
