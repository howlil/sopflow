import {
  distanceOnRectSide,
  extrudePoint,
  nearestRectSide,
  pointOnRectSide,
} from "../../routeAnchors.js";
import type { DiagramPoint } from "../../types.js";
import {
  formalPathIntersectsRectangles,
  formalPathOverlapsSegments,
  isFormalOrthogonalPath,
  normalizeFormalOrthogonalPath,
} from "./orthogonal.js";
import type {
  FormalFlowchartOccupiedSegment,
  FormalFlowchartRect,
  FormalFlowchartSide,
} from "./types.js";

const DEFAULT_GRID = 4;

export function snapFormalRouteValue(
  value: number,
  grid = DEFAULT_GRID,
): number {
  return Math.round(value / grid) * grid;
}

export function insertFormalRouteWaypointAtSegmentMidpoint(
  path: readonly DiagramPoint[],
  segmentIndex: number,
): DiagramPoint[] {
  if (path.length < 2 || segmentIndex < 0 || segmentIndex >= path.length - 1) {
    return path.map((point) => ({ ...point }));
  }

  const from = path[segmentIndex];
  const to = path[segmentIndex + 1];
  if (!from || !to) return path.map((point) => ({ ...point }));

  const midpoint = {
    x: snapFormalRouteValue((from.x + to.x) / 2),
    y: snapFormalRouteValue((from.y + to.y) / 2),
  };
  const next = path.map((point) => ({ ...point }));
  next.splice(segmentIndex + 1, 0, midpoint);

  return normalizeFormalOrthogonalPath(next, null, {
    preserveCollinear: true,
  });
}

export function removeFormalRouteWaypoint(
  path: readonly DiagramPoint[],
  index: number,
): DiagramPoint[] {
  if (path.length <= 2 || index <= 0 || index >= path.length - 1) {
    return path.map((point) => ({ ...point }));
  }

  return normalizeFormalOrthogonalPath(
    path.filter((_, pointIndex) => pointIndex !== index),
    null,
    { preserveCollinear: true },
  );
}

export function dragFormalRouteWaypointFromOrigin(
  originPath: readonly DiagramPoint[],
  index: number,
  dx: number,
  dy: number,
  options: { readonly normalize?: boolean } = {},
): DiagramPoint[] {
  if (index <= 0 || index >= originPath.length - 1) {
    return originPath.map((point) => ({ ...point }));
  }

  const next = originPath.map((point) => ({ ...point }));
  const current = next[index];
  const previous = next[index - 1];
  const following = next[index + 1];
  if (!current || !previous || !following) return next;

  let x = current.x + dx;
  let y = current.y + dy;

  const previousVertical = Math.abs(previous.x - current.x) < 1;
  const nextVertical = Math.abs(following.x - current.x) < 1;
  const previousHorizontal = Math.abs(previous.y - current.y) < 1;
  const nextHorizontal = Math.abs(following.y - current.y) < 1;

  if (previousVertical && nextVertical) {
    x = previous.x;
    y = snapFormalRouteValue(y);
  } else if (previousHorizontal && nextHorizontal) {
    x = snapFormalRouteValue(x);
    y = current.y;
  } else if (
    (previousHorizontal && nextVertical) ||
    (previousVertical && nextHorizontal)
  ) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      x = snapFormalRouteValue(x);
      y = current.y;
      if (previousVertical) previous.x = x;
      if (nextVertical) following.x = x;
    } else {
      y = snapFormalRouteValue(y);
      x = current.x;
      if (previousHorizontal) previous.y = y;
      if (nextHorizontal) following.y = y;
    }
  } else if (previousHorizontal || nextHorizontal) {
    x = snapFormalRouteValue(x);
    y = current.y;
  } else {
    x = current.x;
    y = snapFormalRouteValue(y);
  }

  next[index] = { x, y };

  return options.normalize === false
    ? next
    : normalizeFormalOrthogonalPath(next, null, {
        preserveCollinear: true,
      });
}

