import type { ActorId, Duration, SOPDocument, StepId } from "@sopflow/core";
import type {
  DiagramDiagnostic,
  DiagramPoint,
  DiagramRouteKind,
  DiagramRouteQuality,
  DiagramSide,
} from "./types.js";
import {
  measureRouteQuality,
  pathIntersectsRectangles,
  pathOverlapsSegments,
  pathToSegments,
  pathWithinBounds,
  scorePath,
  type DiagramRect,
  type RouteSegment,
} from "./routeGeometry.js";
import type { FormalFlowchartGeometry } from "./flowchart/formal/types.js";
import { planFormalProcedureEdges } from "./flowchart/formal/planner.js";
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

export type ProcedureManualRoute =
  | {
      readonly kind: "trunk";
      readonly x: number;
      readonly labelPosition?: DiagramPoint;
      readonly sSide?: DiagramSide;
      readonly eSide?: DiagramSide;
      readonly startPoint?: DiagramPoint;
      readonly endPoint?: DiagramPoint;
    }
  | {
      readonly kind: "orthogonal";
      readonly bendPoints: readonly DiagramPoint[];
      readonly labelPosition?: DiagramPoint;
      readonly sSide?: DiagramSide;
      readonly eSide?: DiagramSide;
      readonly startPoint?: DiagramPoint;
      readonly endPoint?: DiagramPoint;
    };

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
  readonly trunkX: number;
  readonly handlePosition: DiagramPoint;
  readonly labelPosition?: DiagramPoint;
  readonly routeKind?: DiagramRouteKind;
  readonly sourceSide?: DiagramSide;
  readonly targetSide?: DiagramSide;
  readonly quality?: DiagramRouteQuality;
  readonly routeDiagnostics?: readonly DiagramDiagnostic[];
}

export function buildProcedureModel(document: SOPDocument): ProcedureModel {
  const graph = projectWorkflow(document);
  const actorIds = new Set(document.actors.map((actor) => actor.id));
  const stepById = new Map(document.steps.map((step) => [step.id, step] as const));
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
  const rows = graph.nodes.flatMap<ProcedureRowModel>((node, index) => {
    const step = stepById.get(node.id);
    if (!step) return [];

    return [
      {
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
      },
    ];
  });

  return {
    actorColumns,
    rows,
    graph,
  };
}

export function routeProcedureEdges(
  model: ProcedureModel,
  geometry: ProcedureGeometry,
  overrides: ProcedureRoutingOverrides = {},
): ProcedureRoutedEdge[] {
  const first = routeProcedureEdgesPass(
    model,
    geometry,
    overrides,
    model.graph.edges,
  );
  const plannedOrder = sortProcedureEdges(model, geometry);
  const second = routeProcedureEdgesPass(
    model,
    geometry,
    overrides,
    plannedOrder,
  );

  return scoreProcedurePlan(second) < scoreProcedurePlan(first)
    ? second
    : first;
}

