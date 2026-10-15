import type { ActorId, StepId } from "@sopflow/core";
import type { DiagramDiagnostic, DiagramPoint, DiagramRouteKind, DiagramRouteQuality, DiagramSide } from "../types.js";
import type { WorkflowEdge } from "../workflow.js";
import type { SopDiagramConfig } from "../config/types.js";

export interface BpmnLayoutOptions {
  readonly laneHeight?: number;
  readonly headerWidth?: number;
  readonly stepGap?: number;
  readonly padding?: number;
  /** Persisted route preferences for the BPMN projection. */
  readonly diagramConfig?: SopDiagramConfig;
}

export interface BpmnLane {
  readonly actorId: ActorId | null;
  readonly label: string;
  readonly index: number;
  readonly y: number;
  readonly height: number;
}

export interface BpmnNode {
  readonly id: StepId;
  readonly kind: "start" | "task" | "decision" | "end";
  readonly label: string;
  readonly laneIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly labelLines: readonly string[];
  readonly labelLineHeight: number;
}

export interface BpmnRoutedEdge extends WorkflowEdge {
  readonly points: readonly DiagramPoint[];
  readonly labelPosition?: DiagramPoint;
  readonly routeKind?: DiagramRouteKind;
  readonly sourceSide?: DiagramSide;
  readonly targetSide?: DiagramSide;
  readonly quality?: DiagramRouteQuality;
  readonly routeDiagnostics?: readonly DiagramDiagnostic[];
}

export interface BpmnModel {
  readonly lanes: readonly BpmnLane[];
  readonly nodes: readonly BpmnNode[];
  /** All semantic connections, including those that cannot be rendered. */
  readonly connections: readonly WorkflowEdge[];
  readonly edges: readonly BpmnRoutedEdge[];
  readonly diagnostics: readonly DiagramDiagnostic[];
  readonly width: number;
  readonly height: number;
  readonly padding: number;
  readonly headerWidth: number;
  readonly laneHeight: number;
}
