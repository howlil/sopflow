import type { StepId } from "@sopflow/core";
import type {
  DiagramDiagnostic,
  DiagramPoint,
  DiagramRouteQuality,
} from "../../types.js";
import { measureRouteQuality } from "../../routeGeometry.js";
import {
  channelAnchorDistance,
  clampAnchorDistance,
  pointOnRectSide,
} from "../../routeAnchors.js";
import type { WorkflowEdge } from "../../workflow.js";
import {
  assignFormalColumnTrunkSlots,
  assignFormalCrossColumnSlots,
  assignFormalLoopbackSlots,
  tryBuildFormalDedicatedRoute,
  type FormalRouteMeta,
} from "./dedicated.js";
import {
  computeFormalConnectionRoutingBounds,
  pointOnFormalDecisionVertex,
  resolveFormalColumnForConnection,
} from "./geometry.js";
import {
  formalPathToSegments,
  normalizeFormalOrthogonalPath,
  routeFormalOrthogonal,
  scoreFormalPath,
} from "./orthogonal.js";
import { placeFormalEdgeLabel } from "./labels.js";
import {
  findFormalRouteCrossingIds,
  sortFormalRoutesForPlanning,
} from "./order.js";
import {
  selectFormalFlowchartSidePairs,
  type FormalFlowchartConnectionMeta,
  type FormalFlowchartUsedSides,
} from "./selectSidePairs.js";
import type {
  FormalFlowchartBounds,
  FormalFlowchartGeometry,
  FormalFlowchartRect,
  FormalFlowchartRouteResult,
  FormalFlowchartSide,
} from "./types.js";

export interface FormalProcedureRowLike {
  readonly stepId: StepId;
  readonly number: number;
  readonly kind: "start" | "task" | "decision" | "end" | "opc";
  readonly primaryActorId: string | null;
}

export interface FormalProcedureModelLike {
  readonly rows: readonly FormalProcedureRowLike[];
  readonly edges: readonly WorkflowEdge[];
}

export type FormalManualRoute =
  | {
      readonly kind: "trunk";
      readonly x: number;
      readonly labelPosition?: DiagramPoint;
      readonly sSide?: FormalFlowchartSide;
      readonly eSide?: FormalFlowchartSide;
      readonly sourceDistance?: number;
      readonly targetDistance?: number;
      readonly startPoint?: DiagramPoint;
      readonly endPoint?: DiagramPoint;
    }
  | {
      readonly kind: "orthogonal";
      readonly bendPoints: readonly DiagramPoint[];
      readonly labelPosition?: DiagramPoint;
      readonly sSide?: FormalFlowchartSide;
      readonly eSide?: FormalFlowchartSide;
      readonly sourceDistance?: number;
      readonly targetDistance?: number;
      readonly startPoint?: DiagramPoint;
      readonly endPoint?: DiagramPoint;
    };

export interface FormalPlannedEdge extends WorkflowEdge {
  readonly points: readonly DiagramPoint[];
  readonly sourceSide: FormalFlowchartSide;
  readonly targetSide: FormalFlowchartSide;
  readonly labelPosition?: DiagramPoint;
  readonly handlePosition: DiagramPoint;
  readonly trunkX: number;
  readonly quality: DiagramRouteQuality;
  readonly routeDiagnostics?: readonly DiagramDiagnostic[];
}

export interface FormalFlowchartPlanOptions {
  readonly pathLayoutSeed?: number;
  readonly maxReconcilePasses?: number;
}