function routeProcedureEdgesPass(
  model: ProcedureModel,
  geometry: ProcedureGeometry,
  overrides: ProcedureRoutingOverrides,
  edgeOrder: readonly WorkflowEdge[],
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
  const occupied: RouteSegment[] = [];
  const parallelCounts = new Map<string, number>();

  const routed = edgeOrder.flatMap<ProcedureRoutedEdge>((edge) => {
    const sourceOrder = orderByStepId.get(edge.from);
    const targetOrder = orderByStepId.get(edge.to);
    if (sourceOrder === undefined || targetOrder === undefined) return [];

    const fromResolution = resolveAnchor(
      model,
      geometry,
      edge.from,
      sourceOrder,
    );
    const toResolution = resolveAnchor(model, geometry, edge.to, targetOrder);
    const isBack = targetOrder <= sourceOrder;
    const from = resolveProcedurePort(
      geometry,
      edge.from,
      fromResolution.point,
      edge.from === edge.to ? "right" : isBack ? "right" : "bottom",
    );
    const to = resolveProcedurePort(
      geometry,
      edge.to,
      toResolution.point,
      edge.from === edge.to ? "right" : isBack ? "right" : "top",
    );
    const routingGeometry: ProcedureGeometry = {
      ...geometry,
      obstacles: getProcedureObstacles(geometry, edge.from, edge.to),
    };

    const currentBackIndex = isBack ? backIndex++ : -1;
    const pairKey = `${edge.from}:${edge.to}`;
    const parallelIndex = parallelCounts.get(pairKey) ?? 0;
    parallelCounts.set(pairKey, parallelIndex + 1);
    const parallelOffset =
      parallelIndex === 0 ? 0 : parallelIndex % 2 === 1 ? -18 : 18;
    const autoTrunkX = isBack
      ? geometry.actorRight - 10 - currentBackIndex * 10
      : from.x + (to.x - from.x) / 2 + parallelOffset;

    const configuredRoute = routes[edge.id];
    const manualRoute = isFiniteManualRoute(configuredRoute)
      ? configuredRoute
      : undefined;
    const hasInvalidManualRoute =
      configuredRoute !== undefined &&
      (!manualRoute ||
        !manualRouteMetadataValid(manualRoute, from, to, geometry) ||
        (manualRoute.kind === "trunk" &&
          !isTrunkWithinProcedureGeometry(manualRoute.x, geometry)) ||
        (manualRoute.kind === "orthogonal" &&
          (!isOrthogonalManualSequence(from, to, manualRoute.bendPoints) ||
            !manualRoute.bendPoints.every((point) =>
              isPointWithinProcedureGeometry(point, geometry),
            ))));
    const legacyTrunkX = legacyTrunks[edge.id];
    const effectiveTrunkX =
      manualRoute?.kind === "trunk"
        ? manualRoute.x
        : (legacyTrunkX ?? autoTrunkX);
    const manualPoints =
      manualRoute?.kind === "orthogonal" &&
      isOrthogonalManualSequence(from, to, manualRoute.bendPoints) &&
      manualRoute.bendPoints.every((point) =>
        isPointWithinProcedureGeometry(point, geometry),
      )
        ? buildManualPath(from, to, manualRoute.bendPoints, geometry)
        : undefined;
    const automaticPoints =
      edge.from === edge.to
        ? buildSelfLoopPath(
            from,
            clampTrunkX(effectiveTrunkX, geometry),
            geometry,
          )
        : buildTrunkPath(from, to, clampTrunkX(effectiveTrunkX, geometry));
    const manualIsSafe =
      manualPoints !== undefined &&
      (edge.from !== edge.to || manualPoints.length > 2) &&
      isSafeProcedurePath(
        manualPoints,
        routingGeometry,
        occupied,
        edge.from === edge.to,
      );
    const automaticIsSafe = isSafeProcedurePath(
      automaticPoints,
      routingGeometry,
      occupied,
      edge.from === edge.to,
    );
    const points = manualIsSafe
      ? manualPoints
      : automaticIsSafe
        ? automaticPoints
        : pickProcedureFallbackPath(
            from,
            to,
            effectiveTrunkX,
            routingGeometry,
            occupied,
            edge.from === edge.to,
          );
    const routeKind: DiagramRouteKind = manualIsSafe
      ? "manual"
      : automaticIsSafe && !hasInvalidManualRoute
        ? "automatic"
        : "fallback";
    const routeDiagnostics: DiagramDiagnostic[] = [];
    if (fromResolution.usedFallback || toResolution.usedFallback) {
      routeDiagnostics.push({
        code: "MISSING_ANCHOR",
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
      });
    }
    if (
      hasUnassignedActor(model, edge.from) ||
      hasUnassignedActor(model, edge.to)
    ) {
      routeDiagnostics.push({
        code: "UNASSIGNED_ACTOR",
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
      });
    }
    if (
      hasInvalidManualRoute ||
      (manualPoints !== undefined && !manualIsSafe)
    ) {
      routeDiagnostics.push({
        code: "INVALID_MANUAL_ROUTE",
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
      });
    }
    if (!automaticIsSafe && !manualIsSafe) {
      routeDiagnostics.push({
        code: "ROUTE_FALLBACK_USED",
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
      });
    }
    const quality = measureRouteQuality(
      points,
      routingGeometry.obstacles ?? [],
      occupied,
    );
    if (quality.obstacleHits > 0) {
      routeDiagnostics.push({
        code: "PATH_INTERSECTS_NODE",
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
      });
    }
    if (quality.overlaps > 0) {
      routeDiagnostics.push({
        code: "PATH_OVERLAPS_EDGE",
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
      });
    }
    if (quality.crossings > 0) {
      routeDiagnostics.push({
        code: "PATH_CROSSES_EDGE",
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
      });
    }
    occupied.push(...pathToSegments(points));
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
        routeKind,
        sourceSide: getProcedureSide(
          points[0],
          geometry.nodes?.get(edge.from)?.rect,
          edge.from === edge.to ? "right" : isBack ? "right" : "bottom",
        ),
        targetSide: getProcedureSide(
          points.at(-1),
          geometry.nodes?.get(edge.to)?.rect,
          edge.from === edge.to ? "right" : isBack ? "right" : "top",
        ),
        quality,
        ...(routeDiagnostics.length > 0 ? { routeDiagnostics } : {}),
      },
    ];
  });

  return model.graph.edges.flatMap((edge) =>
    routed.filter((routedEdge) => routedEdge.id === edge.id),
  );
}

