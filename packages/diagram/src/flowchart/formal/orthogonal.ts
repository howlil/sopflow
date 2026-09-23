import type { DiagramPoint } from "../../types.js";
import type {
  FormalFlowchartOccupiedSegment,
  FormalFlowchartRect,
  FormalFlowchartSide,
} from "./types.js";

export interface FormalConnectorPoint {
  readonly shape: FormalFlowchartRect;
  readonly side: FormalFlowchartSide;
  readonly distance: number;
}

export interface FormalOrthogonalRouteOptions {
  readonly source: FormalConnectorPoint;
  readonly target: FormalConnectorPoint;
  readonly obstacles?: readonly FormalFlowchartRect[];
  readonly shapeMargin?: number;
  readonly bounds?: FormalFlowchartRect | null;
  readonly boundsMargin?: number;
  readonly occupied?: readonly FormalFlowchartOccupiedSegment[];
  readonly sourceJetty?: number;
  readonly targetJetty?: number;
  readonly lShapeOnly?: boolean;
}

function rangesOverlap(
  a1: number,
  a2: number,
  b1: number,
  b2: number,
): boolean {
  const aMin = Math.min(a1, a2);
  const aMax = Math.max(a1, a2);
  const bMin = Math.min(b1, b2);
  const bMax = Math.max(b1, b2);
  return aMin < bMax && bMin < aMax;
}

export function formalSegmentsOverlap(
  a: FormalFlowchartOccupiedSegment,
  b: FormalFlowchartOccupiedSegment,
): boolean {
  if (a.y1 === a.y2 && b.y1 === b.y2 && a.y1 === b.y1) {
    return rangesOverlap(a.x1, a.x2, b.x1, b.x2);
  }

  if (a.x1 === a.x2 && b.x1 === b.x2 && a.x1 === b.x1) {
    return rangesOverlap(a.y1, a.y2, b.y1, b.y2);
  }

  return false;
}

export function formalSegmentsCross(
  a: FormalFlowchartOccupiedSegment,
  b: FormalFlowchartOccupiedSegment,
): boolean {
  if (a.y1 === a.y2 && b.x1 === b.x2) {
    const x = b.x1;
    const y = a.y1;
    return (
      x > Math.min(a.x1, a.x2) &&
      x < Math.max(a.x1, a.x2) &&
      y > Math.min(b.y1, b.y2) &&
      y < Math.max(b.y1, b.y2)
    );
  }

  if (a.x1 === a.x2 && b.y1 === b.y2) {
    const x = a.x1;
    const y = b.y1;
    return (
      y > Math.min(a.y1, a.y2) &&
      y < Math.max(a.y1, a.y2) &&
      x > Math.min(b.x1, b.x2) &&
      x < Math.max(b.x1, b.x2)
    );
  }

  return false;
}

function segmentsNearby(
  a: FormalFlowchartOccupiedSegment,
  b: FormalFlowchartOccupiedSegment,
  threshold: number,
): boolean {
  if (
    a.y1 === a.y2 &&
    b.y1 === b.y2 &&
    a.y1 !== b.y1 &&
    Math.abs(a.y1 - b.y1) <= threshold
  ) {
    return rangesOverlap(a.x1, a.x2, b.x1, b.x2);
  }

  if (
    a.x1 === a.x2 &&
    b.x1 === b.x2 &&
    a.x1 !== b.x1 &&
    Math.abs(a.x1 - b.x1) <= threshold
  ) {
    return rangesOverlap(a.y1, a.y2, b.y1, b.y2);
  }

  return false;
}

export function isFormalOrthogonalPath(path: readonly DiagramPoint[]): boolean {
  if (path.length < 2) return false;

  for (let index = 0; index < path.length - 1; index += 1) {
    const a = path[index];
    const b = path[index + 1];
    if (!a || !b) return false;
    if (a.x !== b.x && a.y !== b.y) return false;
  }

  return true;
}

function pointInRect(point: DiagramPoint, rect: FormalFlowchartRect): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  );
}

