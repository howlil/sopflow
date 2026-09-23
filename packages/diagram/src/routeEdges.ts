import type {
  DiagramEdgeKind,
  DiagramDiagnostic,
  DiagramEdge,
  DiagramModel,
  DiagramNode,
  DiagramPoint,
  DiagramRoutedEdge,
} from "./types.js";
import {
  compactOrthogonalPath,
  isOrthogonalPath,
  measureRouteQuality,
  pathIntersectsRectangles,
  pathOverlapsSegments,
  pathToSegments,
  pathWithinBounds,
  pickLabelPosition,
  scorePath,
  type DiagramRect,
  type RouteSegment,
} from "./routeGeometry.js";

export interface EdgeRoutingOptions {
  edgeGap?: number;
  backEdgeGap?: number;
  obstacleClearance?: number;
  routingBounds?: DiagramRect;
}

const DEFAULT_OPTIONS = {
  edgeGap: 24,
  backEdgeGap: 48,
  obstacleClearance: 2,
} as const;

export function routeDiagramEdges(
  model: DiagramModel,
  options: EdgeRoutingOptions = {},
): DiagramModel {
  const first = routeDiagramEdgesPass(model, options, "feedback-first");
  const second = routeDiagramEdgesPass(model, options, "branch-first");
  const chosen =
    scoreRoutePlan(second) < scoreRoutePlan(first) ? second : first;

  return chosen;
}

function routeDiagramEdgesPass(
  model: DiagramModel,
  options: EdgeRoutingOptions,
  order: "feedback-first" | "branch-first",
): DiagramModel {
  const config = {
    edgeGap: resolveGap(options.edgeGap, DEFAULT_OPTIONS.edgeGap),
    backEdgeGap: resolveGap(options.backEdgeGap, DEFAULT_OPTIONS.backEdgeGap),
    obstacleClearance: resolveGap(
      options.obstacleClearance,
      DEFAULT_OPTIONS.obstacleClearance,
    ),
    routingBounds: options.routingBounds,
  };
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  const occupied: RouteSegment[] = [];
  const parallelCounts = new Map<string, number>();
  let backEdgeIndex = 0;
  const orderedEdges = [...model.edges].sort((first, second) =>
    compareRoutingPriority(first, second, nodes, order),
  );

  const routedEdges = orderedEdges.map<DiagramRoutedEdge>((edge) => {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);

    if (!from || !to) {
      const diagnostic = {
        code: !from
          ? ("MISSING_EDGE_SOURCE" as const)
          : ("MISSING_EDGE_TARGET" as const),
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
      };
      return {
        ...edge,
        points: [],
        routeKind: "fallback",
        routeDiagnostics: [diagnostic],
      };
    }

    const obstacles = model.nodes
      .filter((node) => node.id !== from.id && node.id !== to.id)
      .map(nodeRect);
    const routeIndex = backEdgeIndex;
    const parallelKey = `${edge.from}:${edge.to}`;
    const parallelIndex = parallelCounts.get(parallelKey) ?? 0;
    parallelCounts.set(parallelKey, parallelIndex + 1);
    const points = isBackEdge(from, to)
      ? routeBackEdge(from, to, routeIndex, config)
      : routeForwardEdge(from, to, edge.kind, config, parallelIndex);

    if (isBackEdge(from, to)) {
      backEdgeIndex += 1;
    }

    const candidates = [
      points,
      ...buildAlternativeRoutes(from, to, edge.kind, config, parallelIndex),
    ];
    const selected = selectSafeRoute(
      candidates,
      obstacles,
      occupied,
      config.routingBounds,
      config.obstacleClearance,
    );
    const route = selected ?? compactOrthogonalPath(points);
    const routeDiagnostics: DiagramDiagnostic[] = selected
      ? []
      : [
          {
            code: "ROUTE_FALLBACK_USED" as const,
            edgeId: edge.id,
            from: edge.from,
            to: edge.to,
          },
        ];
    const quality = measureRouteQuality(route, obstacles, occupied);
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
    if (!isOrthogonalPath(route)) {
      routeDiagnostics.push({
        code: "NON_ORTHOGONAL_PATH",
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
      });
    }
    if (!pathWithinBounds(route, config.routingBounds)) {
      routeDiagnostics.push({
        code: "PATH_OUT_OF_BOUNDS",
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
      });
    }
    occupied.push(...pathToSegments(route));
    const labelPosition = edge.label
      ? pickLabelPosition(route, edge.kind === "yes" ? "top" : "bottom")
      : undefined;

    const sourceSide = getRouteSide(route, from, true);
    const targetSide = getRouteSide(route, to, false);

    return {
      ...edge,
      points: route,
      routeKind: routeDiagnostics.length > 0 ? "fallback" : "automatic",
      sourceSide,
      targetSide,
      quality,
      ...(labelPosition ? { labelPosition } : {}),
      ...(routeDiagnostics.length > 0 ? { routeDiagnostics } : {}),
    };
  });

  const orderedRoutedEdges = model.edges.flatMap((edge) =>
    routedEdges.filter((routedEdge) => routedEdge.id === edge.id),
  );
  const routeDiagnostics = orderedRoutedEdges.flatMap(
    (edge) => edge.routeDiagnostics ?? [],
  );
  return {
    ...model,
    routedEdges: orderedRoutedEdges,
    diagnostics: [
      ...model.diagnostics,
      ...routeDiagnostics.filter(
        (diagnostic) =>
          !model.diagnostics.some(
            (existing) =>
              existing.code === diagnostic.code &&
              existing.edgeId === diagnostic.edgeId,
          ),
      ),
    ],
  };
}

