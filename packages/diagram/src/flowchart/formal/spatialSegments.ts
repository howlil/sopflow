import type { DiagramPoint } from "../../types.js";
import type { RouteSegment } from "../../routeGeometry.js";

const CELL_SIZE = 256;
const MAX_CELLS_PER_SEGMENT = 2048;

interface IndexedSegment {
  readonly ownerId: string;
  readonly segment: RouteSegment;
}

export interface RouteSegmentSpatialIndex {
  /** A conservative superset: no intersecting or overlapping segment is excluded. */
  nearby(ownerId: string, points: readonly DiagramPoint[]): RouteSegment[];
}

/**
 * Broad-phase uniform grid. Only reduces comparisons performed by route
 * scoring; the existing exact geometry predicates remain authoritative.
 * Very long paths/segments fall back to scanning instead of allocating an
 * unbounded number of grid cells.
 */
export function createRouteSegmentSpatialIndex(
  byOwner: ReadonlyMap<string, readonly RouteSegment[]>,
): RouteSegmentSpatialIndex {
  const indexed: IndexedSegment[] = [];
  const grid = new Map<string, number[]>();
  const overflow: number[] = [];

  for (const [ownerId, segments] of byOwner) {
    for (const segment of segments) {
      const id = indexed.length;
      indexed.push({ ownerId, segment });
      const bounds = segmentBounds(segment);
      const cells = gridExtent(bounds);
      if (!cells) {
        overflow.push(id);
        continue;
      }
      for (let x = cells.minX; x <= cells.maxX; x += 1) {
        for (let y = cells.minY; y <= cells.maxY; y += 1) {
          const key = `${x}:${y}`;
          const bucket = grid.get(key) ?? [];
          bucket.push(id);
          grid.set(key, bucket);
        }
      }
    }
  }

  return {
    nearby(ownerId, points) {
      if (points.length < 2) return [];
      const bounds = pointsBounds(points);
      const cells = bounds && gridExtent(bounds);
      if (!cells) {
        return indexed
          .filter((entry) => entry.ownerId !== ownerId)
          .map((entry) => entry.segment);
      }
      const found = new Set(overflow);
      for (let x = cells.minX; x <= cells.maxX; x += 1) {
        for (let y = cells.minY; y <= cells.maxY; y += 1) {
          for (const id of grid.get(`${x}:${y}`) ?? []) found.add(id);
        }
      }
      // Stable order makes diagnostics deterministic across rerenders.
      return [...found]
        .sort((left, right) => left - right)
        .filter((id) => indexed[id]?.ownerId !== ownerId)
        .map((id) => indexed[id]?.segment)
        .filter((segment): segment is RouteSegment => segment !== undefined);
    },
  };
}

interface Bounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

function segmentBounds(segment: RouteSegment): Bounds {
  return {
    left: Math.min(segment.x1, segment.x2),
    top: Math.min(segment.y1, segment.y2),
    right: Math.max(segment.x1, segment.x2),
    bottom: Math.max(segment.y1, segment.y2),
  };
}

function pointsBounds(points: readonly DiagramPoint[]): Bounds | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }
  return { left, top, right, bottom };
}

function gridExtent(bounds: Bounds) {
  const minX = Math.floor(bounds.left / CELL_SIZE);
  const maxX = Math.floor(bounds.right / CELL_SIZE);
  const minY = Math.floor(bounds.top / CELL_SIZE);
  const maxY = Math.floor(bounds.bottom / CELL_SIZE);
  const count = (maxX - minX + 1) * (maxY - minY + 1);
  if (!Number.isFinite(count) || count > MAX_CELLS_PER_SEGMENT || count <= 0) {
    return null;
  }
  return { minX, maxX, minY, maxY };
}