export function planFormalProcedureEdges(
  model: FormalProcedureModelLike,
  geometry: FormalFlowchartGeometry,
  manualRoutes: Readonly<Record<string, FormalManualRoute>> = {},
  options: FormalFlowchartPlanOptions = {},
): FormalPlannedEdge[] {
  const rowById = new Map(model.rows.map((row) => [row.stepId, row] as const));
  const edgeById = new Map(model.edges.map((edge) => [edge.id, edge] as const));
  const routeMetas = model.edges.flatMap<FormalRouteMeta>((edge) => {
    const source = rowById.get(edge.from);
    const target = rowById.get(edge.to);
    if (!source || !target) return [];

    return [
      {
        id: edge.id,
        fromRow: source.number - 1,
        toRow: target.number - 1,
        fromActorId: source.primaryActorId,
        toActorId: target.primaryActorId,
        sourceType: shapeType(source.kind),
        targetType: shapeType(target.kind),
        ...(edge.label ? { label: edge.label } : {}),
      },
    ];
  });

  const loopbackSlots = assignFormalLoopbackSlots(routeMetas);
  const crossColumnSlots = assignFormalCrossColumnSlots(routeMetas);
  const columnTrunkSlots = assignFormalColumnTrunkSlots(routeMetas);
  const pathLayoutSeed = options.pathLayoutSeed ?? 0;
  const maxReconcilePasses = Math.max(1, options.maxReconcilePasses ?? 4);

  let priorityIds = new Set<string>();
  let bestPlan: Map<string, FormalPlannedEdge> | null = null;
  let bestSegments = new Map<string, ReturnType<typeof formalPathToSegments>>();
  let bestScore = Number.POSITIVE_INFINITY;

  for (let pass = 0; pass < maxReconcilePasses; pass += 1) {
    const orderedMetas = prioritizeLockedFormalRoutes(
      sortFormalRoutesForPlanning(routeMetas, pathLayoutSeed, {
        priorityIds,
        reconcilePass: pass,
        priorityRoutesLast: true,
      }),
      manualRoutes,
    );
    const occupied: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }> = [];
    const usedSides: MutableUsedSides = {};
    const segmentsByConnection = new Map<
      string,
      ReturnType<typeof formalPathToSegments>
    >();
    const planned = new Map<string, FormalPlannedEdge>();

    for (const meta of orderedMetas) {
      const edge = edgeById.get(meta.id);
      if (!edge) continue;

      const sourceGeometry = geometry.shapes.get(edge.from);
      const targetGeometry = geometry.shapes.get(edge.to);
      if (!sourceGeometry || !targetGeometry) continue;

      const source = sourceGeometry.rect;
      const target = targetGeometry.rect;
      const obstacles = [...geometry.shapes.values()]
        .filter(
          (shape) => shape.stepId !== edge.from && shape.stepId !== edge.to,
        )
        .map((shape) => shape.rect);

      const sourceColumn = resolveFormalColumnForConnection(
        meta.fromActorId,
        source,
        geometry.columns,
        geometry.pelaksanaBounds,
      );
      const targetColumn = resolveFormalColumnForConnection(
        meta.toActorId,
        target,
        geometry.columns,
        geometry.pelaksanaBounds,
      );
      const crossColumn =
        meta.fromActorId !== null &&
        meta.toActorId !== null &&
        meta.fromActorId !== meta.toActorId;
      const routingBounds = computeFormalConnectionRoutingBounds({
        pelaksana: geometry.pelaksanaBounds,
        sourceColumn,
        targetColumn,
        isCrossColumn: crossColumn,
      });
      const connectionMeta: FormalFlowchartConnectionMeta = {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        ...(edge.label ? { label: edge.label } : {}),
        sourceType: meta.sourceType,
        targetType: meta.targetType,
      };
      const routeCandidates = selectFormalFlowchartSidePairs(
        connectionMeta,
        source,
        target,
        usedSides as FormalFlowchartUsedSides,
      );

      const manual = manualRoutes[edge.id];
      const auto = resolveAutoRoute({
        edge,
        meta,
        source,
        target,
        sourceColumn,
        targetColumn,
        routingBounds,
        geometry,
        obstacles,
        occupied,
        routeCandidates,
        usedSides,
        loopbackSlot: loopbackSlots.get(edge.id) ?? 0,
        crossColumnSlot: crossColumnSlots.get(edge.id) ?? 0,
        columnTrunkSlot: columnTrunkSlots.get(edge.id) ?? 0,
      });
      const resolved = applyManualRoute(
        auto,
        manual,
        source,
        target,
        sourceGeometry.kind === "decision",
        targetGeometry.kind === "decision",
        routingBounds,
      );

      registerSide(usedSides, edge.from, "out", resolved.sourceSide, edge.id);
      registerSide(usedSides, edge.to, "in", resolved.targetSide, edge.id);

      const segments = formalPathToSegments(resolved.points);
      segmentsByConnection.set(edge.id, segments);
      occupied.push(...segments);

      const labelPosition =
        manual?.labelPosition ??
        placeFormalEdgeLabel({
          path: resolved.points,
          ...(edge.label ? { label: edge.label } : {}),
          obstacles,
        });
      const handlePosition = routeHandlePosition(resolved.points);

      planned.set(edge.id, {
        ...edge,
        points: resolved.points,
        sourceSide: resolved.sourceSide,
        targetSide: resolved.targetSide,
        handlePosition,
        trunkX: handlePosition.x,
        quality: {
          length: 0,
          bends: 0,
          obstacleHits: 0,
          overlaps: 0,
          crossings: 0,
        },
        ...(labelPosition ? { labelPosition } : {}),
      });
    }

    const passScore = scoreFormalPlan(planned, segmentsByConnection, geometry);
    if (passScore < bestScore) {
      bestScore = passScore;
      bestPlan = planned;
      bestSegments = segmentsByConnection;
    }

    const violators = findFormalRouteCrossingIds(segmentsByConnection);
    if (violators.length === 0) break;
    priorityIds = new Set(violators);
  }

  const selected = bestPlan ?? new Map<string, FormalPlannedEdge>();

  return model.edges.flatMap((edge) => {
    const routed = selected.get(edge.id);
    if (!routed) return [];

    const quality = measureFormalEdgeQuality(routed, geometry, bestSegments);
    const routeDiagnostics = formalRouteDiagnostics(
      routed,
      quality,
      manualRoutes[edge.id] !== undefined,
    );

    return [
      {
        ...routed,
        quality,
        ...(routeDiagnostics.length > 0 ? { routeDiagnostics } : {}),
      },
    ];
  });
}