function sortProcedureEdges(
  model: ProcedureModel,
  geometry: ProcedureGeometry,
): readonly WorkflowEdge[] {
  const orderByStepId = new Map(
    model.rows.map((row, index) => [row.stepId, index] as const),
  );

  return [...model.graph.edges].sort((first, second) => {
    const firstFrom = orderByStepId.get(first.from) ?? 0;
    const firstTo = orderByStepId.get(first.to) ?? 0;
    const secondFrom = orderByStepId.get(second.from) ?? 0;
    const secondTo = orderByStepId.get(second.to) ?? 0;
    const firstFeedback = firstTo <= firstFrom ? 0 : 1;
    const secondFeedback = secondTo <= secondFrom ? 0 : 1;
    if (firstFeedback !== secondFeedback) return firstFeedback - secondFeedback;
    const firstSpan = Math.abs(firstTo - firstFrom);
    const secondSpan = Math.abs(secondTo - secondFrom);
    if (firstSpan !== secondSpan) return secondSpan - firstSpan;
    const branchPriority = (kind: WorkflowEdge["kind"]) =>
      kind === "yes" ? 0 : kind === "no" ? 1 : 2;
    const branchDifference =
      branchPriority(first.kind) - branchPriority(second.kind);
    if (branchDifference !== 0) return branchDifference;
    const firstLane =
      geometry.actorLanes?.get(
        model.rows.find((row) => row.stepId === first.from)?.primaryActorId ??
          null,
      )?.left ?? 0;
    const secondLane =
      geometry.actorLanes?.get(
        model.rows.find((row) => row.stepId === second.from)?.primaryActorId ??
          null,
      )?.left ?? 0;
    return firstLane - secondLane || first.id.localeCompare(second.id);
  });
}

function scoreProcedurePlan(edges: readonly ProcedureRoutedEdge[]): number {
  return edges.reduce((score, edge) => {
    if (edge.points.length < 2) return score + 1_000_000_000;
    const quality = edge.quality;
    if (!quality) return score + 500_000;
    return (
      score +
      quality.obstacleHits * 100_000 +
      quality.overlaps * 25_000 +
      quality.crossings * 10_000 +
      quality.bends * 120 +
      quality.length +
      (edge.routeKind === "fallback" ? 50_000 : 0)
    );
  }, 0);
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
              ...(route.labelPosition
                ? { labelPosition: { ...route.labelPosition } }
                : {}),
              ...(route.sSide ? { sSide: route.sSide } : {}),
              ...(route.eSide ? { eSide: route.eSide } : {}),
              ...(route.startPoint
                ? { startPoint: { ...route.startPoint } }
                : {}),
              ...(route.endPoint ? { endPoint: { ...route.endPoint } } : {}),
            }
          : {
              kind: "orthogonal",
              bendPoints: route.bendPoints.map((point) => ({ ...point })),
              ...(route.labelPosition
                ? { labelPosition: { ...route.labelPosition } }
                : {}),
              ...(route.sSide ? { sSide: route.sSide } : {}),
              ...(route.eSide ? { eSide: route.eSide } : {}),
              ...(route.startPoint
                ? { startPoint: { ...route.startPoint } }
                : {}),
              ...(route.endPoint ? { endPoint: { ...route.endPoint } } : {}),
            },
    },
  };
}

