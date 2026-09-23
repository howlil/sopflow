import type { ActorId, SOPDocument, StepId } from "@sopflow/core";
import type {
  DiagramDiagnostic,
  DiagramPoint,
  DiagramRouteKind,
  DiagramRouteQuality,
  DiagramSide,
} from "./types.js";
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
import { projectWorkflow, type WorkflowEdge } from "./workflow.js";

export interface BpmnLayoutOptions {
  readonly laneHeight?: number;
  readonly headerWidth?: number;
  readonly stepGap?: number;
  readonly padding?: number;
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

const DEFAULTS: Required<BpmnLayoutOptions> = {
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
  const fallbackLaneIndex = hasExplicitActors ? document.actors.length : 0;
  const laneCount = Math.max(
    1,
    document.actors.length + (needsFallbackLane && hasExplicitActors ? 1 : 0),
  );
  const lanes: BpmnLane[] = Array.from({ length: laneCount }, (_, index) => {
    const actor = document.actors[index];

    return {
      actorId: actor?.id ?? null,
      label: actor?.name ?? "Pelaksana",
      index,
      y: config.padding + index * config.laneHeight,
      height: config.laneHeight,
    };
  });
  const width =
    config.headerWidth +
    config.padding * 2 +
    Math.max(1, document.steps.length) * config.stepGap;
  const height = config.padding * 2 + laneCount * config.laneHeight;

  const stepById = new Map(document.steps.map((step) => [step.id, step]));
  const nodes = graph.nodes.flatMap<BpmnNode>((node, index) => {
    const step = stepById.get(node.id);
    if (!step) return [];

    const firstActorId = step.actorIds[0];
    const laneIndex = firstActorId
      ? (actorIndex.get(firstActorId) ?? fallbackLaneIndex)
      : fallbackLaneIndex;
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
    const size = nodeSize(node.kind);

    return [
      {
        id: node.id,
        kind: node.kind,
        label: node.label,
        laneIndex,
        x:
          config.headerWidth +
          config.padding +
          index * config.stepGap +
          config.stepGap / 2,
        y:
          config.padding +
          laneIndex * config.laneHeight +
          config.laneHeight / 2,
        ...size,
      },
    ];
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const occupied: RouteSegment[] = [];
  const parallelCounts = new Map<string, number>();
  const portLedger = new BpmnPortLedger();
  let selfLoopIndex = 0;

  const orderedEdges = [...graph.edges].sort((first, second) =>
    compareBpmnRoutingPriority(first, second, nodeById, order),
  );

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
    const route = selfLoop
      ? selectBpmnRoute(
          [
            {
              path: routeSelfLoop(
                from,
                currentSelfLoopIndex,
                Math.max(
                  portLedger.peek(from.id, "out", "right"),
                  portLedger.peek(from.id, "in", "right"),
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
          { width, height },
          portLedger,
        );
    const points = route.points;
    const quality = measureRouteQuality(points, obstacles, occupied);
    occupied.push(...pathToSegments(points));
    portLedger.reserve(edge.from, "out", route.sourceSide);
    portLedger.reserve(edge.to, "in", route.targetSide);
    const routeDiagnostics = [...route.diagnostics];
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
    const labelPosition = edge.label
      ? routeLabelPosition(
          points,
          selfLoop ? currentSelfLoopIndex : parallelIndex,
        )
      : undefined;

    return [
      {
        ...edge,
        points,
        routeKind: route.kind,
        sourceSide: route.sourceSide,
        targetSide: route.targetSide,
        quality,
        ...(routeDiagnostics.length > 0 ? { routeDiagnostics } : {}),
        ...(labelPosition ? { labelPosition } : {}),
      },
    ];
  });

  const edges = graph.edges.flatMap((edge) =>
    routedEdges.filter((routedEdge) => routedEdge.id === edge.id),
  );

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

function scoreBpmnPlan(model: BpmnModel): number {
  return model.edges.reduce((score, edge) => {
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

function anchor(
  node: BpmnNode,
  side: DiagramSide,
  distance = 0.5,
): DiagramPoint {
  const rect = nodeRect(node);
  const normalized = Math.max(0, Math.min(1, distance));
  switch (side) {
    case "top":
      return { x: rect.left + rect.width * normalized, y: rect.top };
    case "right":
      return {
        x: rect.left + rect.width,
        y: rect.top + rect.height * normalized,
      };
    case "bottom":
      return {
        x: rect.left + rect.width * normalized,
        y: rect.top + rect.height,
      };
    case "left":
      return { x: rect.left, y: rect.top + rect.height * normalized };
  }
}

function extrude(
  point: DiagramPoint,
  side: DiagramSide,
  distance: number,
): DiagramPoint {
  switch (side) {
    case "top":
      return { x: point.x, y: point.y - distance };
    case "right":
      return { x: point.x + distance, y: point.y };
    case "bottom":
      return { x: point.x, y: point.y + distance };
    case "left":
      return { x: point.x - distance, y: point.y };
  }
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
  const start = anchor(from, sourceSide, sourceDistance);
  const end = anchor(to, targetSide, targetDistance);
  const startJetty = extrude(start, sourceSide, 18);
  const endJetty = extrude(end, targetSide, 18);

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

function buildBpmnRoute(
  from: BpmnNode,
  to: BpmnNode,
  edge: WorkflowEdge,
  parallelIndex: number,
  obstacles: readonly DiagramRect[],
  occupied: readonly RouteSegment[],
  config: { width: number; height: number },
  portLedger: BpmnPortLedger,
): BpmnRouteResult {
  const sameLane = from.laneIndex === to.laneIndex;
  const targetRight = to.x > from.x;
  const targetBelow = to.y > from.y;
  const candidates: Array<{
    path: DiagramPoint[];
    sourceSide: DiagramSide;
    targetSide: DiagramSide;
  }> = [];
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
  const sourceDistance = portLedger.peek(from.id, "out", sourceSide);
  const targetDistance = portLedger.peek(to.id, "in", targetSide);

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
  const selected = safe.reduce<(typeof candidates)[number] | undefined>(
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

function routeLabelPosition(
  points: readonly DiagramPoint[],
  index: number,
): DiagramPoint | undefined {
  const segments = pathToSegments(points);
  const segment =
    segments.find((candidate) => candidate.x1 === candidate.x2) ?? segments[0];
  if (!segment) return undefined;
  return {
    x: (segment.x1 + segment.x2) / 2 + 6 + index * 12,
    y: (segment.y1 + segment.y2) / 2 - 4,
  };
}

function routeSelfLoop(
  node: BpmnNode,
  index: number,
  distance = 0.5,
): DiagramPoint[] {
  const start = anchor(node, "right", distance);
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

  peek(nodeId: StepId, direction: "in" | "out", side: DiagramSide): number {
    return portDistance(
      this.counts.get(this.key(nodeId, direction, side)) ?? 0,
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

function portDistance(index: number): number {
  const slots = [0.5, 0.34, 0.66, 0.2, 0.8];
  return slots[index] ?? (index % 2 === 0 ? 0.14 : 0.86);
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

function nodeSize(kind: BpmnNode["kind"]): {
  readonly width: number;
  readonly height: number;
} {
  if (kind === "decision") return { width: 48, height: 48 };
  if (kind === "start" || kind === "end") return { width: 38, height: 38 };
  return { width: 96, height: 48 };
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
