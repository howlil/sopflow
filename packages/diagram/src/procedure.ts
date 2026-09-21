import type { ActorId, Duration, SOPDocument, StepId } from "@sopflow/core";
import type {
  FormalFlowchartGeometry,
  FormalFlowchartSide,
} from "./flowchart/formal/types.js";
import { planFormalProcedureEdges } from "./flowchart/formal/planner.js";
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
  /**
   * Detailed formal SOP-AP geometry. When present, routing uses the
   * sop-ta-compatible formal flowchart planner.
   */
  readonly formal?: FormalFlowchartGeometry;
}

export interface ProcedureManualAnchor {
  readonly side: FormalFlowchartSide;
  readonly distance: number;
}

interface ProcedureManualRouteBase {
  readonly startAnchor?: ProcedureManualAnchor;
  readonly endAnchor?: ProcedureManualAnchor;
  readonly labelPosition?: DiagramPoint;
}

export type ProcedureManualRoute =
  | (ProcedureManualRouteBase & {
      readonly kind: "trunk";
      readonly x: number;
    })
  | (ProcedureManualRouteBase & {
      readonly kind: "orthogonal";
      readonly bendPoints: readonly DiagramPoint[];
    });

export type ProcedureManualRoutes = Readonly<
  Record<string, ProcedureManualRoute>
>;

export interface SopDiagramConfig {
  readonly routes?: ProcedureManualRoutes;
  /**
   * Deterministic routing seed. Different seeds try another stable connection
   * order without changing SOP semantics.
   */
  readonly pathLayoutSeed?: number;
}

/**
 * @deprecated Use SopDiagramConfig.routes. Kept so existing low-level
 * SopProcedureView consumers can migrate without a breaking change.
 */
export type ProcedureManualTrunks = Readonly<Record<string, number>>;

export type ProcedureRoutingOverrides =
  | SopDiagramConfig
  | ProcedureManualTrunks;

export interface ProcedureRoutedEdge extends WorkflowEdge {
  readonly points: readonly DiagramPoint[];
  readonly sourceSide?: FormalFlowchartSide;
  readonly targetSide?: FormalFlowchartSide;
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
  overrides: ProcedureRoutingOverrides = {},
): ProcedureRoutedEdge[] {
  const orderByStepId = new Map(
    model.rows.map((row, index) => [row.stepId, index] as const),
  );
  const { routes, legacyTrunks, pathLayoutSeed } =
    resolveRoutingOverrides(overrides);

  if (geometry.formal) {
    const manualRoutes = {
      ...Object.fromEntries(
        Object.entries(legacyTrunks).map(([edgeId, x]) => [
          edgeId,
          { kind: "trunk" as const, x },
        ]),
      ),
      ...routes,
    };
    const planned = planFormalProcedureEdges(
      {
        rows: model.rows.map((row) => ({
          stepId: row.stepId,
          number: row.number,
          kind: row.kind,
          primaryActorId: row.primaryActorId,
        })),
        edges: model.graph.edges,
      },
      geometry.formal,
      manualRoutes,
      { pathLayoutSeed },
    );

    return planned.map((edge) => ({
      ...edge,
      points: [...edge.points],
    }));
  }

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

    const manualRoute = routes[edge.id];
    const legacyTrunkX = legacyTrunks[edge.id];
    const effectiveTrunkX =
      manualRoute?.kind === "trunk"
        ? manualRoute.x
        : (legacyTrunkX ?? autoTrunkX);
    const points =
      manualRoute?.kind === "orthogonal"
        ? buildManualPath(from, to, manualRoute.bendPoints, geometry)
        : buildTrunkPath(from, to, clampTrunkX(effectiveTrunkX, geometry));
    const fallbackHandle = {
      x: clampTrunkX(effectiveTrunkX, geometry),
      y: (from.y + to.y) / 2,
    };
    const handlePosition = findRouteHandle(points, fallbackHandle);
    const trunkX = handlePosition.x;

    return [
      {
        ...edge,
        points,
        trunkX,
        handlePosition,
        ...(edge.label
          ? {
              labelPosition: manualRoute?.labelPosition ?? {
                x: handlePosition.x + 3,
                y: handlePosition.y - 4,
              },
            }
          : {}),
      },
    ];
  });
}

export function updateProcedureManualTrunk(
  model: ProcedureModel,
  geometry: ProcedureGeometry,
  config: SopDiagramConfig,
  edgeId: string,
  requestedX: number,
): SopDiagramConfig {
  const edge = model.graph.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) return config;

  const from = geometry.anchors.get(edge.from);
  const to = geometry.anchors.get(edge.to);
  if (!from || !to) return config;

  const trunkX = clampTrunkX(requestedX, geometry);
  const currentRoute = config.routes?.[edgeId];
  const nextRoute: ProcedureManualRoute = {
    kind: "trunk",
    x: trunkX,
    ...(currentRoute?.startAnchor
      ? { startAnchor: { ...currentRoute.startAnchor } }
      : {}),
    ...(currentRoute?.endAnchor
      ? { endAnchor: { ...currentRoute.endAnchor } }
      : {}),
    ...(currentRoute?.labelPosition
      ? { labelPosition: currentRoute.labelPosition }
      : {}),
  };

  return {
    ...config,
    routes: {
      ...config.routes,
      [edgeId]: nextRoute,
    },
  };
}

