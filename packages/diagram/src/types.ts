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

export interface DiagramNode {
  id: string;
  kind: DiagramNodeKind;
  label: string;
  position: DiagramPoint;
  size: DiagramSize;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  kind: DiagramEdgeKind;
  label?: string;
}

export interface DiagramRoutedEdge extends DiagramEdge {
  points: DiagramPoint[];
}

export interface DiagramModel {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  routedEdges: DiagramRoutedEdge[];
  width: number;
  height: number;
}