export function dragFormalRouteSegmentFromOrigin(
  originPath: readonly DiagramPoint[],
  segmentIndex: number,
  dx: number,
  dy: number,
  options: { readonly normalize?: boolean } = {},
): DiagramPoint[] {
  if (segmentIndex <= 0 || segmentIndex >= originPath.length - 2) {
    return originPath.map((point) => ({ ...point }));
  }

  const from = originPath[segmentIndex];
  const to = originPath[segmentIndex + 1];
  if (!from || !to) return originPath.map((point) => ({ ...point }));

  const horizontal = from.y === to.y && from.x !== to.x;
  const vertical = from.x === to.x && from.y !== to.y;
  if (!horizontal && !vertical) {
    return originPath.map((point) => ({ ...point }));
  }

  const next = originPath.map((point) => ({ ...point }));

  if (horizontal) {
    const y = snapFormalRouteValue(from.y + dy);
    next[segmentIndex] = { x: from.x, y };
    next[segmentIndex + 1] = { x: to.x, y };
  } else {
    const x = snapFormalRouteValue(from.x + dx);
    next[segmentIndex] = { x, y: from.y };
    next[segmentIndex + 1] = { x, y: to.y };
  }

  return options.normalize === false
    ? next
    : normalizeFormalOrthogonalPath(next, null, {
        preserveCollinear: true,
      });
}

export function findNearestFormalRouteSegmentIndex(
  path: readonly DiagramPoint[],
  x: number,
  y: number,
): number {
  if (path.length < 2) return -1;

  let bestIndex = 0;
  let bestDistance = Infinity;

  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    if (!from || !to) continue;

    const distance = pointToSegmentDistance(x, y, from.x, from.y, to.x, to.y);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)),
  );
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return Math.hypot(px - closestX, py - closestY);
}

export interface FormalRouteEndpoint {
  readonly point: DiagramPoint;
  readonly side: FormalFlowchartSide;
  readonly distance: number;
}

export interface FormalRouteChange {
  readonly startPoint: DiagramPoint;
  readonly endPoint: DiagramPoint;
  readonly bendPoints: readonly DiagramPoint[];
  readonly sourceSide: FormalFlowchartSide;
  readonly targetSide: FormalFlowchartSide;
  readonly sourceDistance?: number;
  readonly targetDistance?: number;
}

export type FormalManualRouteValidation =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly reason:
        | "NON_ORTHOGONAL"
        | "OUT_OF_BOUNDS"
        | "CROSSES_SHAPE"
        | "OVERLAPS_ROUTE"
        | "CROSSES_ROUTE"
        | "INVALID_ENDPOINT_DIRECTION";
    };

export function pointOnFormalShapeSide(
  rect: FormalFlowchartRect,
  side: FormalFlowchartSide,
  distance = 0.5,
): DiagramPoint {
  return pointOnRectSide(rect, side, distance);
}

export function distanceOnFormalShapeSide(
  rect: FormalFlowchartRect,
  side: FormalFlowchartSide,
  point: DiagramPoint,
): number {
  return distanceOnRectSide(rect, side, point);
}

export function resolveNearestFormalShapeSide(
  rect: FormalFlowchartRect,
  point: DiagramPoint,
): FormalFlowchartSide {
  return nearestRectSide(rect, point);
}

export function snapFormalEndpoint(
  rect: FormalFlowchartRect,
  point: DiagramPoint,
  options: {
    readonly diamond?: boolean;
    readonly centerThresholdPx?: number;
    readonly preferredSide?: FormalFlowchartSide;
    readonly sideHysteresisPx?: number;
  } = {},
): FormalRouteEndpoint {
  const nearestSide = resolveNearestFormalShapeSide(rect, point);
  const preferredSide = options.preferredSide;
  const hysteresis = Math.max(0, options.sideHysteresisPx ?? 8);
  const side =
    preferredSide &&
    distanceToFormalRectSide(rect, point, preferredSide) <=
      distanceToFormalRectSide(rect, point, nearestSide) + hysteresis
      ? preferredSide
      : nearestSide;

  if (options.diamond) {
    return {
      point: pointOnFormalShapeSide(rect, side, 0.5),
      side,
      distance: 0.5,
    };
  }

  const raw = Math.max(
    0.08,
    Math.min(0.92, distanceOnFormalShapeSide(rect, side, point)),
  );
  const sideLength =
    side === "top" || side === "bottom" ? rect.width : rect.height;
  const threshold = options.centerThresholdPx ?? 14;
  const distance =
    Math.abs(raw - 0.5) * Math.max(0, sideLength) <= threshold ? 0.5 : raw;

  return {
    point: pointOnFormalShapeSide(rect, side, distance),
    side,
    distance,
  };
}