function scoreRoutePlan(model: DiagramModel): number {
  return model.routedEdges.reduce((score, edge) => {
    if (edge.points.length < 2) return score + 1_000_000_000;
    const quality = edge.quality;
    if (!quality) return score + 500_000;

    return (
      score +
      quality.obstacleHits * 100_000 +
      quality.overlaps * 25_000 +
      quality.crossings * 10_000 +
      quality.bends * 120 +
      quality.length
    );
  }, 0);
}

function compareRoutingPriority(
  first: DiagramEdge,
  second: DiagramEdge,
  nodes: ReadonlyMap<string, DiagramNode>,
  order: "feedback-first" | "branch-first",
): number {
  const firstFrom = nodes.get(first.from);
  const firstTo = nodes.get(first.to);
  const secondFrom = nodes.get(second.from);
  const secondTo = nodes.get(second.to);
  const firstFeedback =
    firstFrom && firstTo && isBackEdge(firstFrom, firstTo) ? 0 : 1;
  const secondFeedback =
    secondFrom && secondTo && isBackEdge(secondFrom, secondTo) ? 0 : 1;
  if (order === "feedback-first" && firstFeedback !== secondFeedback) {
    return firstFeedback - secondFeedback;
  }

  const firstSpan =
    firstFrom && firstTo
      ? Math.abs(firstTo.position.y - firstFrom.position.y)
      : 0;
  const secondSpan =
    secondFrom && secondTo
      ? Math.abs(secondTo.position.y - secondFrom.position.y)
      : 0;
  if (firstSpan !== secondSpan) return secondSpan - firstSpan;

  const branchPriority = (kind: DiagramEdgeKind) =>
    kind === "yes" ? 0 : kind === "no" ? 1 : 2;
  const branchDifference =
    branchPriority(first.kind) - branchPriority(second.kind);
  if (order === "branch-first" && branchDifference !== 0) {
    return branchDifference;
  }
  if (order === "feedback-first" && branchDifference !== 0) {
    return branchDifference;
  }
  return first.id.localeCompare(second.id);
}

function getRouteSide(
  points: readonly DiagramPoint[],
  node: DiagramNode,
  source: boolean,
): "top" | "right" | "bottom" | "left" {
  const point = source ? points[0] : points.at(-1);
  if (!point) return "right";

  const rect = nodeRect(node);
  const distances = {
    top: Math.abs(point.y - rect.top),
    right: Math.abs(point.x - (rect.left + rect.width)),
    bottom: Math.abs(point.y - (rect.top + rect.height)),
    left: Math.abs(point.x - rect.left),
  };
  return (
    (
      Object.entries(distances) as Array<
        ["top" | "right" | "bottom" | "left", number]
      >
    ).sort((first, second) => first[1] - second[1])[0]?.[0] ?? "right"
  );
}

function resolveGap(value: number | undefined, fallback: number): number {
  const resolved = value ?? fallback;

  return Number.isFinite(resolved) ? Math.max(0, resolved) : fallback;
}

function topCenter(node: DiagramNode): DiagramPoint {
  return {
    x: node.position.x + node.size.width / 2,
    y: node.position.y,
  };
}

function bottomCenter(node: DiagramNode): DiagramPoint {
  return {
    x: node.position.x + node.size.width / 2,
    y: node.position.y + node.size.height,
  };
}

function rightCenter(node: DiagramNode): DiagramPoint {
  return {
    x: node.position.x + node.size.width,
    y: node.position.y + node.size.height / 2,
  };
}

function isBackEdge(from: DiagramNode, to: DiagramNode): boolean {
  return to.position.y <= from.position.y;
}

