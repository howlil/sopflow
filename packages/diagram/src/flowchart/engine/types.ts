import type { ActorId, StepId } from "@sopflow/core";
import type { DiagramEdgeKind, DiagramPoint } from "../../types.js";

export type FlowchartSide = "top" | "right" | "bottom" | "left";

export interface FlowchartRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FlowchartBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface FlowchartGridLayout {
  readonly horizontalLines: readonly number[];
  readonly verticalLines: readonly number[];
  readonly rowGutters: readonly number[];
  readonly minGridX: number;
  readonly maxGridX: number;
  readonly minGridY: number;
  readonly maxGridY: number;
}

export interface FlowchartShapeGeometry {
  readonly stepId: StepId;
  readonly row: number;
  readonly kind: "start" | "task" | "decision" | "end";
  readonly actorId: ActorId | null;
  readonly rect: FlowchartRect;
}

export interface FlowchartRoutingGeometry {
  readonly width: number;
  readonly height: number;
  readonly shapes: ReadonlyMap<StepId, FlowchartShapeGeometry>;
  readonly columns: ReadonlyMap<ActorId | string, FlowchartBounds>;
  readonly pelaksanaBounds: FlowchartBounds;
  readonly grid: FlowchartGridLayout | null;
}

export interface FlowchartRouteConnection {
  readonly id: string;
  readonly from: StepId;
  readonly to: StepId;
  readonly kind: DiagramEdgeKind;
  readonly label?: string;
  readonly sourceType: "flowchart-terminator" | "flowchart-process" | "flowchart-decision";
  readonly targetType: "flowchart-terminator" | "flowchart-process" | "flowchart-decision";
  readonly fromActorId: ActorId | null;
  readonly toActorId: ActorId | null;
  readonly fromRow: number;
  readonly toRow: number;
}

export interface FlowchartPortConstraint {
  exitX?: number;
  exitY?: number;
  entryX?: number;
  entryY?: number;
  exitDx?: number;
  exitDy?: number;
  entryDx?: number;
  entryDy?: number;
  portConstraint?: "north" | "south" | "east" | "west" | "horizontal" | "vertical";
}

export interface FlowchartRouteCandidate {
  readonly sSide: FlowchartSide;
  readonly eSide: FlowchartSide;
  readonly sourcePort?: FlowchartPortConstraint;
  readonly targetPort?: FlowchartPortConstraint;
  readonly jettySize?: number;
  readonly sourceJettySize?: number;
  readonly targetJettySize?: number;
  readonly preferSimple?: boolean;
}

export type FlowchartUsedSides = Record<
  string,
  {
    in?: Partial<Record<FlowchartSide, string[]>>;
    out?: Partial<Record<FlowchartSide, string[]>>;
  }
>;

export interface FlowchartOccupiedSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type FlowchartPoint = DiagramPoint;