function scoreFormalPlan(
  planned: ReadonlyMap<string, FormalPlannedEdge>,
  segmentsByConnection: ReadonlyMap<
    string,
    ReturnType<typeof formalPathToSegments>
  >,
  geometry: FormalFlowchartGeometry,
): number {
  let score = 0;

  for (const edge of planned.values()) {
    const quality = measureFormalEdgeQuality(
      edge,
      geometry,
      segmentsByConnection,
    );
    score +=
      quality.obstacleHits * 100_000 +
      quality.overlaps * 25_000 +
      quality.crossings * 10_000 +
      quality.bends * 120 +
      quality.length;
  }

  return score;
}

function measureFormalEdgeQuality(
  edge: FormalPlannedEdge,
  geometry: FormalFlowchartGeometry,
  segmentsByConnection: ReadonlyMap<
    string,
    ReturnType<typeof formalPathToSegments>
  >,
): DiagramRouteQuality {
  const obstacles = [...geometry.shapes.values()]
    .filter((shape) => shape.stepId !== edge.from && shape.stepId !== edge.to)
    .map((shape) => shape.rect);
  const occupied = [...segmentsByConnection.entries()]
    .filter(([connectionId]) => connectionId !== edge.id)
    .flatMap(([, segments]) => [...segments]);

  return measureRouteQuality(edge.points, obstacles, occupied);
}

function formalRouteDiagnostics(
  edge: FormalPlannedEdge,
  quality: DiagramRouteQuality,
  manual: boolean,
): DiagramDiagnostic[] {
  const diagnostics: DiagramDiagnostic[] = [];

  if (quality.obstacleHits > 0) {
    diagnostics.push({
      code: "PATH_INTERSECTS_NODE",
      edgeId: edge.id,
      from: edge.from,
      to: edge.to,
    });
  }
  if (quality.overlaps > 0) {
    diagnostics.push({
      code: "PATH_OVERLAPS_EDGE",
      edgeId: edge.id,
      from: edge.from,
      to: edge.to,
    });
  }
  if (quality.crossings > 0) {
    diagnostics.push({
      code: "PATH_CROSSES_EDGE",
      edgeId: edge.id,
      from: edge.from,
      to: edge.to,
    });
  }
  if (
    manual &&
    (quality.obstacleHits > 0 || quality.overlaps > 0 || quality.crossings > 0)
  ) {
    diagnostics.push({
      code: "INVALID_MANUAL_ROUTE",
      edgeId: edge.id,
      from: edge.from,
      to: edge.to,
    });
  }

  return diagnostics;
}

function prioritizeLockedFormalRoutes(
  metas: readonly FormalRouteMeta[],
  manualRoutes: Readonly<Record<string, FormalManualRoute>>,
): FormalRouteMeta[] {
  const locked: FormalRouteMeta[] = [];
  const automatic: FormalRouteMeta[] = [];

  for (const meta of metas) {
    if (manualRoutes[meta.id]) locked.push(meta);
    else automatic.push(meta);
  }

  return [...locked, ...automatic];
}

