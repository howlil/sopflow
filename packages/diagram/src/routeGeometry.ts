import type {
  DiagramPoint,
  DiagramRouteQuality,
  DiagramSide,
} from "./types.js";

export interface DiagramRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface RouteSegment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export function isFinitePoint(point: DiagramPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function isOrthogonalPath(points: readonly DiagramPoint[]): boolean {
  if (points.length < 2) return false;

  return points.every((point, index) => {
    if (!isFinitePoint(point) || index === 0) return true;
    const previous = points[index - 1];
    return (
      previous !== undefined &&
      (previous.x === point.x || previous.y === point.y)
    );
  });
}

export function compactOrthogonalPath(
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

function inflatedRect(rect: DiagramRect, clearance: number): DiagramRect {
  return {
    left: rect.left - clearance,
    top: rect.top - clearance,
    width: rect.width + clearance * 2,
    height: rect.height + clearance * 2,
  };
}

function segmentHitsRect(segment: RouteSegment, rect: DiagramRect): boolean {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;

  if (segment.x1 === segment.x2) {
    const yMin = Math.min(segment.y1, segment.y2);
    const yMax = Math.max(segment.y1, segment.y2);
    return (
      segment.x1 > rect.left &&
      segment.x1 < right &&
      rect.top < yMax &&
      bottom > yMin
    );
  }

  if (segment.y1 === segment.y2) {
    const xMin = Math.min(segment.x1, segment.x2);
    const xMax = Math.max(segment.x1, segment.x2);
    return (
      segment.y1 > rect.top &&
      segment.y1 < bottom &&
      rect.left < xMax &&
      right > xMin
    );
  }

  return true;
}

export function pathIntersectsRectangles(
  points: readonly DiagramPoint[],
  rectangles: readonly DiagramRect[],
  clearance = 0,
): boolean {
  if (!isOrthogonalPath(points)) return true;
  const obstacles = rectangles.map((rect) => inflatedRect(rect, clearance));

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) return true;

    const segment = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
    if (obstacles.some((obstacle) => segmentHitsRect(segment, obstacle))) {
      return true;
    }
  }

  return false;
}

export function pathWithinBounds(
  points: readonly DiagramPoint[],
  bounds: DiagramRect | undefined,
): boolean {
  if (!bounds) return true;
  const right = bounds.left + bounds.width;
  const bottom = bounds.top + bounds.height;

  return points.every(
    (point) =>
      isFinitePoint(point) &&
      point.x >= bounds.left &&
      point.x <= right &&
      point.y >= bounds.top &&
      point.y <= bottom,
  );
}

function rangesOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): boolean {
  return (
    Math.min(firstStart, firstEnd) < Math.max(secondStart, secondEnd) &&
    Math.min(secondStart, secondEnd) < Math.max(firstStart, firstEnd)
  );
}

export function segmentsOverlap(
  first: RouteSegment,
  second: RouteSegment,
): boolean {
  if (first.y1 === first.y2 && second.y1 === second.y2) {
    return (
      first.y1 === second.y1 &&
      rangesOverlap(first.x1, first.x2, second.x1, second.x2)
    );
  }

  if (first.x1 === first.x2 && second.x1 === second.x2) {
    return (
      first.x1 === second.x1 &&
      rangesOverlap(first.y1, first.y2, second.y1, second.y2)
    );
  }

  return false;
}

export function segmentsCross(
  first: RouteSegment,
  second: RouteSegment,
): boolean {
  const firstHorizontal = first.y1 === first.y2;
  const secondHorizontal = second.y1 === second.y2;

  if (firstHorizontal && !secondHorizontal) {
    return (
      second.x1 > Math.min(first.x1, first.x2) &&
      second.x1 < Math.max(first.x1, first.x2) &&
      first.y1 > Math.min(second.y1, second.y2) &&
      first.y1 < Math.max(second.y1, second.y2)
    );
  }

  if (!firstHorizontal && secondHorizontal) {
    return segmentsCross(second, first);
  }

  return false;
}

export function segmentsNearby(
  first: RouteSegment,
  second: RouteSegment,
  threshold: number,
): boolean {
  if (first.y1 === first.y2 && second.y1 === second.y2) {
    return (
      first.y1 !== second.y1 &&
      Math.abs(first.y1 - second.y1) <= threshold &&
      rangesOverlap(first.x1, first.x2, second.x1, second.x2)
    );
  }

  if (first.x1 === first.x2 && second.x1 === second.x2) {
    return (
      first.x1 !== second.x1 &&
      Math.abs(first.x1 - second.x1) <= threshold &&
      rangesOverlap(first.y1, first.y2, second.y1, second.y2)
    );
  }

  return false;
}

export function pathToSegments(
  points: readonly DiagramPoint[],
): RouteSegment[] {
  const normalized = compactOrthogonalPath(points);
  return normalized.slice(0, -1).flatMap((from, index) => {
    const to = normalized[index + 1];
    return to ? [{ x1: from.x, y1: from.y, x2: to.x, y2: to.y }] : [];
  });
}

