import type { DiagramPoint } from "../../types.js";
import { normalizeFormalOrthogonalPath } from "./orthogonal.js";

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
  if (
    path.length < 2 ||
    segmentIndex < 0 ||
    segmentIndex >= path.length - 1
  ) {
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
  if (
    segmentIndex <= 0 ||
    segmentIndex >= originPath.length - 2
  ) {
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

    const distance = pointToSegmentDistance(
      x,
      y,
      from.x,
      from.y,
      to.x,
      to.y,
    );

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