function resolveAutoRoute(input: {
  readonly edge: WorkflowEdge;
  readonly meta: FormalRouteMeta;
  readonly source: FormalFlowchartRect;
  readonly target: FormalFlowchartRect;
  readonly sourceColumn: FormalFlowchartBounds | null;
  readonly targetColumn: FormalFlowchartBounds | null;
  readonly routingBounds: FormalFlowchartBounds | null;
  readonly geometry: FormalFlowchartGeometry;
  readonly obstacles: readonly FormalFlowchartRect[];
  readonly occupied: readonly {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }[];
  readonly routeCandidates: ReturnType<typeof selectFormalFlowchartSidePairs>;
  readonly usedSides: FormalFlowchartUsedSides;
  readonly loopbackSlot: number;
  readonly crossColumnSlot: number;
  readonly columnTrunkSlot: number;
}): FormalFlowchartRouteResult {
  const MAX_TRIES = 4;
  let best: FormalFlowchartRouteResult | null = null;
  let bestScore = Infinity;

  const boundsRect = input.routingBounds
    ? {
        left: input.routingBounds.left,
        top: input.routingBounds.top,
        width: Math.max(
          40,
          input.routingBounds.right - input.routingBounds.left,
        ),
        height: Math.max(
          40,
          input.routingBounds.bottom - input.routingBounds.top,
        ),
      }
    : null;

  const scoreCandidate = (
    result: FormalFlowchartRouteResult,
    candidateIndex: number,
  ) => {
    let score =
      scoreFormalPath(result.points, input.occupied) + candidateIndex * 120;

    const sourceCenterX = input.source.left + input.source.width / 2;
    const targetCenterX = input.target.left + input.target.width / 2;
    const sameColumn =
      Math.abs(sourceCenterX - targetCenterX) <
      Math.max(input.source.width, input.target.width) * 0.5;
    const destinationBelow = input.meta.toRow > input.meta.fromRow;
    const destinationAbove = input.meta.toRow < input.meta.fromRow;

    if (
      input.meta.sourceType === "flowchart-decision" &&
      input.edge.label === "Tidak" &&
      destinationAbove
    ) {
      const horizontalLoop =
        result.sourceSide === result.targetSide &&
        (result.sourceSide === "left" || result.sourceSide === "right");

      if (!horizontalLoop) score += 10_000;
      if (targetCenterX < sourceCenterX - 8 && result.sourceSide !== "left") {
        score += 4_000;
      }
      if (targetCenterX > sourceCenterX + 8 && result.sourceSide !== "right") {
        score += 4_000;
      }
    }

    if (
      input.meta.sourceType === "flowchart-decision" &&
      input.edge.label === "Ya" &&
      destinationBelow
    ) {
      if (result.sourceSide !== "bottom") score += 8_000;
      if (targetCenterX < sourceCenterX - 8 && result.targetSide !== "right") {
        score += 3_000;
      }
      if (targetCenterX > sourceCenterX + 8 && result.targetSide !== "left") {
        score += 3_000;
      }
    }

    if (sameColumn && destinationBelow) {
      if (result.sourceSide === "bottom" && result.targetSide === "top") {
        score -= 6_000;
      } else {
        score += 8_000;
      }
    }

    return score;
  };

  for (const [index, candidate] of input.routeCandidates
    .slice(0, MAX_TRIES)
    .entries()) {
    const sourceUsage = formalSideUsageCount(
      input.usedSides,
      input.edge.from,
      "out",
      candidate.sourceSide,
    );
    const targetUsage = formalSideUsageCount(
      input.usedSides,
      input.edge.to,
      "in",
      candidate.targetSide,
    );
    const sourceDistance = formalAutoAnchorDistance(
      input.source,
      candidate.sourceSide,
      sourceUsage,
      input.meta.sourceType === "flowchart-decision",
    );
    const targetDistance = formalAutoAnchorDistance(
      input.target,
      candidate.targetSide,
      targetUsage,
      input.meta.targetType === "flowchart-decision",
    );
    const path = routeFormalOrthogonal({
      source: {
        shape: input.source,
        side: candidate.sourceSide,
        distance: sourceDistance,
      },
      target: {
        shape: input.target,
        side: candidate.targetSide,
        distance: targetDistance,
      },
      obstacles: input.obstacles,
      shapeMargin: 10,
      bounds: boundsRect,
      occupied: input.occupied,
      sourceJetty: candidate.sourceJettySize ?? candidate.jettySize ?? 10,
      targetJetty: candidate.targetJettySize ?? candidate.jettySize ?? 10,
      lShapeOnly: true,
    });

    if (path.length < 2) continue;

    const result = {
      points: path,
      sourceSide: candidate.sourceSide,
      targetSide: candidate.targetSide,
    } satisfies FormalFlowchartRouteResult;
    const score = scoreCandidate(result, index);

    if (score < bestScore) {
      best = result;
      bestScore = score;
    }
  }

  if (!best) {
    const preferred = input.routeCandidates[0];
    const dedicated = tryBuildFormalDedicatedRoute({
      meta: input.meta,
      source: input.source,
      target: input.target,
      sourceColumn: input.sourceColumn,
      targetColumn: input.targetColumn,
      pelaksana: input.geometry.pelaksanaBounds,
      columns: input.geometry.columns,
      gridLayout: input.geometry.gridLayout,
      obstacles: input.obstacles,
      occupied: input.occupied,
      loopbackSlot: input.loopbackSlot,
      crossColumnSlot: input.crossColumnSlot,
      columnTrunkSlot: input.columnTrunkSlot,
      sourceJetty: preferred?.sourceJettySize ?? preferred?.jettySize ?? 16,
      targetJetty: preferred?.targetJettySize ?? preferred?.jettySize ?? 16,
    });

    if (dedicated) best = dedicated;
  }

  if (!best) {
    for (const [index, candidate] of input.routeCandidates
      .slice(0, MAX_TRIES)
      .entries()) {
      const sourceUsage = formalSideUsageCount(
        input.usedSides,
        input.edge.from,
        "out",
        candidate.sourceSide,
      );
      const targetUsage = formalSideUsageCount(
        input.usedSides,
        input.edge.to,
        "in",
        candidate.targetSide,
      );
      const sourceDistance = formalAutoAnchorDistance(
        input.source,
        candidate.sourceSide,
        sourceUsage,
        input.meta.sourceType === "flowchart-decision",
      );
      const targetDistance = formalAutoAnchorDistance(
        input.target,
        candidate.targetSide,
        targetUsage,
        input.meta.targetType === "flowchart-decision",
      );
      const path = routeFormalOrthogonal({
        source: {
          shape: input.source,
          side: candidate.sourceSide,
          distance: sourceDistance,
        },
        target: {
          shape: input.target,
          side: candidate.targetSide,
          distance: targetDistance,
        },
        obstacles: input.obstacles,
        shapeMargin: 10,
        bounds: boundsRect,
        occupied: input.occupied,
        sourceJetty: candidate.sourceJettySize ?? candidate.jettySize ?? 10,
        targetJetty: candidate.targetJettySize ?? candidate.jettySize ?? 10,
      });

      if (path.length < 2) continue;

      const result = {
        points: path,
        sourceSide: candidate.sourceSide,
        targetSide: candidate.targetSide,
      } satisfies FormalFlowchartRouteResult;
      const score = scoreCandidate(result, index);

      if (score < bestScore) {
        best = result;
        bestScore = score;
      }
    }
  }

  return (
    best ?? {
      points: fallbackPath(input.source, input.target),
      sourceSide: "bottom",
      targetSide: "top",
    }
  );
}