export function pathOverlapsSegments(
  points: readonly DiagramPoint[],
  occupied: readonly RouteSegment[],
  options: {
    includeCross?: boolean;
    nearbyThreshold?: number;
    ignoreTerminalSegments?: boolean;
  } = {},
): boolean {
  const allSegments = pathToSegments(points);
  const segments = options.ignoreTerminalSegments
    ? allSegments.slice(1, -1)
    : allSegments;
  const includeCross = options.includeCross ?? false;
  const nearbyThreshold = options.nearbyThreshold ?? 0;

  return segments.some((segment) =>
    occupied.some(
      (other) =>
        segmentsOverlap(segment, other) ||
        (includeCross && segmentsCross(segment, other)) ||
        (nearbyThreshold > 0 &&
          segmentsNearby(segment, other, nearbyThreshold)),
    ),
  );
}

function countBends(points: readonly DiagramPoint[]): number {
  let bends = 0;
  let previousAxis: "horizontal" | "vertical" | null = null;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to || (from.x === to.x && from.y === to.y)) continue;

    const axis = from.x === to.x ? "vertical" : "horizontal";
    if (previousAxis && previousAxis !== axis) bends += 1;
    previousAxis = axis;
  }

  return bends;
}

export function scoreRouteDirectness(
  points: readonly DiagramPoint[],
): number {
  const start = points[0];
  const end = points.at(-1);
  if (!start || !end || points.length < 2) return 0;

  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const xDirection = Math.sign(end.x - start.x);
  const yDirection = Math.sign(end.y - start.y);
  let backtracking = 0;
  let overshoot = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) continue;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (xDirection !== 0 && Math.sign(dx) === -xDirection) {
      backtracking += Math.abs(dx);
    }
    if (yDirection !== 0 && Math.sign(dy) === -yDirection) {
      backtracking += Math.abs(dy);
    }
  }

  for (const point of points.slice(1, -1)) {
    overshoot +=
      Math.max(0, minX - point.x) +
      Math.max(0, point.x - maxX) +
      Math.max(0, minY - point.y) +
      Math.max(0, point.y - maxY);
  }

  return backtracking + overshoot * 0.5;
}

export function scorePath(
  points: readonly DiagramPoint[],
  occupied: readonly RouteSegment[] = [],
): number {
  if (!isOrthogonalPath(points)) return Number.POSITIVE_INFINITY;

  const segments = pathToSegments(points);
  let score = 0;
  for (const segment of segments) {
    score +=
      Math.abs(segment.x2 - segment.x1) + Math.abs(segment.y2 - segment.y1);
    for (const other of occupied) {
      if (segmentsOverlap(segment, other)) score += 100_000;
      else if (segmentsCross(segment, other)) score += 10_000;
      else if (segmentsNearby(segment, other, 12)) score += 500;
    }
  }

  return (
    score +
    countBends(points) * 240 +
    Math.max(0, points.length - 2) * 80 +
    scoreRouteDirectness(points) * 2
  );
}

export function measureRouteQuality(
  points: readonly DiagramPoint[],
  obstacles: readonly DiagramRect[] = [],
  occupied: readonly RouteSegment[] = [],
): DiagramRouteQuality {
  const segments = pathToSegments(points);
  const obstacleHits = pathIntersectsRectangles(points, obstacles) ? 1 : 0;
  let overlaps = 0;
  let crossings = 0;

  for (const segment of segments) {
    for (const other of occupied) {
      if (segmentsOverlap(segment, other)) overlaps += 1;
      else if (segmentsCross(segment, other)) crossings += 1;
    }
  }

  return {
    length: segments.reduce(
      (total, segment) =>
        total +
        Math.abs(segment.x2 - segment.x1) +
        Math.abs(segment.y2 - segment.y1),
      0,
    ),
    bends: countBends(points),
    obstacleHits,
    overlaps,
    crossings,
  };
}

export function pickLabelPosition(
  points: readonly DiagramPoint[],
  side: DiagramSide = "right",
  offset = 8,
): DiagramPoint | undefined {
  let best: RouteSegment | undefined;
  let bestLength = -1;

  for (const segment of pathToSegments(points)) {
    const length =
      Math.abs(segment.x2 - segment.x1) + Math.abs(segment.y2 - segment.y1);
    if (length > bestLength) {
      best = segment;
      bestLength = length;
    }
  }

  if (!best || bestLength <= 0) return undefined;
  const center = { x: (best.x1 + best.x2) / 2, y: (best.y1 + best.y2) / 2 };

  if (best.y1 === best.y2) {
    return { x: center.x, y: center.y + (side === "top" ? -offset : offset) };
  }

  return { x: center.x + (side === "left" ? -offset : offset), y: center.y };
}