function chooseElbow(
  from: DiagramPoint,
  to: DiagramPoint,
  bounds: FormalFlowchartRect | null | undefined,
): DiagramPoint {
  const candidates = [
    { x: from.x, y: to.y },
    { x: to.x, y: from.y },
  ];

  if (!bounds) return candidates[0] as DiagramPoint;

  return candidates
    .map((candidate, index) => ({
      candidate,
      score: (pointInRect(candidate, bounds) ? 0 : 10_000) + index,
    }))
    .sort((a, b) => a.score - b.score)[0]?.candidate as DiagramPoint;
}

export function normalizeFormalOrthogonalPath(
  input: readonly DiagramPoint[],
  bounds: FormalFlowchartRect | null = null,
  options: { readonly preserveCollinear?: boolean } = {},
): DiagramPoint[] {
  if (input.length === 0) return [];

  const deduped: DiagramPoint[] = [];
  for (const point of input) {
    const next = { x: Math.round(point.x), y: Math.round(point.y) };
    const previous = deduped.at(-1);
    if (!previous || previous.x !== next.x || previous.y !== next.y) {
      deduped.push(next);
    }
  }

  if (deduped.length <= 1) return deduped;

  const expanded: DiagramPoint[] = [deduped[0] as DiagramPoint];

  for (let index = 0; index < deduped.length - 1; index += 1) {
    const from = expanded.at(-1);
    const to = deduped[index + 1];
    if (!from || !to) continue;

    if (from.x !== to.x && from.y !== to.y) {
      const elbow = chooseElbow(from, to, bounds);
      if (from.x !== elbow.x || from.y !== elbow.y) expanded.push(elbow);
    }

    expanded.push({ ...to });
  }

  if (expanded.length <= 2 || options.preserveCollinear) return expanded;

  const compact: DiagramPoint[] = [expanded[0] as DiagramPoint];

  for (let index = 1; index < expanded.length - 1; index += 1) {
    const previous = compact.at(-1);
    const current = expanded[index];
    const next = expanded[index + 1];
    if (!previous || !current || !next) continue;

    const collinear =
      (previous.x === current.x && current.x === next.x) ||
      (previous.y === current.y && current.y === next.y);

    if (!collinear) compact.push(current);
  }

  compact.push(expanded.at(-1) as DiagramPoint);
  return compact;
}

function edgeClear(
  from: DiagramPoint,
  to: DiagramPoint,
  obstacles: readonly FormalFlowchartRect[],
): boolean {
  if (from.x === to.x) {
    const y1 = Math.min(from.y, to.y);
    const y2 = Math.max(from.y, to.y);

    return !obstacles.some(
      (obstacle) =>
        from.x > obstacle.left &&
        from.x < obstacle.left + obstacle.width &&
        obstacle.top < y2 &&
        obstacle.top + obstacle.height > y1,
    );
  }

  if (from.y === to.y) {
    const x1 = Math.min(from.x, to.x);
    const x2 = Math.max(from.x, to.x);

    return !obstacles.some(
      (obstacle) =>
        from.y > obstacle.top &&
        from.y < obstacle.top + obstacle.height &&
        obstacle.left < x2 &&
        obstacle.left + obstacle.width > x1,
    );
  }

  return false;
}

export function formalPathIntersectsRectangles(
  path: readonly DiagramPoint[],
  rectangles: readonly FormalFlowchartRect[],
  clearance = 0,
): boolean {
  if (rectangles.length === 0) return false;

  const obstacles = rectangles.map((rect) => ({
    left: rect.left - clearance,
    top: rect.top - clearance,
    width: rect.width + clearance * 2,
    height: rect.height + clearance * 2,
  }));

  const normalized = normalizeFormalOrthogonalPath(path);
  if (!isFormalOrthogonalPath(normalized)) return true;

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const from = normalized[index];
    const to = normalized[index + 1];
    if (!from || !to || !edgeClear(from, to, obstacles)) return true;
  }

  return false;
}

