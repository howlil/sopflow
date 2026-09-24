import type { ActorId, SOPDocument, StepId } from "@sopflow/core";
import type {
  DiagramDiagnostic,
  DiagramPoint,
  DiagramRouteKind,
  DiagramRouteQuality,
  DiagramSide,
} from "./types.js";
import {
  channelAnchorDistance,
  clampAnchorDistance,
  distanceOnRectSide,
  extrudePoint,
  nearestRectSide,
  pointOnRectSide,
} from "./routeAnchors.js";
import { placeRouteLabel } from "./routeLabels.js";
import {
  compactOrthogonalPath,
  measureRouteQuality,
  pathIntersectsRectangles,
  pathOverlapsSegments,
  pathToSegments,
  pathWithinBounds,
  scorePath,
  type DiagramRect,
  type RouteSegment,
} from "./routeGeometry.js";
import { repairFormalManualRoute } from "./flowchart/formal/edit.js";
import { layoutBpmnGraph } from "./bpmnLayout.js";
import type { ProcedureManualRoute, SopDiagramConfig } from "./procedure.js";
import { layoutNodeText } from "./text/layoutNodeText.js";
import { projectWorkflow, type WorkflowEdge } from "./workflow.js";

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

const DEFAULTS: Required<
  Pick<BpmnLayoutOptions, "laneHeight" | "headerWidth" | "stepGap" | "padding">
> = {
  laneHeight: 112,
  headerWidth: 116,
  stepGap: 144,
  padding: 24,
};

export function buildBpmnModel(
  document: SOPDocument,
  options: BpmnLayoutOptions = {},
): BpmnModel {
  const first = buildBpmnModelPass(document, options, "feedback-first");
  const second = buildBpmnModelPass(document, options, "branch-first");
  return scoreBpmnPlan(second) < scoreBpmnPlan(first) ? second : first;
}