function routeForwardEdge(
  from: DiagramNode,
  to: DiagramNode,
  _kind: DiagramEdgeKind,
  options: RouteOptions,
  parallelIndex = 0,
): DiagramPoint[] {
  const start = bottomCenter(from);
  const end = topCenter(to);

  if (Math.abs(start.x - end.x) < 1 && parallelIndex === 0) {
    return [start, end];
  }

  const parallelOffset =
    parallelIndex === 0 ? 0 : parallelIndex % 2 === 1 ? -12 : 12;
  const middleY = start.y + Math.max(options.edgeGap, (end.y - start.y) / 2);

  return simplifyPoints([
    start,
    { x: start.x, y: middleY },
    { x: end.x + parallelOffset, y: middleY },
    { x: end.x + parallelOffset, y: end.y },
    end,
  ]);
}

interface RouteOptions {
  edgeGap: number;
  backEdgeGap: number;
  obstacleClearance: number;
  routingBounds: DiagramRect | undefined;
}

function nodeRect(node: DiagramNode): DiagramRect {
  return {
    left: node.position.x,
    top: node.position.y,
    width: node.size.width,
    height: node.size.height,
  };
}

function selectSafeRoute(
  candidates: readonly DiagramPoint[][],
  obstacles: readonly DiagramRect[],
  occupied: readonly RouteSegment[],
  bounds: DiagramRect | undefined,
  clearance: number,
): DiagramPoint[] | null {
  let best: DiagramPoint[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const route = compactOrthogonalPath(candidate);
    if (!pathWithinBounds(route, bounds)) continue;
    if (pathIntersectsRectangles(route, obstacles, clearance)) continue;
    if (
      pathOverlapsSegments(route, occupied, {
        includeCross: true,
        ignoreTerminalSegments: true,
      })
    ) {
      continue;
    }

    const score = scorePath(route, occupied);
    if (score < bestScore) {
      best = route;
      bestScore = score;
    }
  }

  return best;
}

function buildAlternativeRoutes(
  from: DiagramNode,
  to: DiagramNode,
  _kind: DiagramEdgeKind,
  options: RouteOptions,
  index: number,
): DiagramPoint[][] {
  if (from.id === to.id) {
    return [routeSelfEdge(from, index + 1, options)];
  }

  if (isBackEdge(from, to)) {
    const leftX =
      Math.min(from.position.x, to.position.x) -
      options.backEdgeGap -
      24 -
      index * options.edgeGap;
    const start = {
      x: from.position.x,
      y: from.position.y + from.size.height / 2,
    };
    const end = { x: to.position.x, y: to.position.y + to.size.height / 2 };
    return [[start, { x: leftX, y: start.y }, { x: leftX, y: end.y }, end]];
  }

  const start = bottomCenter(from);
  const end = topCenter(to);
  const middleY = start.y + Math.max(options.edgeGap, (end.y - start.y) / 2);
  const sideX =
    Math.max(from.position.x + from.size.width, to.position.x + to.size.width) +
    options.edgeGap;
  return [
    [start, { x: sideX, y: start.y }, { x: sideX, y: end.y }, end],
    [
      start,
      { x: start.x, y: middleY + options.edgeGap },
      { x: end.x, y: middleY + options.edgeGap },
      end,
    ],
  ];
}

function routeBackEdge(
  from: DiagramNode,
  to: DiagramNode,
  index: number,
  options: RouteOptions,
): DiagramPoint[] {
  if (from.id === to.id) {
    return routeSelfEdge(from, index, options);
  }

  const start = rightCenter(from);
  const end = rightCenter(to);
  const routeX =
    Math.max(from.position.x + from.size.width, to.position.x + to.size.width) +
    options.backEdgeGap +
    index * options.edgeGap;

  return simplifyPoints([
    start,
    { x: routeX, y: start.y },
    { x: routeX, y: end.y },
    end,
  ]);
}

function routeSelfEdge(
  node: DiagramNode,
  index: number,
  options: RouteOptions,
): DiagramPoint[] {
  const start = rightCenter(node);
  const loopOffset = Math.max(
    8,
    Math.min(options.backEdgeGap, Math.max(options.edgeGap, 8)),
  );
  const loopWidth = Math.max(8, Math.min(Math.max(options.edgeGap, 8), 24));
  const loopX = start.x + loopOffset + index * loopWidth;
  const outerX = loopX + loopWidth;
  const loopHeight = Math.max(12, Math.min(24, node.size.height / 2));
  const topY = node.position.y - loopHeight;
  const bottomY = node.position.y + node.size.height + loopHeight;

  return simplifyPoints([
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

function simplifyPoints(points: DiagramPoint[]): DiagramPoint[] {
  return compactOrthogonalPath(points);
}