function formalSideUsageCount(
  usedSides: FormalFlowchartUsedSides,
  shapeId: string,
  direction: "in" | "out",
  side: FormalFlowchartSide,
): number {
  return usedSides[shapeId]?.[direction]?.[side]?.length ?? 0;
}

function formalAutoAnchorDistance(
  rect: FormalFlowchartRect,
  side: FormalFlowchartSide,
  usageIndex: number,
  decision: boolean,
): number {
  if (decision) return 0.5;
  const sideLength =
    side === "top" || side === "bottom" ? rect.width : rect.height;
  return channelAnchorDistance(usageIndex, sideLength);
}

function applyManualRoute(
  auto: FormalFlowchartRouteResult,
  manual: FormalManualRoute | undefined,
  source: FormalFlowchartRect,
  target: FormalFlowchartRect,
  sourceDecision: boolean,
  targetDecision: boolean,
  bounds: FormalFlowchartBounds | null,
): FormalFlowchartRouteResult {
  if (!manual) return auto;

  const autoStart = auto.points[0];
  const autoEnd = auto.points.at(-1);
  if (!autoStart || !autoEnd) return auto;

  const sourceSide = manual.sSide ?? auto.sourceSide;
  const targetSide = manual.eSide ?? auto.targetSide;
  const start = resolveManualAnchorPoint(
    manual.startPoint,
    manual.sourceDistance,
    sourceSide,
    source,
    sourceDecision,
    autoStart,
  );
  const end = resolveManualAnchorPoint(
    manual.endPoint,
    manual.targetDistance,
    targetSide,
    target,
    targetDecision,
    autoEnd,
  );

  if (manual.kind === "orthogonal") {
    return {
      points: normalizeFormalOrthogonalPath(
        [start, ...manual.bendPoints, end],
        null,
        { preserveCollinear: true },
      ),
      sourceSide,
      targetSide,
    };
  }

  const x = clampX(manual.x, bounds);

  return {
    points: normalizeFormalOrthogonalPath([
      start,
      { x, y: start.y },
      { x, y: end.y },
      end,
    ]),
    sourceSide,
    targetSide,
  };
}

