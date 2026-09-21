import type { ActorId, Duration, SOPDocument, StepId } from "@sopflow/core";
import type { DiagramPoint } from "./types.js";
import {
  projectWorkflow,
  type WorkflowEdge,
  type WorkflowGraph,
} from "./workflow.js";

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

export interface ProcedureGeometry {
  readonly width: number;
  readonly height: number;
  readonly anchors: ReadonlyMap<StepId, DiagramPoint>;
  readonly actorLeft: number;
  readonly actorRight: number;
}

export type ProcedureManualTrunks = Readonly<Record<string, number>>;

export interface ProcedureRoutedEdge extends WorkflowEdge {
  readonly points: readonly DiagramPoint[];
  readonly trunkX: number;
  readonly handlePosition: DiagramPoint;
  readonly labelPosition?: DiagramPoint;
}

export function buildProcedureModel(document: SOPDocument): ProcedureModel {
  const actorColumns: ProcedureActorColumn[] =
    document.actors.length > 0
      ? document.actors.map((actor) => ({
          actorId: actor.id,
          label: actor.name,
        }))
      : [{ actorId: null, label: "Pelaksana" }];

  const fallbackActorId = actorColumns[0]?.actorId ?? null;
  const rows = document.steps.map<ProcedureRowModel>((step, index) => ({
    stepId: step.id,
    number: index + 1,
    kind: step.type,
    activity: step.name,
    actorIds: step.actorIds,
    primaryActorId: step.actorIds[0] ?? fallbackActorId,
    ...(step.input !== undefined ? { input: step.input } : {}),
    ...(step.duration !== undefined ? { duration: step.duration } : {}),
    ...(step.output !== undefined ? { output: step.output } : {}),
    ...(step.note !== undefined ? { note: step.note } : {}),
  }));

  return {
    actorColumns,
    rows,
    graph: projectWorkflow(document),
  };
}

export function routeProcedureEdges(
  model: ProcedureModel,
  geometry: ProcedureGeometry,
  manualTrunks: ProcedureManualTrunks = {},
): ProcedureRoutedEdge[] {
  const orderByStepId = new Map(
    model.rows.map((row, index) => [row.stepId, index] as const),
  );
  let backIndex = 0;

  return model.graph.edges.flatMap<ProcedureRoutedEdge>((edge) => {
    const from = geometry.anchors.get(edge.from);
    const to = geometry.anchors.get(edge.to);
    if (!from || !to) return [];

    const sourceOrder = orderByStepId.get(edge.from);
    const targetOrder = orderByStepId.get(edge.to);
    if (sourceOrder === undefined || targetOrder === undefined) return [];

    const isBack = targetOrder <= sourceOrder;
    const currentBackIndex = isBack ? backIndex++ : -1;
    const autoTrunkX = isBack
      ? geometry.actorRight - 10 - currentBackIndex * 10
      : from.x + (to.x - from.x) / 2;
    const trunkX = manualTrunks[edge.id] ?? autoTrunkX;
    const points = compactOrthogonalPoints([
      from,
      { x: trunkX, y: from.y },
      { x: trunkX, y: to.y },
      to,
    ]);

    return [
      {
        ...edge,
        points,
        trunkX,
        handlePosition: {
          x: trunkX,
          y: (from.y + to.y) / 2,
        },
        ...(edge.label
          ? {
              labelPosition: {
                x: trunkX + 3,
                y: (from.y + to.y) / 2 - 4,
              },
            }
          : {}),
      },
    ];
  });
}

function compactOrthogonalPoints(
  points: readonly DiagramPoint[],
): DiagramPoint[] {
  const deduped: DiagramPoint[] = [];

  for (const point of points) {
    const previous = deduped.at(-1);
    if (previous?.x === point.x && previous.y === point.y) continue;
    deduped.push({ x: point.x, y: point.y });
  }

  if (deduped.length <= 2) return deduped;

  const result: DiagramPoint[] = [deduped[0] as DiagramPoint];

  for (let index = 1; index < deduped.length - 1; index += 1) {
    const previous = result.at(-1);
    const current = deduped[index];
    const next = deduped[index + 1];
    if (!previous || !current || !next) continue;

    const collinear =
      (previous.x === current.x && current.x === next.x) ||
      (previous.y === current.y && current.y === next.y);

    if (!collinear) result.push(current);
  }

  result.push(deduped.at(-1) as DiagramPoint);
  return result;
}