export function formalPathOverlapsSegments(
  path: readonly DiagramPoint[],
  occupied: readonly FormalFlowchartOccupiedSegment[],
  includeCross = false,
): boolean {
  const normalized = normalizeFormalOrthogonalPath(path);

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const from = normalized[index];
    const to = normalized[index + 1];
    if (!from || !to) continue;

    const segment = {
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
    };

    for (const used of occupied) {
      if (formalSegmentsOverlap(segment, used)) return true;
      if (includeCross && formalSegmentsCross(segment, used)) return true;
    }
  }

  return false;
}

export function formalPathToSegments(
  path: readonly DiagramPoint[],
): FormalFlowchartOccupiedSegment[] {
  const normalized = normalizeFormalOrthogonalPath(path);
  const segments: FormalFlowchartOccupiedSegment[] = [];

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const from = normalized[index];
    const to = normalized[index + 1];
    if (!from || !to) continue;

    segments.push({
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
    });
  }

  return segments;
}

const OVERLAP_PENALTY = 8_000;
const CROSS_PENALTY = 12_000;
const NEAR_PENALTY = 600;
const NEAR_THRESHOLD = 12;

export function scoreFormalPath(
  path: readonly DiagramPoint[],
  occupied: readonly FormalFlowchartOccupiedSegment[],
): number {
  const normalized = normalizeFormalOrthogonalPath(path);
  if (!isFormalOrthogonalPath(normalized)) return Infinity;

  let score = 0;
  let previousAxis: "h" | "v" | null = null;

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const from = normalized[index];
    const to = normalized[index + 1];
    if (!from || !to) continue;

    const segment = {
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
    };
    const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    score += length;

    const axis = from.y === to.y ? "h" : "v";
    if (previousAxis && axis !== previousAxis) score += 360;
    previousAxis = axis;

    if (length > 0 && length < 14) score += 35;

    for (const used of occupied) {
      if (formalSegmentsOverlap(segment, used)) score += OVERLAP_PENALTY;
      else if (formalSegmentsCross(segment, used)) score += CROSS_PENALTY;
      else if (segmentsNearby(segment, used, NEAR_THRESHOLD))
        score += NEAR_PENALTY;
    }
  }

  score += Math.max(0, normalized.length - 2) * 180;
  return score;
}

function pointOnRect(connector: FormalConnectorPoint): DiagramPoint {
  const distance = Math.max(0, Math.min(1, connector.distance));
  const shape = connector.shape;

  switch (connector.side) {
    case "top":
      return {
        x: Math.round(shape.left + shape.width * distance),
        y: Math.round(shape.top),
      };
    case "bottom":
      return {
        x: Math.round(shape.left + shape.width * distance),
        y: Math.round(shape.top + shape.height),
      };
    case "left":
      return {
        x: Math.round(shape.left),
        y: Math.round(shape.top + shape.height * distance),
      };
    case "right":
      return {
        x: Math.round(shape.left + shape.width),
        y: Math.round(shape.top + shape.height * distance),
      };
  }
}

function extrudeRect(
  connector: FormalConnectorPoint,
  margin: number,
): DiagramPoint {
  const point = pointOnRect(connector);

  switch (connector.side) {
    case "top":
      return { x: point.x, y: point.y - margin };
    case "bottom":
      return { x: point.x, y: point.y + margin };
    case "left":
      return { x: point.x - margin, y: point.y };
    case "right":
      return { x: point.x + margin, y: point.y };
  }
}