export function rebuildFormalPathForEndpoint(
  path: readonly DiagramPoint[],
  kind: "start" | "end",
  endpoint: FormalRouteEndpoint,
): DiagramPoint[] {
  if (path.length < 2) return path.map((point) => ({ ...point }));

  const next = path.map((point) => ({ ...point }));
  const endpointIndex = kind === "start" ? 0 : next.length - 1;
  const adjacentIndex = kind === "start" ? 1 : next.length - 2;
  next[endpointIndex] = { ...endpoint.point };

  const adjacent = next[adjacentIndex];
  if (!adjacent) return next;

  if (endpoint.side === "left" || endpoint.side === "right") {
    next[adjacentIndex] = { x: adjacent.x, y: endpoint.point.y };
  } else {
    next[adjacentIndex] = { x: endpoint.point.x, y: adjacent.y };
  }

  return normalizeFormalOrthogonalPath(next, null, {
    preserveCollinear: true,
  });
}

export function repairFormalManualRoute(input: {
  readonly path: readonly DiagramPoint[];
  readonly sourceSide: FormalFlowchartSide;
  readonly targetSide: FormalFlowchartSide;
  readonly obstacles?: readonly FormalFlowchartRect[];
  readonly occupied?: readonly FormalFlowchartOccupiedSegment[];
  readonly bounds?: FormalFlowchartRect | null;
  readonly clearance?: number;
  readonly jetty?: number;
}): DiagramPoint[] | null {
  const {
    path,
    sourceSide,
    targetSide,
    obstacles = [],
    occupied = [],
    bounds = null,
    clearance = 2,
    jetty = 12,
  } = input;

  if (
    validateFormalManualRoute({
      path,
      sourceSide,
      targetSide,
      obstacles,
      occupied,
      bounds,
      clearance,
    }).valid
  ) {
    return path.map((point) => ({ ...point }));
  }

  const start = path[0];
  const end = path.at(-1);
  if (!start || !end) return null;

  const startJetty = extrudePoint(start, sourceSide, jetty);
  const endJetty = extrudePoint(end, targetSide, jetty);
  const detour = clearance + 6;
  const preferredX = (startJetty.x + endJetty.x) / 2;
  const preferredY = (startJetty.y + endJetty.y) / 2;
  const xCandidates = uniqueNumbers([
    preferredX,
    ...obstacles.flatMap((rect) => [
      rect.left - detour,
      rect.left + rect.width + detour,
    ]),
    ...occupied.flatMap((segment) => [
      segment.x1 - detour,
      segment.x1 + detour,
      segment.x2 - detour,
      segment.x2 + detour,
    ]),
    ...(bounds
      ? [bounds.left + detour, bounds.left + bounds.width - detour]
      : []),
  ]).sort(
    (left, right) => Math.abs(left - preferredX) - Math.abs(right - preferredX),
  );
  const yCandidates = uniqueNumbers([
    preferredY,
    ...obstacles.flatMap((rect) => [
      rect.top - detour,
      rect.top + rect.height + detour,
    ]),
    ...occupied.flatMap((segment) => [
      segment.y1 - detour,
      segment.y1 + detour,
      segment.y2 - detour,
      segment.y2 + detour,
    ]),
    ...(bounds
      ? [bounds.top + detour, bounds.top + bounds.height - detour]
      : []),
  ]).sort(
    (left, right) => Math.abs(left - preferredY) - Math.abs(right - preferredY),
  );

  const candidates: DiagramPoint[][] = [
    [start, startJetty, { x: endJetty.x, y: startJetty.y }, endJetty, end],
    [start, startJetty, { x: startJetty.x, y: endJetty.y }, endJetty, end],
    ...xCandidates.map((x) => [
      start,
      startJetty,
      { x, y: startJetty.y },
      { x, y: endJetty.y },
      endJetty,
      end,
    ]),
    ...yCandidates.map((y) => [
      start,
      startJetty,
      { x: startJetty.x, y },
      { x: endJetty.x, y },
      endJetty,
      end,
    ]),
  ].map((candidate) =>
    normalizeFormalOrthogonalPath(candidate, null, {
      preserveCollinear: true,
    }),
  );

  const validCandidates = candidates.filter(
    (candidate) =>
      validateFormalManualRoute({
        path: candidate,
        sourceSide,
        targetSide,
        obstacles,
        occupied,
        bounds,
        clearance,
      }).valid,
  );

  if (validCandidates.length === 0) return null;

  return (
    validCandidates.sort(
      (left, right) =>
        formalRepairScore(left, path) - formalRepairScore(right, path),
    )[0] ?? null
  );
}

