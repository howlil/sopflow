import type {
  DiagramEdgeKind,
  DiagramDiagnostic,
  DiagramNodeKind,
  DiagramPoint,
} from "../types.js";
import type { StepId } from "@sopflow/core";

export interface SvgNodeModel {
  id: StepId;
  kind: DiagramNodeKind;
  label: string;
  lines: string[];
  lineHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "rect" | "rounded" | "diamond";
}

export interface SvgEdgeModel {
  id: string;
  from: StepId;
  to: StepId;
  kind: DiagramEdgeKind;
  path: string;
  label?: string;
  labelPosition?: DiagramPoint;
}

export interface SvgRenderModel {
  width: number;
  height: number;
  nodes: SvgNodeModel[];
  edges: SvgEdgeModel[];
  diagnostics: DiagramDiagnostic[];
}