export function setProcedureManualEndpoint(
  config: SopDiagramConfig,
  edgeId: string,
  kind: "start" | "end",
  anchor: ProcedureManualAnchor,
): SopDiagramConfig {
  const current = config.routes?.[edgeId];
  const base: ProcedureManualRoute =
    current ??
    ({
      kind: "orthogonal",
      bendPoints: [],
    } satisfies ProcedureManualRoute);

  const next: ProcedureManualRoute = {
    ...base,
    ...(kind === "start"
      ? { startAnchor: { ...anchor } }
      : { endAnchor: { ...anchor } }),
  };

  return setProcedureManualRoute(config, edgeId, next);
}

export function setProcedureManualRoute(
  config: SopDiagramConfig,
  edgeId: string,
  route: ProcedureManualRoute,
): SopDiagramConfig {
  return {
    ...config,
    routes: {
      ...config.routes,
      [edgeId]:
        route.kind === "trunk"
          ? {
              kind: "trunk",
              x: route.x,
              ...(route.startAnchor
                ? { startAnchor: { ...route.startAnchor } }
                : {}),
              ...(route.endAnchor
                ? { endAnchor: { ...route.endAnchor } }
                : {}),
              ...(route.labelPosition
                ? { labelPosition: { ...route.labelPosition } }
                : {}),
            }
          : {
              kind: "orthogonal",
              bendPoints: route.bendPoints.map((point) => ({ ...point })),
              ...(route.startAnchor
                ? { startAnchor: { ...route.startAnchor } }
                : {}),
              ...(route.endAnchor
                ? { endAnchor: { ...route.endAnchor } }
                : {}),
              ...(route.labelPosition
                ? { labelPosition: { ...route.labelPosition } }
                : {}),
            },
    },
  };
}

export function removeProcedureManualRoute(
  config: SopDiagramConfig,
  edgeId: string,
): SopDiagramConfig {
  if (!config.routes?.[edgeId]) return config;

  const routes = { ...config.routes };
  delete routes[edgeId];

  const { routes: _removedRoutes, ...rest } = config;

  return Object.keys(routes).length > 0 ? { ...rest, routes } : rest;
}

function resolveRoutingOverrides(overrides: ProcedureRoutingOverrides): {
  routes: ProcedureManualRoutes;
  legacyTrunks: ProcedureManualTrunks;
  pathLayoutSeed: number;
} {
  if (isDiagramConfig(overrides)) {
    return {
      routes: overrides.routes ?? {},
      legacyTrunks: {},
      pathLayoutSeed: overrides.pathLayoutSeed ?? 0,
    };
  }

  return {
    routes: {},
    legacyTrunks: overrides,
    pathLayoutSeed: 0,
  };
}

function isDiagramConfig(
  overrides: ProcedureRoutingOverrides,
): overrides is SopDiagramConfig {
  if (Object.hasOwn(overrides, "pathLayoutSeed")) return true;
  if (Object.hasOwn(overrides, "routes")) return true;

  const values = Object.values(overrides);
  return (
    values.length === 0 || values.some((value) => typeof value !== "number")
  );
}

function buildTrunkPath(
  from: DiagramPoint,
  to: DiagramPoint,
  trunkX: number,
): DiagramPoint[] {
  return compactOrthogonalPoints([
    from,
    { x: trunkX, y: from.y },
    { x: trunkX, y: to.y },
    to,
  ]);
}

function buildManualPath(
  from: DiagramPoint,
  to: DiagramPoint,
  bendPoints: readonly DiagramPoint[],
  geometry: ProcedureGeometry,
): DiagramPoint[] {
  const points = [
    clampPoint(from, geometry),
    ...bendPoints.map((point) => clampPoint(point, geometry)),
    clampPoint(to, geometry),
  ];

  return orthogonalize(points);
}

function orthogonalize(points: readonly DiagramPoint[]): DiagramPoint[] {
  const result: DiagramPoint[] = [];

  for (const point of points) {
    const previous = result.at(-1);
    if (!previous) {
      result.push({ ...point });
      continue;
    }

    if (previous.x !== point.x && previous.y !== point.y) {
      result.push({ x: point.x, y: previous.y });
    }

    result.push({ ...point });
  }

  return compactOrthogonalPoints(result);
}

function clampTrunkX(value: number, geometry: ProcedureGeometry): number {
  const padding = 8;
  return Math.max(
    geometry.actorLeft + padding,
    Math.min(geometry.actorRight - padding, value),
  );
}

function clampPoint(
  point: DiagramPoint,
  geometry: ProcedureGeometry,
): DiagramPoint {
  return {
    x: clampTrunkX(point.x, geometry),
    y: Math.max(0, Math.min(geometry.height, point.y)),
  };
}

function findRouteHandle(
  points: readonly DiagramPoint[],
  fallback: DiagramPoint,
): DiagramPoint {
  let best: { position: DiagramPoint; length: number } | null = null;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to || from.x !== to.x || from.y === to.y) continue;

    const length = Math.abs(to.y - from.y);
    if (best && best.length >= length) continue;

    best = {
      length,
      position: {
        x: from.x,
        y: from.y + (to.y - from.y) / 2,
      },
    };
  }

  return best?.position ?? fallback;
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