function buildBpmnModelPass(
  document: SOPDocument,
  options: BpmnLayoutOptions,
  order: "feedback-first" | "branch-first",
): BpmnModel {
  const config = {
    laneHeight: positive(options.laneHeight, DEFAULTS.laneHeight),
    headerWidth: positive(options.headerWidth, DEFAULTS.headerWidth),
    stepGap: positive(options.stepGap, DEFAULTS.stepGap),
    padding: nonNegative(options.padding, DEFAULTS.padding),
  };
  const graph = projectWorkflow(document);
  const diagnostics: DiagramDiagnostic[] = [...graph.diagnostics];
  const actorIndex = new Map(
    document.actors.map((actor, index) => [actor.id, index] as const),
  );
  const needsFallbackLane = document.steps.some((step) => {
    const actorId = step.actorIds[0];
    return !actorId || !actorIndex.has(actorId);
  });
  const hasExplicitActors = document.actors.length > 0;
  const laneCount = Math.max(
    1,
    document.actors.length + (needsFallbackLane && hasExplicitActors ? 1 : 0),
  );
  const layoutNodes = layoutBpmnGraph(document, graph);
  const layoutById = new Map(
    layoutNodes.map((node) => [node.id, node] as const),
  );
  const metricsById = new Map(
    graph.nodes.map(
      (node) => [node.id, measureBpmnNode(node.kind, node.label)] as const,
    ),
  );
  const feedbackEdgeIds = graph.edges.flatMap((edge) => {
    if (edge.from === edge.to) return [];
    const source = layoutById.get(edge.from);
    const target = layoutById.get(edge.to);
    if (!source || !target || target.columnIndex > source.columnIndex)
      return [];
    return [edge.id];
  });
  const feedbackSlotById = new Map(
    feedbackEdgeIds.map((edgeId, index) => [edgeId, index] as const),
  );
  const feedbackCorridorReserve =
    feedbackEdgeIds.length > 0 ? 32 + (feedbackEdgeIds.length - 1) * 14 : 0;
  const maxColumn = Math.max(0, ...layoutNodes.map((node) => node.columnIndex));
  const columnWidths = Array.from({ length: maxColumn + 1 }, () => 96);
  for (const layout of layoutNodes) {
    const metrics = metricsById.get(layout.id);
    if (!metrics) continue;
    columnWidths[layout.columnIndex] = Math.max(
      columnWidths[layout.columnIndex] ?? 96,
      metrics.footprintWidth,
    );
  }
  const columnGap = Math.max(24, config.stepGap - 96);
  const columnCenters: number[] = [];
  let columnCursor = config.padding + config.headerWidth;
  columnWidths.forEach((columnWidth, index) => {
    columnCenters[index] = columnCursor + columnWidth / 2;
    columnCursor += columnWidth;
    if (index < columnWidths.length - 1) columnCursor += columnGap;
  });
  const width = columnCursor + config.padding;

  const laneHeights = Array.from(
    { length: laneCount },
    () => config.laneHeight,
  );
  for (const layout of layoutNodes) {
    const metrics = metricsById.get(layout.id);
    if (!metrics) continue;
    laneHeights[layout.laneIndex] = Math.max(
      laneHeights[layout.laneIndex] ?? config.laneHeight,
      metrics.footprintHeight + 24,
    );
  }
  let laneCursor = config.padding + feedbackCorridorReserve;
  const lanes: BpmnLane[] = Array.from({ length: laneCount }, (_, index) => {
    const actor = document.actors[index];
    const laneHeight = laneHeights[index] ?? config.laneHeight;
    const lane = {
      actorId: actor?.id ?? null,
      label: actor?.name ?? "Pelaksana",
      index,
      y: laneCursor,
      height: laneHeight,
    };
    laneCursor += laneHeight;
    return lane;
  });
  const height = laneCursor + config.padding;

  const stepById = new Map(document.steps.map((step) => [step.id, step]));
  const nodes = graph.nodes.flatMap<BpmnNode>((node) => {
    const step = stepById.get(node.id);
    const layout = layoutById.get(node.id);
    const metrics = metricsById.get(node.id);
    if (!step || !layout || !metrics) return [];

    const firstActorId = step.actorIds[0];
    const laneIndex = layout.laneIndex;
    if (!firstActorId && hasExplicitActors) {
      diagnostics.push({
        code: "UNASSIGNED_ACTOR",
        edgeId: `node:${node.id}`,
        from: node.id,
        to: node.id,
      });
    } else if (firstActorId && !actorIndex.has(firstActorId)) {
      diagnostics.push({
        code: "UNKNOWN_ACTOR_LANE",
        edgeId: `node:${node.id}`,
        from: node.id,
        to: node.id,
      });
    }

    const lane = lanes[laneIndex];
    if (!lane) return [];

    return [
      {
        id: node.id,
        kind: node.kind,
        label: node.label,
        laneIndex,
        x:
          columnCenters[layout.columnIndex] ??
          config.padding + config.headerWidth + metrics.width / 2,
        y: lane.y + lane.height / 2,
        width: metrics.width,
        height: metrics.height,
        labelLines: metrics.labelLines,
        labelLineHeight: metrics.labelLineHeight,
      },
    ];
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const routing = reconcileBpmnRoutes({
    semanticEdges: graph.edges,
    nodes,
    nodeById,
    width,
    height,
    order,
    feedbackSlotById,
    feedbackCorridorTop: config.padding + 8,
    diagramConfig: options.diagramConfig ?? {},
  });
  diagnostics.push(...routing.diagnostics);
  const edges = routing.edges;

  return {
    lanes,
    nodes,
    connections: graph.connections,
    edges,
    diagnostics,
    width,
    height,
    padding: config.padding,
    headerWidth: config.headerWidth,
    laneHeight: config.laneHeight,
  };
}

interface BpmnRoutingPassResult {
  readonly edges: readonly BpmnRoutedEdge[];
  readonly diagnostics: readonly DiagramDiagnostic[];
}

function reconcileBpmnRoutes(input: {
  readonly semanticEdges: readonly WorkflowEdge[];
  readonly nodes: readonly BpmnNode[];
  readonly nodeById: ReadonlyMap<StepId, BpmnNode>;
  readonly width: number;
  readonly height: number;
  readonly order: "feedback-first" | "branch-first";
  readonly feedbackSlotById: ReadonlyMap<string, number>;
  readonly feedbackCorridorTop: number;
  readonly diagramConfig: SopDiagramConfig;
}): BpmnRoutingPassResult {
  const MAX_RECONCILE_PASSES = 4;
  let priorityIds = new Set<string>();
  let best: BpmnRoutingPassResult | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let pass = 0; pass < MAX_RECONCILE_PASSES; pass += 1) {
    const planned = routeBpmnEdgesPass({
      ...input,
      priorityIds,
      reconcilePass: pass,
    });
    const score = scoreBpmnEdges(planned.edges);

    if (score < bestScore) {
      best = planned;
      bestScore = score;
    }

    const nextPriorityIds = new Set(
      planned.edges
        .filter((edge) => bpmnEdgeNeedsReconciliation(edge))
        .map((edge) => edge.id),
    );
    if (nextPriorityIds.size === 0) break;

    priorityIds = nextPriorityIds;
  }

  return best ?? { edges: [], diagnostics: [] };
}

function routeBpmnEdgesPass(input: {
  readonly semanticEdges: readonly WorkflowEdge[];
  readonly nodes: readonly BpmnNode[];
  readonly nodeById: ReadonlyMap<StepId, BpmnNode>;
  readonly width: number;
  readonly height: number;
  readonly order: "feedback-first" | "branch-first";
  readonly priorityIds: ReadonlySet<string>;
  readonly reconcilePass: number;
  readonly feedbackSlotById: ReadonlyMap<string, number>;
  readonly feedbackCorridorTop: number;
  readonly diagramConfig: SopDiagramConfig;
}): BpmnRoutingPassResult {
  const {
    semanticEdges,
    nodes,
    nodeById,
    width,
    height,
    order,
    priorityIds,
    reconcilePass,
    feedbackSlotById,
    feedbackCorridorTop,
    diagramConfig,
  } = input;
  const occupied: RouteSegment[] = [];
  const parallelCounts = new Map<string, number>();
  const portLedger = new BpmnPortLedger();
  const diagnostics: DiagramDiagnostic[] = [];
  const occupiedLabels: DiagramRect[] = [];
  const labelObstacles = nodes.map(nodeRect);
  let selfLoopIndex = 0;

  const sortedEdges = [...semanticEdges].sort((first, second) => {
    const firstManual = diagramConfig.routes?.[first.id] ? 0 : 1;
    const secondManual = diagramConfig.routes?.[second.id] ? 0 : 1;
    if (firstManual !== secondManual) return firstManual - secondManual;

    const firstPriority = priorityIds.has(first.id) ? 1 : 0;
    const secondPriority = priorityIds.has(second.id) ? 1 : 0;
    if (firstPriority !== secondPriority) return firstPriority - secondPriority;

    const priority = compareBpmnRoutingPriority(first, second, nodeById, order);
    if (priority !== 0) return priority;

    return reconcilePass % 2 === 0
      ? first.id.localeCompare(second.id)
      : second.id.localeCompare(first.id);
  });
  const lockedCount = sortedEdges.filter(
    (edge) => diagramConfig.routes?.[edge.id] !== undefined,
  ).length;
  const lockedEdges = sortedEdges.slice(0, lockedCount);
  const autoEdges = sortedEdges.slice(lockedCount);
  const seed = Math.max(0, Math.floor(diagramConfig.pathLayoutSeed ?? 0));
  const offset = autoEdges.length > 0 ? seed % autoEdges.length : 0;
  const orderedEdges = [
    ...lockedEdges,
    ...autoEdges.slice(offset),
    ...autoEdges.slice(0, offset),
  ];

  const routedEdges = orderedEdges.flatMap<BpmnRoutedEdge>((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) return [];

    const selfLoop = edge.from === edge.to;
    const currentSelfLoopIndex = selfLoop ? selfLoopIndex++ : -1;
    const pairKey = `${edge.from}:${edge.to}`;
    const parallelIndex = parallelCounts.get(pairKey) ?? 0;
    parallelCounts.set(pairKey, parallelIndex + 1);
    const obstacles = nodes
      .filter((node) => node.id !== from.id && node.id !== to.id)
      .map(nodeRect);
    const configuredRoute = diagramConfig.routes?.[edge.id];
    const manualRoute = configuredRoute
      ? resolveBpmnManualRoute(configuredRoute, from, to, obstacles, {
          left: 0,
          top: 0,
          width,
          height,
        })
      : null;
    const route = manualRoute
      ? manualRoute
      : selfLoop
        ? selectBpmnRoute(
            [
              {
                path: routeSelfLoop(
                  from,
                  currentSelfLoopIndex,
                  Math.max(
                    portLedger.peek(
                      from.id,
                      "out",
                      "right",
                      sideLength(nodeRect(from), "right"),
                      from.kind === "decision",
                    ),
                    portLedger.peek(
                      from.id,
                      "in",
                      "right",
                      sideLength(nodeRect(from), "right"),
                      from.kind === "decision",
                    ),
                  ),
                ),
                sourceSide: "right",
                targetSide: "right",
              },
            ],
            obstacles,
            occupied,
            { width, height },
            edge,
          )
        : buildBpmnRoute(
            from,
            to,
            edge,
            parallelIndex,
            obstacles,
            occupied,
            { width, height, feedbackCorridorTop },
            portLedger,
            feedbackSlotById.get(edge.id),
          );
    const points = route.points;
    const quality = measureRouteQuality(points, obstacles, occupied);
    occupied.push(...pathToSegments(points));
    portLedger.reserve(edge.from, "out", route.sourceSide);
    portLedger.reserve(edge.to, "in", route.targetSide);
    const routeDiagnostics = [...route.diagnostics];
    if (configuredRoute && !manualRoute) {
      routeDiagnostics.push({
        code: "INVALID_MANUAL_ROUTE",
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
      });
    }

    for (const [code, count] of [
      ["PATH_INTERSECTS_NODE", quality.obstacleHits],
      ["PATH_OVERLAPS_EDGE", quality.overlaps],
      ["PATH_CROSSES_EDGE", quality.crossings],
    ] as const) {
      if (count > 0) {
        routeDiagnostics.push({
          code,
          edgeId: edge.id,
          from: edge.from,
          to: edge.to,
        });
      }
    }

    diagnostics.push(...routeDiagnostics);
    const manualLabelPosition = configuredRoute?.labelPosition;
    const labelPlacement =
      edge.label && !manualLabelPosition
        ? placeRouteLabel({
            path: points,
            label: edge.label,
            obstacles: labelObstacles,
            occupiedLabels,
            perpendicularOffset:
              18 + (selfLoop ? currentSelfLoopIndex : parallelIndex) * 4,
          })
        : null;
    if (labelPlacement) occupiedLabels.push(labelPlacement.bounds);

    return [
      {
        ...edge,
        points,
        routeKind: route.kind,
        sourceSide: route.sourceSide,
        targetSide: route.targetSide,
        quality,
        ...(routeDiagnostics.length > 0 ? { routeDiagnostics } : {}),
        ...(manualLabelPosition
          ? { labelPosition: manualLabelPosition }
          : labelPlacement
            ? { labelPosition: labelPlacement.position }
            : {}),
      },
    ];
  });

  const edges = semanticEdges.flatMap((edge) =>
    routedEdges.filter((routedEdge) => routedEdge.id === edge.id),
  );
  return { edges, diagnostics };
}

