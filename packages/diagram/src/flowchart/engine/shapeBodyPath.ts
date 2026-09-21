import {
  normalizeOrthogonalPath,
  pathIntersectsRectangles,
} from "./orthogonalRouter.js";
import type {
  FlowchartPoint as Point,
  FlowchartRect as Rect,
} from "./types.js";

const SHAPE_INTERIOR_INSET = 3

function shapeInteriorRect(rect: Rect, clearance: number): Rect | null {
  const inset = SHAPE_INTERIOR_INSET + clearance
  const width = Math.max(0, rect.width - inset * 2)
  const height = Math.max(0, rect.height - inset * 2)
  if (width <= 0 || height <= 0) return null
  return { left: rect.left + inset, top: rect.top + inset, width, height }
}

function pointInRectInterior(point: Point, rect: Rect, inset = 0): boolean {
  return (
    point.x > rect.left + inset &&
    point.x < rect.left + rect.width - inset &&
    point.y > rect.top + inset &&
    point.y < rect.top + rect.height - inset
  )
}

/** True bila ada segmen ortogonal yang memotong interior shape (termasuk from/to). */
export function pathCrossesShapeBodies(
  path: Point[],
  fromShape: Rect,
  toShape: Rect,
  obstacles: Rect[],
  clearance = 3,
): boolean {
  const normalized = normalizeOrthogonalPath(path.map((p) => ({ ...p })))
  if (normalized.length < 2) return false
  if (pathIntersectsRectangles(normalized, obstacles, clearance)) return true
  const fromInner = shapeInteriorRect(fromShape, clearance)
  const toInner = shapeInteriorRect(toShape, clearance)
  for (let i = 0; i < normalized.length - 1; i += 1) {
    const a = normalized[i]!
    const b = normalized[i + 1]!
    if (a.x !== b.x && a.y !== b.y) return true
    const isFirst = i === 0
    const isLast = i === normalized.length - 2
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    if (isFirst && isLast) {
      if (fromInner && pointInRectInterior(mid, fromInner)) return true
      if (toInner && pointInRectInterior(mid, toInner)) return true
      continue
    }
    if (isFirst) {
      if (fromInner && pointInRectInterior(mid, fromInner)) return true
      continue
    }
    if (isLast) {
      if (toInner && pointInRectInterior(mid, toInner)) return true
      continue
    }
    if (fromInner && pathIntersectsRectangles([a, b], [fromInner], 0)) return true
    if (toInner && pathIntersectsRectangles([a, b], [toInner], 0)) return true
  }
  return false
}