export function pruneProcedureManualRoutes(
  config: SopDiagramConfig,
  validEdgeIds: ReadonlySet<string>,
): SopDiagramConfig {
  if (!config.routes) return config;

  const routes = Object.fromEntries(
    Object.entries(config.routes).filter(([edgeId]) =>
      validEdgeIds.has(edgeId),
    ),
  );
  if (Object.keys(routes).length === Object.keys(config.routes).length) {
    return config;
  }

  const { routes: _removedRoutes, ...rest } = config;
  return Object.keys(routes).length > 0 ? { ...rest, routes } : rest;
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

function isFiniteManualRoute(
  route: ProcedureManualRoute | undefined,
): route is ProcedureManualRoute {
  if (!route) return false;

  if (route.kind === "trunk") {
    return Number.isFinite(route.x) && isManualRouteMetadataFinite(route);
  }

  return (
    route.kind === "orthogonal" &&
    Array.isArray(route.bendPoints) &&
    route.bendPoints.length > 0 &&
    route.bendPoints.every(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
    ) &&
    isManualRouteMetadataFinite(route)
  );
}

function isManualRouteMetadataFinite(route: ProcedureManualRoute): boolean {
  const validSide = (side: DiagramSide | undefined) =>
    side === undefined ||
    side === "top" ||
    side === "right" ||
    side === "bottom" ||
    side === "left";
  const validPoint = (point: DiagramPoint | undefined) =>
    point === undefined ||
    (Number.isFinite(point.x) && Number.isFinite(point.y));

  return (
    validSide(route.sSide) &&
    validSide(route.eSide) &&
    validPoint(route.startPoint) &&
    validPoint(route.endPoint)
  );
}

function manualRouteMetadataValid(
  route: ProcedureManualRoute,
  from: DiagramPoint,
  to: DiagramPoint,
  geometry: ProcedureGeometry,
): boolean {
  if (!isManualRouteMetadataFinite(route)) return false;
  if (
    route.startPoint &&
    (route.startPoint.x !== from.x || route.startPoint.y !== from.y)
  ) {
    return false;
  }
  if (
    route.endPoint &&
    (route.endPoint.x !== to.x || route.endPoint.y !== to.y)
  ) {
    return false;
  }
  return [route.startPoint, route.endPoint]
    .filter((point): point is DiagramPoint => point !== undefined)
    .every((point) => isPointWithinProcedureGeometry(point, geometry));
}

function isOrthogonalManualSequence(
  from: DiagramPoint,
  to: DiagramPoint,
  bendPoints: readonly DiagramPoint[],
): boolean {
  const points = [from, ...bendPoints, to];
  return points.every((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return (
      previous !== undefined &&
      (previous.x === point.x || previous.y === point.y)
    );
  });
}

function isPointWithinProcedureGeometry(
  point: DiagramPoint,
  geometry: ProcedureGeometry,
): boolean {
  const bounds = geometry.routingBounds;
  if (bounds) {
    return pathWithinBounds([point], bounds);
  }

  return (
    point.x >= geometry.actorLeft &&
    point.x <= geometry.actorRight &&
    point.y >= 0 &&
    point.y <= geometry.height
  );
}

function isTrunkWithinProcedureGeometry(
  trunkX: number,
  geometry: ProcedureGeometry,
): boolean {
  if (!Number.isFinite(trunkX)) return false;
  const bounds = geometry.routingBounds;
  if (bounds) {
    return trunkX >= bounds.left && trunkX <= bounds.left + bounds.width;
  }

  return trunkX >= geometry.actorLeft && trunkX <= geometry.actorRight;
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

function resolveAnchor(
  model: ProcedureModel,
  geometry: ProcedureGeometry,
  stepId: StepId,
  order: number,
): { point: DiagramPoint; usedFallback: boolean } {
  const measured = geometry.anchors.get(stepId);
  if (measured) return { point: measured, usedFallback: false };

  const row = model.rows.find((candidate) => candidate.stepId === stepId);
  const lane = geometry.actorLanes?.get(row?.primaryActorId ?? null);
  const actorLeft = lane?.left ?? geometry.actorLeft;
  const actorRight = lane?.right ?? geometry.actorRight;
  const laneWidth = Math.max(0, actorRight - actorLeft);
  const rowHeight = geometry.height / Math.max(1, model.rows.length + 1);

  return {
    point: {
      x: actorLeft + laneWidth / 2,
      y: rowHeight * (order + 1),
    },
    usedFallback: true,
  };
}

function resolveProcedurePort(
  geometry: ProcedureGeometry,
  stepId: StepId,
  fallback: DiagramPoint,
  side: DiagramSide,
): DiagramPoint {
  const rect = geometry.nodes?.get(stepId)?.rect;
  if (!rect) return fallback;

  switch (side) {
    case "top":
      return { x: rect.left + rect.width / 2, y: rect.top };
    case "right":
      return { x: rect.left + rect.width, y: rect.top + rect.height / 2 };
    case "bottom":
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height,
      };
    case "left":
      return { x: rect.left, y: rect.top + rect.height / 2 };
  }
}

function getProcedureSide(
  point: DiagramPoint | undefined,
  rect: DiagramRect | undefined,
  fallback: DiagramSide,
): DiagramSide {
  if (!point || !rect) return fallback;

  const distances: Array<[DiagramSide, number]> = [
    ["top", Math.abs(point.y - rect.top)],
    ["right", Math.abs(point.x - (rect.left + rect.width))],
    ["bottom", Math.abs(point.y - (rect.top + rect.height))],
    ["left", Math.abs(point.x - rect.left)],
  ];
  distances.sort((first, second) => first[1] - second[1]);
  return distances[0]?.[0] ?? fallback;
}

function buildSelfLoopPath(
  point: DiagramPoint,
  trunkX: number,
  geometry: ProcedureGeometry,
): DiagramPoint[] {
  const loopWidth = Math.min(
    32,
    Math.max(16, (geometry.actorRight - geometry.actorLeft) / 8),
  );
  const outerX = Math.max(geometry.actorLeft + 8, trunkX - loopWidth);
  const loopHeight = Math.min(24, Math.max(12, geometry.height / 20));
  const topY = Math.max(0, point.y - loopHeight);
  const bottomY = Math.min(geometry.height, point.y + loopHeight);

  return compactOrthogonalPoints([
    point,
    { x: trunkX, y: point.y },
    { x: trunkX, y: topY },
    { x: outerX, y: topY },
    { x: outerX, y: bottomY },
    { x: trunkX, y: bottomY },
    { x: trunkX, y: point.y },
    point,
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

function getProcedureObstacles(
  geometry: ProcedureGeometry,
  fromId: StepId,
  toId: StepId,
): readonly DiagramRect[] {
  if (!geometry.nodes) return geometry.obstacles ?? [];

  return [...geometry.nodes.values()]
    .filter((node) => node.stepId !== fromId && node.stepId !== toId)
    .map((node) => node.rect);
}

function hasUnassignedActor(model: ProcedureModel, stepId: StepId): boolean {
  return (
    model.rows.find((row) => row.stepId === stepId)?.primaryActorId === null
  );
}

function isSafeProcedurePath(
  points: readonly DiagramPoint[],
  geometry: ProcedureGeometry,
  occupied: readonly RouteSegment[],
  selfLoop: boolean,
): boolean {
  if (
    points.length < 2 ||
    !points.every(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
    )
  ) {
    return false;
  }
  if (
    selfLoop &&
    new Set(points.map((point) => `${point.x}:${point.y}`)).size < 3
  ) {
    return false;
  }
  const bounds = geometry.routingBounds ?? {
    left: geometry.actorLeft,
    top: 0,
    width: Math.max(0, geometry.actorRight - geometry.actorLeft),
    height: Math.max(0, geometry.height),
  };
  if (!pathWithinBounds(points, bounds)) return false;
  if (pathIntersectsRectangles(points, geometry.obstacles ?? [], 2))
    return false;
  return !pathOverlapsSegments(points, occupied, {
    includeCross: true,
    ignoreTerminalSegments: true,
  });
}

function pickProcedureFallbackPath(
  from: DiagramPoint,
  to: DiagramPoint,
  trunkX: number,
  geometry: ProcedureGeometry,
  occupied: readonly RouteSegment[],
  selfLoop: boolean,
): DiagramPoint[] {
  const candidates = selfLoop
    ? [
        buildSelfLoopPath(from, clampTrunkX(trunkX + 18, geometry), geometry),
        buildSelfLoopPath(from, clampTrunkX(trunkX - 18, geometry), geometry),
      ]
    : [
        buildTrunkPath(from, to, clampTrunkX(trunkX + 18, geometry)),
        buildTrunkPath(from, to, clampTrunkX(trunkX - 18, geometry)),
        buildTrunkPath(from, to, clampTrunkX(geometry.actorLeft + 8, geometry)),
      ];

  const safe = candidates.filter((candidate) =>
    isSafeProcedurePath(candidate, geometry, occupied, selfLoop),
  );
  if (safe.length > 0) {
    return safe.reduce((best, candidate) =>
      scorePath(candidate, occupied) < scorePath(best, occupied)
        ? candidate
        : best,
    );
  }

  return compactOrthogonalPoints(candidates[0] ?? [from, to]);
}
