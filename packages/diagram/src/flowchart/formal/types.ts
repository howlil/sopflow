import type { ActorId, StepId } from "@sopflow/core";
import type { DiagramPoint } from "../../types.js";

export type FormalFlowchartSide = "top" | "right" | "bottom" | "left";

export interface FormalFlowchartRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface FormalFlowchartBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export type FormalFlowchartColumnBounds = Readonly<
  Record<ActorId, FormalFlowchartBounds>
>;

export interface FormalFlowchartGridLayout {
  readonly horizontalLines: readonly number[];
  readonly verticalLines: readonly number[];
  readonly rowGutters: readonly number[];
  readonly minGridX: number;
  readonly maxGridX: number;
  readonly minGridY: number;
  readonly maxGridY: number;
}

export interface FormalFlowchartShapeGeometry {
  readonly stepId: StepId;
  readonly actorId: ActorId | null;
  readonly row: number;
  readonly kind: "start" | "task" | "decision" | "end";
  readonly rect: FormalFlowchartRect;
}

export interface FormalFlowchartGeometry {
  readonly width: number;
  readonly height: number;
  readonly pelaksanaBounds: FormalFlowchartBounds | null;
  readonly columns: FormalFlowchartColumnBounds;
  readonly gridLayout: FormalFlowchartGridLayout | null;
  readonly shapes: ReadonlyMap<StepId, FormalFlowchartShapeGeometry>;
}

export interface FormalFlowchartOccupiedSegment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface FormalFlowchartRouteCandidate {
  readonly sourceSide: FormalFlowchartSide;
  readonly targetSide: FormalFlowchartSide;
  readonly jettySize?: number;
  readonly sourceJettySize?: number;
  readonly targetJettySize?: number;
  readonly preferSimple?: boolean;
}

export interface FormalFlowchartRouteResult {
  readonly points: readonly DiagramPoint[];
  readonly sourceSide: FormalFlowchartSide;
  readonly targetSide: FormalFlowchartSide;
}
