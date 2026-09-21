import type { StepId } from "@sopflow/core";
import type { DiagramPoint } from "../../types.js";
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
  resolveFormalColumnForConnection,
} from "./geometry.js";
import {
  formalPathToSegments,
  normalizeFormalOrthogonalPath,
  routeFormalOrthogonal,
  scoreFormalPath,
} from "./orthogonal.js";
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
  readonly kind: "start" | "task" | "decision" | "end";
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
    }
  | {
      readonly kind: "orthogonal";
      readonly bendPoints: readonly DiagramPoint[];
      readonly labelPosition?: DiagramPoint;
    };

export interface FormalPlannedEdge extends WorkflowEdge {
  readonly points: readonly DiagramPoint[];
  readonly sourceSide: FormalFlowchartSide;
  readonly targetSide: FormalFlowchartSide;
  readonly labelPosition?: DiagramPoint;
  readonly handlePosition: DiagramPoint;
  readonly trunkX: number;
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
  let latest = new Map<string, FormalPlannedEdge>();

  for (let pass = 0; pass < maxReconcilePasses; pass += 1) {
    const orderedMetas = sortFormalRoutesForPlanning(
      routeMetas,
      pathLayoutSeed,
      {
        priorityIds,
        reconcilePass: pass,
        priorityRoutesLast: true,
      },
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
        loopbackSlot: loopbackSlots.get(edge.id) ?? 0,
        crossColumnSlot: crossColumnSlots.get(edge.id) ?? 0,
        columnTrunkSlot: columnTrunkSlots.get(edge.id) ?? 0,
      });
      const resolved = applyManualRoute(
        auto,
        manual,
        source,
        target,
        routingBounds,
      );

      registerSide(usedSides, edge.from, "out", resolved.sourceSide, edge.id);
      registerSide(usedSides, edge.to, "in", resolved.targetSide, edge.id);

      const segments = formalPathToSegments(resolved.points);
      segmentsByConnection.set(edge.id, segments);
      occupied.push(...segments);

      const labelPosition =
        manual?.labelPosition ??
        placeFormalEdgeLabel(resolved.points, edge.label, obstacles);
      const handlePosition = routeHandlePosition(resolved.points);

      planned.set(edge.id, {
        ...edge,
        points: resolved.points,
        sourceSide: resolved.sourceSide,
        targetSide: resolved.targetSide,
        handlePosition,
        trunkX: handlePosition.x,
        ...(labelPosition ? { labelPosition } : {}),
      });
    }

    latest = planned;
    const violators = findFormalRouteCrossingIds(segmentsByConnection);
    if (violators.length === 0) break;
    priorityIds = new Set(violators);
  }

  return model.edges.flatMap((edge) => {
    const routed = latest.get(edge.id);
    return routed ? [routed] : [];
  });
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
    const path = routeFormalOrthogonal({
      source: {
        shape: input.source,
        side: candidate.sourceSide,
        distance: 0.5,
      },
      target: {
        shape: input.target,
        side: candidate.targetSide,
        distance: 0.5,
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
      const path = routeFormalOrthogonal({
        source: {
          shape: input.source,
          side: candidate.sourceSide,
          distance: 0.5,
        },
        target: {
          shape: input.target,
          side: candidate.targetSide,
          distance: 0.5,
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

function applyManualRoute(
  auto: FormalFlowchartRouteResult,
  manual: FormalManualRoute | undefined,
  source: FormalFlowchartRect,
  target: FormalFlowchartRect,
  bounds: FormalFlowchartBounds | null,
): FormalFlowchartRouteResult {
  if (!manual) return auto;

  if (manual.kind === "orthogonal") {
    const start = auto.points[0];
    const end = auto.points.at(-1);
    if (!start || !end) return auto;

    return {
      ...auto,
      points: normalizeFormalOrthogonalPath([start, ...manual.bendPoints, end]),
    };
  }

  const points = [...auto.points].map((point) => ({ ...point }));
  let bestSegmentIndex = -1;
  let bestLength = -1;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to || from.x !== to.x) continue;

    const length = Math.abs(to.y - from.y);
    if (length > bestLength) {
      bestLength = length;
      bestSegmentIndex = index;
    }
  }

  if (bestSegmentIndex < 0) {
    return {
      ...auto,
      points: fallbackTrunkPath(source, target, manual.x, bounds),
    };
  }

  const before = points[bestSegmentIndex];
  const after = points[bestSegmentIndex + 1];
  if (!before || !after) return auto;

  const x = clampX(manual.x, bounds);
  points[bestSegmentIndex] = { x, y: before.y };
  points[bestSegmentIndex + 1] = { x, y: after.y };

  return {
    ...auto,
    points: normalizeFormalOrthogonalPath(points),
  };
}

function placeFormalEdgeLabel(
  path: readonly DiagramPoint[],
  label: string | undefined,
  obstacles: readonly FormalFlowchartRect[],
): DiagramPoint | null {
  if (!label || path.length < 2) return null;

  const start = path[0];
  const next = path[1];
  if (!start || !next) return null;

  const dx = next.x - start.x;
  const dy = next.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return { ...start };

  const distance = 30;
  const t = Math.min(1, distance / length);
  const x = start.x + dx * t;
  const y = start.y + dy * t;
  const decisionLabel = ["ya", "yes", "y", "tidak", "no", "n"].includes(
    label.trim().toLowerCase(),
  );
  const offset = decisionLabel ? 22 : 19;
  const nx = -dy / length;
  const ny = dx / length;

  const candidates = [
    { x: x + nx * offset, y: y + ny * offset },
    { x: x - nx * offset, y: y - ny * offset },
    { x: x + nx * (offset + 12), y: y + ny * (offset + 12) },
    { x, y: y - offset },
    { x, y: y + offset },
  ];

  return (
    candidates.find(
      (candidate) =>
        !obstacles.some(
          (obstacle) =>
            candidate.x >= obstacle.left - 4 &&
            candidate.x <= obstacle.left + obstacle.width + 4 &&
            candidate.y >= obstacle.top - 4 &&
            candidate.y <= obstacle.top + obstacle.height + 4,
        ),
    ) ??
    candidates[0] ??
    null
  );
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

function fallbackTrunkPath(
  source: FormalFlowchartRect,
  target: FormalFlowchartRect,
  requestedX: number,
  bounds: FormalFlowchartBounds | null,
): DiagramPoint[] {
  const start = {
    x: Math.round(source.left + source.width / 2),
    y: Math.round(source.top + source.height),
  };
  const end = {
    x: Math.round(target.left + target.width / 2),
    y: Math.round(target.top),
  };
  const x = clampX(requestedX, bounds);

  return normalizeFormalOrthogonalPath([
    start,
    { x, y: start.y },
    { x, y: end.y },
    end,
  ]);
}

function clampX(value: number, bounds: FormalFlowchartBounds | null): number {
  if (!bounds) return Math.round(value);
  return Math.round(
    Math.max(bounds.left + 8, Math.min(bounds.right - 8, value)),
  );
}

function shapeType(
  kind: "start" | "task" | "decision" | "end",
): "flowchart-terminator" | "flowchart-process" | "flowchart-decision" {
  if (kind === "start" || kind === "end") return "flowchart-terminator";
  if (kind === "decision") return "flowchart-decision";
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