function resolveManualAnchorPoint(
  configured: DiagramPoint | undefined,
  distance: number | undefined,
  side: FormalFlowchartSide,
  shape: FormalFlowchartRect,
  decision: boolean,
  fallback: DiagramPoint,
): DiagramPoint {
  if (Number.isFinite(distance)) {
    if (decision) return pointOnFormalDecisionVertex(shape, side);

    const point = pointOnRectSide(
      shape,
      side,
      clampAnchorDistance(distance as number),
    );
    return { x: Math.round(point.x), y: Math.round(point.y) };
  }

  if (
    configured &&
    Number.isFinite(configured.x) &&
    Number.isFinite(configured.y)
  ) {
    // Backward-compatible replay for pre-semantic-anchor configs.
    return { x: Math.round(configured.x), y: Math.round(configured.y) };
  }

  return { ...fallback };
}

function routeHandlePosition(path: readonly DiagramPoint[]): DiagramPoint {
  let best: { point: DiagramPoint; length: number } | null = null;

  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    if (!from || !to || from.x !== to.x || from.y === to.y) continue;

    const length = Math.abs(to.y - from.y);
    if (best && best.length >= length) continue;

    best = {
      length,
      point: {
        x: from.x,
        y: Math.round((from.y + to.y) / 2),
      },
    };
  }

  const first = path[0] ?? { x: 0, y: 0 };
  const last = path.at(-1) ?? first;

  return (
    best?.point ?? {
      x: Math.round((first.x + last.x) / 2),
      y: Math.round((first.y + last.y) / 2),
    }
  );
}

function fallbackPath(
  source: FormalFlowchartRect,
  target: FormalFlowchartRect,
): DiagramPoint[] {
  const start = {
    x: Math.round(source.left + source.width / 2),
    y: Math.round(source.top + source.height),
  };
  const end = {
    x: Math.round(target.left + target.width / 2),
    y: Math.round(target.top),
  };

  if (start.x === end.x) return [start, end];

  const midX = Math.round((start.x + end.x) / 2);
  return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
}

function clampX(value: number, bounds: FormalFlowchartBounds | null): number {
  if (!bounds) return Math.round(value);
  return Math.round(
    Math.max(bounds.left + 8, Math.min(bounds.right - 8, value)),
  );
}

function shapeType(
  kind: "start" | "task" | "decision" | "end" | "opc",
):
  | "flowchart-terminator"
  | "flowchart-process"
  | "flowchart-decision"
  | "flowchart-opc" {
  if (kind === "start" || kind === "end") return "flowchart-terminator";
  if (kind === "decision") return "flowchart-decision";
  if (kind === "opc") return "flowchart-opc";
  return "flowchart-process";
}

type MutableUsedSides = Record<
  string,
  {
    in?: Partial<Record<FormalFlowchartSide, string[]>>;
    out?: Partial<Record<FormalFlowchartSide, string[]>>;
  }
>;

function registerSide(
  used: MutableUsedSides,
  shapeId: string,
  direction: "in" | "out",
  side: FormalFlowchartSide,
  connectionId: string,
) {
  const shape = used[shapeId] ?? {};
  const directionMap = shape[direction] ?? {};
  const ids = directionMap[side] ?? [];

  used[shapeId] = {
    ...shape,
    [direction]: {
      ...directionMap,
      [side]: [...ids, connectionId],
    },
  };
}