export function routeFormalOrthogonal(
  options: FormalOrthogonalRouteOptions,
): DiagramPoint[] {
  const {
    source,
    target,
    obstacles = [],
    shapeMargin = 10,
    bounds: globalBounds = null,
    boundsMargin = 20,
    occupied = [],
    sourceJetty = shapeMargin,
    targetJetty = shapeMargin,
    lShapeOnly = false,
  } = options;

  const start = pointOnRect(source);
  const end = pointOnRect(target);
  const sourceExit = extrudeRect(source, sourceJetty);
  const targetEntry = extrudeRect(target, targetJetty);

  const inflated = obstacles.map((obstacle) => ({
    left: obstacle.left - shapeMargin,
    top: obstacle.top - shapeMargin,
    width: obstacle.width + shapeMargin * 2,
    height: obstacle.height + shapeMargin * 2,
  }));

  const bounds =
    globalBounds ??
    ({
      left: Math.min(source.shape.left, target.shape.left) - boundsMargin,
      top: Math.min(source.shape.top, target.shape.top) - boundsMargin,
      width:
        Math.abs(target.shape.left - source.shape.left) +
        Math.max(source.shape.width, target.shape.width) +
        boundsMargin * 2,
      height:
        Math.abs(target.shape.top - source.shape.top) +
        Math.max(source.shape.height, target.shape.height) +
        boundsMargin * 2,
    } satisfies FormalFlowchartRect);

  const usable = (raw: readonly DiagramPoint[]): DiagramPoint[] | null => {
    const normalized = normalizeFormalOrthogonalPath(raw, bounds);
    if (!isFormalOrthogonalPath(normalized)) return null;
    if (formalPathIntersectsRectangles(normalized, inflated, 2)) return null;
    if (formalPathOverlapsSegments(normalized, occupied)) return null;
    return normalized;
  };

  const chooseBest = (
    candidates: readonly (readonly DiagramPoint[])[],
  ): DiagramPoint[] | null => {
    let best: DiagramPoint[] | null = null;
    let bestScore = Infinity;

    for (const candidate of candidates) {
      const path = usable(candidate);
      if (!path) continue;

      const score = scoreFormalPath(path, occupied);
      if (score < bestScore) {
        best = path;
        bestScore = score;
      }
    }

    return best;
  };

  const direct = chooseBest([
    [
      start,
      sourceExit,
      { x: sourceExit.x, y: targetEntry.y },
      targetEntry,
      end,
    ],
    [
      start,
      sourceExit,
      { x: targetEntry.x, y: sourceExit.y },
      targetEntry,
      end,
    ],
  ]);
  if (direct) return direct;
  if (lShapeOnly) return [];

  const sourceVertical = source.side === "top" || source.side === "bottom";
  const targetVertical = target.side === "top" || target.side === "bottom";

  if (sourceVertical && targetVertical) {
    const midY = Math.round((sourceExit.y + targetEntry.y) / 2);
    const path = usable([
      start,
      sourceExit,
      { x: sourceExit.x, y: midY },
      { x: targetEntry.x, y: midY },
      targetEntry,
      end,
    ]);
    if (path) return path;
  }

  if (!sourceVertical && !targetVertical) {
    const midX = Math.round((sourceExit.x + targetEntry.x) / 2);
    const path = usable([
      start,
      sourceExit,
      { x: midX, y: sourceExit.y },
      { x: midX, y: targetEntry.y },
      targetEntry,
      end,
    ]);
    if (path) return path;
  }

  const left = bounds.left + 4;
  const right = bounds.left + bounds.width - 4;
  const top = bounds.top + 4;
  const bottom = bounds.top + bounds.height - 4;

  if (!sourceVertical && !targetVertical) {
    const path = chooseBest(
      [left, right].map((x) => [
        start,
        sourceExit,
        { x, y: sourceExit.y },
        { x, y: targetEntry.y },
        targetEntry,
        end,
      ]),
    );
    if (path) return path;
  }

  if (sourceVertical && targetVertical) {
    const path = chooseBest(
      [top, bottom].map((y) => [
        start,
        sourceExit,
        { x: sourceExit.x, y },
        { x: targetEntry.x, y },
        targetEntry,
        end,
      ]),
    );
    if (path) return path;
  }

  return (
    chooseBest([
      [
        start,
        sourceExit,
        { x: sourceExit.x, y: targetEntry.y },
        targetEntry,
        end,
      ],
      [
        start,
        sourceExit,
        { x: targetEntry.x, y: sourceExit.y },
        targetEntry,
        end,
      ],
    ]) ??
    normalizeFormalOrthogonalPath([
      start,
      sourceExit,
      { x: sourceExit.x, y: targetEntry.y },
      targetEntry,
      end,
    ])
  );
}