function bpmnEdgeNeedsReconciliation(edge: BpmnRoutedEdge): boolean {
  return (
    edge.routeKind === "fallback" ||
    (edge.quality?.obstacleHits ?? 0) > 0 ||
    (edge.quality?.overlaps ?? 0) > 0 ||
    (edge.quality?.crossings ?? 0) > 0
  );
}

function scoreBpmnEdges(edges: readonly BpmnRoutedEdge[]): number {
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

function scoreBpmnPlan(model: BpmnModel): number {
  return scoreBpmnEdges(model.edges);
}

interface BpmnRouteResult {
  points: DiagramPoint[];
  kind: DiagramRouteKind;
  sourceSide: DiagramSide;
  targetSide: DiagramSide;
  diagnostics: DiagramDiagnostic[];
}

function nodeRect(node: BpmnNode): DiagramRect {
  return {
    left: node.x - node.width / 2,
    top: node.y - node.height / 2,
    width: node.width,
    height: node.height,
  };
}

function candidateBpmnPath(
  from: BpmnNode,
  to: BpmnNode,
  sourceSide: DiagramSide,
  targetSide: DiagramSide,
  offset: number,
  sourceDistance = 0.5,
  targetDistance = 0.5,
): DiagramPoint[] {
  const start = pointOnRectSide(nodeRect(from), sourceSide, sourceDistance);
  const end = pointOnRectSide(nodeRect(to), targetSide, targetDistance);
  const startJetty = extrudePoint(start, sourceSide, 18);
  const endJetty = extrudePoint(end, targetSide, 18);

  if (sourceSide === "right" || sourceSide === "left") {
    const midX = (startJetty.x + endJetty.x) / 2 + offset;
    return compactOrthogonalPath([
      start,
      startJetty,
      { x: midX, y: startJetty.y },
      { x: midX, y: endJetty.y },
      endJetty,
      end,
    ]);
  }

  const midY = (startJetty.y + endJetty.y) / 2 + offset;
  return compactOrthogonalPath([
    start,
    startJetty,
    { x: startJetty.x, y: midY },
    { x: endJetty.x, y: midY },
    endJetty,
    end,
  ]);
}

function resolveBpmnManualRoute(
  route: ProcedureManualRoute,
  from: BpmnNode,
  to: BpmnNode,
  obstacles: readonly DiagramRect[],
  bounds: DiagramRect,
): BpmnRouteResult | null {
  if (route.kind !== "orthogonal") return null;
  if (
    route.bendPoints.some(
      (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y),
    )
  ) {
    return null;
  }

  const fromRect = nodeRect(from);
  const toRect = nodeRect(to);
  const sourceSide =
    route.sSide ??
    (route.startPoint ? nearestRectSide(fromRect, route.startPoint) : "right");
  const targetSide =
    route.eSide ??
    (route.endPoint ? nearestRectSide(toRect, route.endPoint) : "left");
  const sourceDistance = clampAnchorDistance(
    route.sourceDistance ??
      (route.startPoint
        ? distanceOnRectSide(fromRect, sourceSide, route.startPoint)
        : 0.5),
  );
  const targetDistance = clampAnchorDistance(
    route.targetDistance ??
      (route.endPoint
        ? distanceOnRectSide(toRect, targetSide, route.endPoint)
        : 0.5),
  );
  const start = pointOnRectSide(
    fromRect,
    sourceSide,
    from.kind === "decision" ? 0.5 : sourceDistance,
  );
  const end = pointOnRectSide(
    toRect,
    targetSide,
    to.kind === "decision" ? 0.5 : targetDistance,
  );
  const raw = compactOrthogonalPath([start, ...route.bendPoints, end]);
  const repaired = repairFormalManualRoute({
    path: raw,
    sourceSide,
    targetSide,
    obstacles,
    bounds,
    clearance: 2,
  });
  if (!repaired) return null;

  return {
    points: repaired,
    kind: "manual",
    sourceSide,
    targetSide,
    diagnostics: [],
  };
}

function buildBpmnRoute(
  from: BpmnNode,
  to: BpmnNode,
  edge: WorkflowEdge,
  parallelIndex: number,
  obstacles: readonly DiagramRect[],
  occupied: readonly RouteSegment[],
  config: {
    width: number;
    height: number;
    feedbackCorridorTop: number;
  },
  portLedger: BpmnPortLedger,
  feedbackSlot?: number,
): BpmnRouteResult {
  const sameLane = from.laneIndex === to.laneIndex;
  const targetRight = to.x > from.x;
  const targetBelow = to.y > from.y;
  const candidates: Array<{
    path: DiagramPoint[];
    sourceSide: DiagramSide;
    targetSide: DiagramSide;
    feedbackCorridor?: boolean;
  }> = [];
  if (feedbackSlot !== undefined) {
    const sourceDistance = portLedger.peek(
      from.id,
      "out",
      "top",
      sideLength(nodeRect(from), "top"),
      from.kind === "decision",
    );
    const targetDistance = portLedger.peek(
      to.id,
      "in",
      "top",
      sideLength(nodeRect(to), "top"),
      to.kind === "decision",
    );
    candidates.push({
      path: routeBpmnFeedbackCorridor(
        from,
        to,
        config.feedbackCorridorTop + feedbackSlot * 14,
        sourceDistance,
        targetDistance,
      ),
      sourceSide: "top",
      targetSide: "top",
      feedbackCorridor: true,
    });
  }

  const sourceSide =
    sameLane && targetRight
      ? "right"
      : sameLane
        ? targetBelow
          ? "bottom"
          : "top"
        : targetBelow
          ? "bottom"
          : "top";
  const targetSide =
    sameLane && targetRight
      ? "left"
      : sameLane
        ? targetBelow
          ? "top"
          : "bottom"
        : targetBelow
          ? "top"
          : "bottom";
  const sourceDistance = portLedger.peek(
    from.id,
    "out",
    sourceSide,
    sideLength(nodeRect(from), sourceSide),
    from.kind === "decision",
  );
  const targetDistance = portLedger.peek(
    to.id,
    "in",
    targetSide,
    sideLength(nodeRect(to), targetSide),
    to.kind === "decision",
  );

  if (sameLane && targetRight) {
    candidates.push({
      path: candidateBpmnPath(
        from,
        to,
        "right",
        "left",
        parallelIndex * 18,
        sourceDistance,
        targetDistance,
      ),
      sourceSide: "right",
      targetSide: "left",
    });
  } else if (sameLane) {
    candidates.push({
      path: candidateBpmnPath(
        from,
        to,
        "top",
        "top",
        parallelIndex * 18,
        sourceDistance,
        targetDistance,
      ),
      sourceSide: "top",
      targetSide: "top",
    });
    candidates.push({
      path: candidateBpmnPath(
        from,
        to,
        "bottom",
        "bottom",
        parallelIndex * 18,
        sourceDistance,
        targetDistance,
      ),
      sourceSide: "bottom",
      targetSide: "bottom",
    });
  } else if (targetBelow) {
    candidates.push({
      path: candidateBpmnPath(
        from,
        to,
        "bottom",
        "top",
        parallelIndex * 18,
        sourceDistance,
        targetDistance,
      ),
      sourceSide: "bottom",
      targetSide: "top",
    });
    candidates.push({
      path: candidateBpmnPath(
        from,
        to,
        "right",
        "left",
        parallelIndex * 18,
        sourceDistance,
        targetDistance,
      ),
      sourceSide: "right",
      targetSide: "left",
    });
  } else {
    candidates.push({
      path: candidateBpmnPath(
        from,
        to,
        "top",
        "bottom",
        parallelIndex * 18,
        sourceDistance,
        targetDistance,
      ),
      sourceSide: "top",
      targetSide: "bottom",
    });
    candidates.push({
      path: candidateBpmnPath(
        from,
        to,
        "right",
        "left",
        parallelIndex * 18,
        sourceDistance,
        targetDistance,
      ),
      sourceSide: "right",
      targetSide: "left",
    });
  }

  candidates.push(
    {
      path: candidateBpmnPath(
        from,
        to,
        "right",
        "left",
        36 + parallelIndex * 18,
        sourceDistance,
        targetDistance,
      ),
      sourceSide: "right",
      targetSide: "left",
    },
    {
      path: candidateBpmnPath(
        from,
        to,
        "bottom",
        "top",
        36 + parallelIndex * 18,
        sourceDistance,
        targetDistance,
      ),
      sourceSide: "bottom",
      targetSide: "top",
    },
  );

  const bounds: DiagramRect = {
    left: 0,
    top: 0,
    width: config.width,
    height: config.height,
  };
  const safe = candidates.filter(
    (candidate) =>
      pathWithinBounds(candidate.path, bounds) &&
      !pathIntersectsRectangles(candidate.path, obstacles, 2) &&
      !pathOverlapsSegments(candidate.path, occupied, {
        includeCross: true,
        ignoreTerminalSegments: true,
      }),
  );
  const selected =
    (feedbackSlot !== undefined
      ? safe.find((candidate) => candidate.feedbackCorridor)
      : undefined) ??
    safe.reduce<(typeof candidates)[number] | undefined>(
      (best, candidate) =>
        !best ||
        scorePath(candidate.path, occupied) < scorePath(best.path, occupied)
          ? candidate
          : best,
      undefined,
    );
  const fallback = candidates[0] as (typeof candidates)[number];
  const chosen = selected ?? fallback;
  const diagnostics: DiagramDiagnostic[] = selected
    ? []
    : [
        {
          code: "ROUTE_FALLBACK_USED",
          edgeId: edge.id,
          from: edge.from,
          to: edge.to,
        },
      ];

  return {
    points: chosen.path,
    kind: selected ? "automatic" : "fallback",
    sourceSide: chosen.sourceSide,
    targetSide: chosen.targetSide,
    diagnostics,
  };
}

function routeBpmnFeedbackCorridor(
  from: BpmnNode,
  to: BpmnNode,
  corridorY: number,
  sourceDistance: number,
  targetDistance: number,
): DiagramPoint[] {
  const start = pointOnRectSide(nodeRect(from), "top", sourceDistance);
  const end = pointOnRectSide(nodeRect(to), "top", targetDistance);
  const startJetty = extrudePoint(start, "top", 18);
  const endJetty = extrudePoint(end, "top", 18);

  return compactOrthogonalPath([
    start,
    startJetty,
    { x: startJetty.x, y: corridorY },
    { x: endJetty.x, y: corridorY },
    endJetty,
    end,
  ]);
}

function selectBpmnRoute(
  candidates: ReadonlyArray<{
    path: DiagramPoint[];
    sourceSide: DiagramSide;
    targetSide: DiagramSide;
  }>,
  obstacles: readonly DiagramRect[],
  occupied: readonly RouteSegment[],
  config: { width: number; height: number },
  edge: WorkflowEdge,
): BpmnRouteResult {
  const bounds: DiagramRect = {
    left: 0,
    top: 0,
    width: config.width,
    height: config.height,
  };
  const selected = candidates.find(
    (candidate) =>
      pathWithinBounds(candidate.path, bounds) &&
      !pathIntersectsRectangles(candidate.path, obstacles, 2) &&
      !pathOverlapsSegments(candidate.path, occupied, {
        includeCross: true,
        ignoreTerminalSegments: true,
      }),
  );
  const chosen = selected ?? candidates[0];
  const points = chosen?.path ?? [];
  const diagnostics: DiagramDiagnostic[] = selected
    ? []
    : [
        {
          code: "ROUTE_FALLBACK_USED",
          edgeId: edge.id,
          from: edge.from,
          to: edge.to,
        },
      ];
  if (pathIntersectsRectangles(points, obstacles, 2)) {
    diagnostics.push({
      code: "PATH_INTERSECTS_NODE",
      edgeId: edge.id,
      from: edge.from,
      to: edge.to,
    });
  }
  if (!pathWithinBounds(points, bounds)) {
    diagnostics.push({
      code: "PATH_OUT_OF_BOUNDS",
      edgeId: edge.id,
      from: edge.from,
      to: edge.to,
    });
  }
  if (
    pathOverlapsSegments(points, occupied, {
      includeCross: false,
      ignoreTerminalSegments: true,
    })
  ) {
    diagnostics.push({
      code: "PATH_OVERLAPS_EDGE",
      edgeId: edge.id,
      from: edge.from,
      to: edge.to,
    });
  }
  return {
    points,
    kind: selected ? "automatic" : "fallback",
    sourceSide: chosen?.sourceSide ?? "right",
    targetSide: chosen?.targetSide ?? "right",
    diagnostics,
  };
}

function routeSelfLoop(
  node: BpmnNode,
  index: number,
  distance = 0.5,
): DiagramPoint[] {
  const start = pointOnRectSide(nodeRect(node), "right", distance);
  const loopX = start.x + 24 + index * 16;
  const outerX = loopX + 24;
  const topY = node.y - node.height / 2 - 24;
  const bottomY = node.y + node.height / 2 + 24;

  return compactOrthogonalPoints([
    start,
    { x: loopX, y: start.y },
    { x: loopX, y: topY },
    { x: outerX, y: topY },
    { x: outerX, y: bottomY },
    { x: loopX, y: bottomY },
    { x: loopX, y: start.y },
    start,
  ]);
}

class BpmnPortLedger {
  private readonly counts = new Map<string, number>();

  peek(
    nodeId: StepId,
    direction: "in" | "out",
    side: DiagramSide,
    sideLengthPx: number,
    isDiamond = false,
  ): number {
    if (isDiamond) return 0.5;
    return channelAnchorDistance(
      this.counts.get(this.key(nodeId, direction, side)) ?? 0,
      sideLengthPx,
    );
  }

  reserve(nodeId: StepId, direction: "in" | "out", side: DiagramSide): void {
    const key = this.key(nodeId, direction, side);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  private key(
    nodeId: StepId,
    direction: "in" | "out",
    side: DiagramSide,
  ): string {
    return `${nodeId}:${direction}:${side}`;
  }
}

function sideLength(rect: DiagramRect, side: DiagramSide): number {
  return side === "top" || side === "bottom" ? rect.width : rect.height;
}

function compareBpmnRoutingPriority(
  first: WorkflowEdge,
  second: WorkflowEdge,
  nodes: ReadonlyMap<StepId, BpmnNode>,
  order: "feedback-first" | "branch-first",
): number {
  const firstFrom = nodes.get(first.from);
  const firstTo = nodes.get(first.to);
  const secondFrom = nodes.get(second.from);
  const secondTo = nodes.get(second.to);
  const feedback = (from: BpmnNode | undefined, to: BpmnNode | undefined) =>
    from && to && to.x <= from.x ? 0 : 1;
  const firstFeedback = feedback(firstFrom, firstTo);
  const secondFeedback = feedback(secondFrom, secondTo);
  const branchPriority = (kind: WorkflowEdge["kind"]) =>
    kind === "yes" ? 0 : kind === "no" ? 1 : 2;
  const branchDifference =
    branchPriority(first.kind) - branchPriority(second.kind);
  if (order === "feedback-first" && firstFeedback !== secondFeedback) {
    return firstFeedback - secondFeedback;
  }
  if (order === "branch-first" && branchDifference !== 0) {
    return branchDifference;
  }
  if (order === "feedback-first" && branchDifference !== 0) {
    return branchDifference;
  }
  return branchDifference !== 0
    ? branchDifference
    : first.id.localeCompare(second.id);
}

interface BpmnNodeMetrics {
  readonly width: number;
  readonly height: number;
  readonly footprintWidth: number;
  readonly footprintHeight: number;
  readonly labelLines: readonly string[];
  readonly labelLineHeight: number;
}

function measureBpmnNode(
  kind: BpmnNode["kind"],
  label: string,
): BpmnNodeMetrics {
  const labelLayout = layoutNodeText(label, kind, {
    maxCharsPerLine: kind === "task" ? 22 : 18,
    lineHeight: 14,
    horizontalPadding: 16,
    verticalPadding: 10,
    minWidth: 48,
    maxWidth: 200,
  });
  const labelLines = labelLayout.text.lines;
  const labelLineHeight = labelLayout.text.lineHeight;
  const longestLine = Math.max(1, ...labelLines.map((line) => line.length));
  const estimatedLabelWidth = clamp(
    longestLine * 6.2 + 20,
    kind === "task" ? 96 : 48,
    200,
  );

  if (kind === "task") {
    const width = estimatedLabelWidth;
    const height = Math.max(48, labelLines.length * labelLineHeight + 20);
    return {
      width,
      height,
      footprintWidth: width,
      footprintHeight: height,
      labelLines,
      labelLineHeight,
    };
  }

  const shapeSize = kind === "decision" ? 48 : 38;
  return {
    width: shapeSize,
    height: shapeSize,
    footprintWidth: Math.max(shapeSize, estimatedLabelWidth),
    footprintHeight: shapeSize + 10 + labelLines.length * labelLineHeight,
    labelLines,
    labelLineHeight,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function compactOrthogonalPoints(
  points: readonly DiagramPoint[],
): DiagramPoint[] {
  const result: DiagramPoint[] = [];

  for (const point of points) {
    const previous = result.at(-1);
    if (previous?.x === point.x && previous.y === point.y) continue;
    result.push({ x: point.x, y: point.y });
  }

  return result;
}

function positive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0
    ? (value as number)
    : fallback;
}

function nonNegative(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? -1) >= 0
    ? (value as number)
    : fallback;
}
