import { getPresentationSteps, type ActorId, type Duration, type SOPDocument, type StepId } from "@sopflow/core";
import type { DiagramPoint } from "../types.js";
import type { DiagramRect } from "../routeGeometry.js";
import type { FormalFlowchartGeometry } from "../flowchart/formal/types.js";
import { projectWorkflow, type WorkflowGraph } from "../workflow.js";

export interface ProcedureActorColumn {
  readonly actorId: ActorId | null;
  readonly label: string;
}

export interface ProcedureRowModel {
  readonly stepId: StepId;
  readonly number: number;
  readonly kind: "start" | "task" | "decision" | "end";
  readonly activity: string;
  readonly actorIds: readonly ActorId[];
  readonly primaryActorId: ActorId | null;
  readonly input?: string;
  readonly duration?: Duration;
  readonly output?: string;
  readonly note?: string;
}

export interface ProcedureModel {
  readonly actorColumns: readonly ProcedureActorColumn[];
  readonly rows: readonly ProcedureRowModel[];
  readonly graph: WorkflowGraph;
}

export interface ProcedureNodeGeometry {
  readonly stepId: StepId;
  readonly rect: DiagramRect;
  readonly laneId: ActorId | null;
}

export interface ProcedureLaneGeometry {
  readonly actorId: ActorId | null;
  readonly left: number;
  readonly right: number;
  readonly top?: number;
  readonly bottom?: number;
}

export interface ProcedureGeometry {
  readonly width: number;
  readonly height: number;
  readonly anchors: ReadonlyMap<StepId, DiagramPoint>;
  readonly actorLeft: number;
  readonly actorRight: number;
  /** Optional measured lane bounds. Missing measurements use the fallback lane. */
  readonly actorLanes?: ReadonlyMap<ActorId | null, ProcedureLaneGeometry>;
  readonly nodes?: ReadonlyMap<StepId, ProcedureNodeGeometry>;
  readonly obstacles?: readonly DiagramRect[];
  readonly routingBounds?: DiagramRect;
  /**
   * Detailed formal SOP-AP geometry. When present, routing uses the
   * sop-ta-compatible formal flowchart planner.
   */
  readonly formal?: FormalFlowchartGeometry;
}

export function buildProcedureModel(document: SOPDocument): ProcedureModel {
  const graph = projectWorkflow(document);
  const actorIds = new Set(document.actors.map((actor) => actor.id));
  const presentationSteps = getPresentationSteps(document);
  const hasFallbackRows = document.steps.some(
    (step) =>
      step.actorIds.length === 0 ||
      !step.actorIds.some((actorId) => actorIds.has(actorId)),
  );
  const actorColumns: ProcedureActorColumn[] = [
    ...document.actors.map((actor) => ({
      actorId: actor.id,
      label: actor.name,
    })),
    ...(document.actors.length === 0 || hasFallbackRows
      ? [{ actorId: null, label: "Pelaksana" }]
      : []),
  ];
  const rows = presentationSteps.map<ProcedureRowModel>((step, index) => ({
    stepId: step.id,
    number: index + 1,
    kind: step.type,
    activity: step.name,
    actorIds: step.actorIds,
    primaryActorId:
      step.actorIds.find((actorId) => actorIds.has(actorId)) ?? null,
    ...(step.input !== undefined ? { input: step.input } : {}),
    ...(step.duration !== undefined ? { duration: step.duration } : {}),
    ...(step.output !== undefined ? { output: step.output } : {}),
    ...(step.note !== undefined ? { note: step.note } : {}),
  }));

  return {
    actorColumns,
    rows,
    graph,
  };
}