function formalRepairScore(
  candidate: readonly DiagramPoint[],
  original: readonly DiagramPoint[],
): number {
  const routeLength = candidate.slice(1).reduce((total, point, index) => {
    const previous = candidate[index];
    return previous
      ? total + Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y)
      : total;
  }, 0);
  const bends = Math.max(0, candidate.length - 2);
  const originalInterior = original.slice(1, -1);
  const displacement = candidate.slice(1, -1).reduce((total, point) => {
    if (originalInterior.length === 0) return total;

    return (
      total +
      Math.min(
        ...originalInterior.map(
          (origin) =>
            Math.abs(point.x - origin.x) + Math.abs(point.y - origin.y),
        ),
      )
    );
  }, 0);

  return routeLength + bends * 24 + displacement * 0.25;
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [
    ...new Set(
      values.filter(Number.isFinite).map((value) => Math.round(value)),
    ),
  ];
}

export function formalRouteChangeFromPath(
  path: readonly DiagramPoint[],
  sourceSide: FormalFlowchartSide,
  targetSide: FormalFlowchartSide,
  anchorDistances: {
    readonly sourceDistance?: number;
    readonly targetDistance?: number;
  } = {},
): FormalRouteChange | null {
  const startPoint = path[0];
  const endPoint = path.at(-1);
  if (!startPoint || !endPoint) return null;

  return {
    startPoint: { ...startPoint },
    endPoint: { ...endPoint },
    bendPoints: path.slice(1, -1).map((point) => ({ ...point })),
    sourceSide,
    targetSide,
    ...(Number.isFinite(anchorDistances.sourceDistance)
      ? { sourceDistance: anchorDistances.sourceDistance }
      : {}),
    ...(Number.isFinite(anchorDistances.targetDistance)
      ? { targetDistance: anchorDistances.targetDistance }
      : {}),
  };
}

export function validateFormalManualRoute(input: {
  readonly path: readonly DiagramPoint[];
  readonly sourceSide: FormalFlowchartSide;
  readonly targetSide: FormalFlowchartSide;
  readonly obstacles?: readonly FormalFlowchartRect[];
  readonly occupied?: readonly FormalFlowchartOccupiedSegment[];
  readonly bounds?: FormalFlowchartRect | null;
  readonly clearance?: number;
}): FormalManualRouteValidation {
  const {
    path,
    sourceSide,
    targetSide,
    obstacles = [],
    occupied = [],
    bounds = null,
    clearance = 2,
  } = input;

  if (!isFormalOrthogonalPath(path)) {
    return { valid: false, reason: "NON_ORTHOGONAL" };
  }

  if (
    bounds &&
    path.some(
      (point) =>
        point.x < bounds.left ||
        point.x > bounds.left + bounds.width ||
        point.y < bounds.top ||
        point.y > bounds.top + bounds.height,
    )
  ) {
    return { valid: false, reason: "OUT_OF_BOUNDS" };
  }

  if (formalPathIntersectsRectangles(path, obstacles, clearance)) {
    return { valid: false, reason: "CROSSES_SHAPE" };
  }

  if (formalPathOverlapsSegments(path, occupied, false)) {
    return { valid: false, reason: "OVERLAPS_ROUTE" };
  }

  if (formalPathOverlapsSegments(path, occupied, true)) {
    return { valid: false, reason: "CROSSES_ROUTE" };
  }

  const start = path[0];
  const afterStart = path[1];
  const beforeEnd = path.at(-2);
  const end = path.at(-1);
  if (
    !start ||
    !afterStart ||
    !beforeEnd ||
    !end ||
    !endpointDirectionValid(start, afterStart, sourceSide) ||
    !endpointDirectionValid(end, beforeEnd, targetSide)
  ) {
    return { valid: false, reason: "INVALID_ENDPOINT_DIRECTION" };
  }

  return { valid: true };
}

function distanceToFormalRectSide(
  rect: FormalFlowchartRect,
  point: DiagramPoint,
  side: FormalFlowchartSide,
): number {
  switch (side) {
    case "top":
      return Math.abs(point.y - rect.top);
    case "right":
      return Math.abs(point.x - (rect.left + rect.width));
    case "bottom":
      return Math.abs(point.y - (rect.top + rect.height));
    case "left":
      return Math.abs(point.x - rect.left);
  }
}

function endpointDirectionValid(
  endpoint: DiagramPoint,
  adjacent: DiagramPoint,
  side: FormalFlowchartSide,
): boolean {
  switch (side) {
    case "top":
      return adjacent.y <= endpoint.y;
    case "right":
      return adjacent.x >= endpoint.x;
    case "bottom":
      return adjacent.y >= endpoint.y;
    case "left":
      return adjacent.x <= endpoint.x;
  }
}
