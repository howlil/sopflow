import type {
  FlowchartOccupiedSegment as OccupiedSegment,
  FlowchartPoint as Point,
  FlowchartPortConstraint as PortConstraint,
  FlowchartRect as Rect,
  FlowchartSide as Side,
} from "./types.js";
import {
  assertOrthogonalPath,
  isOrthogonalPath,
  manhattanDistance,
  normalizeOrthogonalPath,
  simplifyOrthogonalPath,
} from "./orthogonalPath.js";

export type { FlowchartSide as Side } from "./types.js";
export {
  assertOrthogonalPath,
  isOrthogonalPath,
  normalizeOrthogonalPath,
} from "./orthogonalPath.js";

/**
 * Orthogonal Router v4 — Direct Geometry Router
 *
 * Menggantikan A* + grid builder dengan strategi geometri langsung:
 *   1. L-shape  : 1 bend
 *   2. Z-shape  : 2 bends (melalui midpoint)
 *   3. U-shape  : loop-back (exit lalu putar melalui jalur samping)
 *
 * Performa: O(1) per arrow (tidak ada grid, tidak ada A*, tidak ada heap).
 * Tetap mendukung overlap-avoidance via OccupiedSegment.
 */

export interface ConnectorPoint {
  shape: Rect
  side: Side
  /** Normalised position along side (0-1). Always 0.5 = center. */
  distance: number
}

export type {
  FlowchartOccupiedSegment as OccupiedSegment,
  FlowchartPoint as Point,
  FlowchartPortConstraint as PortConstraint,
  FlowchartRect as Rect,
} from "./types.js";

export interface RouteOptions {
  pointA: ConnectorPoint
  pointB: ConnectorPoint
  obstacles?: Rect[]
  shapeMargin?: number
  globalBounds?: Rect
  globalBoundsMargin?: number
  occupiedSegments?: OccupiedSegment[]
  sourcePort?: PortConstraint
  targetPort?: PortConstraint
  jettySize?: number
  sourceJettySize?: number
  targetJettySize?: number
  preferSimple?: boolean
  /** Flowchart planning pass: return only a safe direct L path, without detours. */
  lShapeOnly?: boolean
}

/* ── Kept for consumers (CellInfo/CorridorGraph stubs — no-op) ── */

export interface CellInfo {
  row: number
  col: number
  rect: Rect
  center: Point
  occupied: boolean
  shapeRect?: Rect
}

/** Stub — corridor graph no longer used; kept for API compat. */
export interface CorridorGraph {
  spots: Point[]
  adj: Map<string, { to: Point; dist: number }[]>
  shapeObs: { l: number; t: number; w: number; h: number; r: number; b: number }[]
}

/* ── Segment helpers ──────────────────────────────────────────── */

function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  const aMin = Math.min(a1, a2), aMax = Math.max(a1, a2)
  const bMin = Math.min(b1, b2), bMax = Math.max(b1, b2)
  return aMin < bMax && bMin < aMax
}

export function segmentsOverlap(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: OccupiedSegment,
): boolean {
  if (a.y1 === a.y2 && b.y1 === b.y2 && a.y1 === b.y1)
    return rangesOverlap(a.x1, a.x2, b.x1, b.x2)
  if (a.x1 === a.x2 && b.x1 === b.x2 && a.x1 === b.x1)
    return rangesOverlap(a.y1, a.y2, b.y1, b.y2)
  return false
}

export function segmentsNearby(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: OccupiedSegment,
  threshold: number,
): boolean {
  if (a.y1 === a.y2 && b.y1 === b.y2 && a.y1 !== b.y1 && Math.abs(a.y1 - b.y1) <= threshold)
    return rangesOverlap(a.x1, a.x2, b.x1, b.x2)
  if (a.x1 === a.x2 && b.x1 === b.x2 && a.x1 !== b.x1 && Math.abs(a.x1 - b.x1) <= threshold)
    return rangesOverlap(a.y1, a.y2, b.y1, b.y2)
  return false
}

export function segmentsCross(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: OccupiedSegment,
): boolean {
  if (a.y1 === a.y2 && b.x1 === b.x2) {
    const y = a.y1, x = b.x1
    const xMin = Math.min(a.x1, a.x2), xMax = Math.max(a.x1, a.x2)
    const yMin = Math.min(b.y1, b.y2), yMax = Math.max(b.y1, b.y2)
    return x > xMin && x < xMax && y > yMin && y < yMax
  }
  if (a.x1 === a.x2 && b.y1 === b.y2) {
    const x = a.x1, y = b.y1
    const yMin = Math.min(a.y1, a.y2), yMax = Math.max(a.y1, a.y2)
    const xMin = Math.min(b.x1, b.x2), xMax = Math.max(b.x1, b.x2)
    return y > yMin && y < yMax && x > xMin && x < xMax
  }
  return false
}

/* ── Path utilities ───────────────────────────────────────────── */

/* ── Obstacle / segment checking ─────────────────────────────── */

function edgeClear(ax: number, ay: number, bx: number, by: number, obs: Rect[]): boolean {
  if (ax === bx) {
    const x = ax
    const y1 = Math.min(ay, by), y2 = Math.max(ay, by)
    for (const o of obs) {
      if (x > o.left && x < o.left + o.width && o.top < y2 && o.top + o.height > y1) return false
    }
    return true
  }
  if (ay === by) {
    const y = ay
    const x1 = Math.min(ax, bx), x2 = Math.max(ax, bx)
    for (const o of obs) {
      if (y > o.top && y < o.top + o.height && o.left < x2 && o.left + o.width > x1) return false
    }
    return true
  }
  return true // diagonal — treat as clear (should not happen in orthogonal paths)
}

export function pathIntersectsRectangles(
  path: Point[],
  rectangles: Rect[],
  clearance = 0,
): boolean {
  if (rectangles.length === 0) return false
  const inflated = rectangles.map((r) => ({
    left: r.left - clearance,
    top: r.top - clearance,
    width: r.width + clearance * 2,
    height: r.height + clearance * 2,
  }))
  const normalized = normalizeOrthogonalPath(path)
  if (normalized.length < 2 || !isOrthogonalPath(normalized)) return true
  for (let i = 0; i < normalized.length - 1; i++) {
    const a = normalized[i], b = normalized[i + 1]
    if (!edgeClear(a.x, a.y, b.x, b.y, inflated)) return true
  }
  return false
}

export function pathOverlapsSegments(
  path: Point[],
  occupied: OccupiedSegment[],
  options: { includeCross?: boolean; nearbyThreshold?: number } = {},
): boolean {
  if (occupied.length === 0) return false
  const { includeCross = false, nearbyThreshold = 0 } = options
  const normalized = normalizeOrthogonalPath(path)
  if (normalized.length < 2 || !isOrthogonalPath(normalized)) return true

  for (let i = 0; i < normalized.length - 1; i++) {
    const seg = {
      x1: normalized[i].x, y1: normalized[i].y,
      x2: normalized[i + 1].x, y2: normalized[i + 1].y,
    }
    for (const occ of occupied) {
      if (segmentsOverlap(seg, occ)) return true
      if (includeCross && segmentsCross(seg, occ)) return true
      if (nearbyThreshold > 0 && segmentsNearby(seg, occ, nearbyThreshold)) return true
    }
  }
  return false
}

/* ── Scoring ──────────────────────────────────────────────────── */

const OVERLAP_PENALTY = 8000
const CROSS_PENALTY = 12000
const NEAR_PENALTY = 600
const NEAR_THRESHOLD = 12

function distanceOutsideRange(value: number, a: number, b: number): number {
  const min = Math.min(a, b), max = Math.max(a, b)
  if (value < min) return min - value
  if (value > max) return value - max
  return 0
}

function countBends(path: Point[]): number {
  let bends = 0
  let prevDir: 0 | 1 | -1 = 0
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]
    const dir: 0 | 1 | -1 = a.y === b.y && a.x !== b.x ? 1 : (a.x === b.x && a.y !== b.y ? -1 : 0)
    if (dir !== 0 && prevDir !== 0 && dir !== prevDir) bends++
    if (dir !== 0) prevDir = dir
  }
  return bends
}

function scoreRouteDirectness(path: Point[]): number {
  if (path.length < 2) return 0
  const start = path[0], end = path[path.length - 1]
  const directDx = end.x - start.x
  const directDy = end.y - start.y
  let score = 0
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1], cur = path[i]
    const segLen = manhattanDistance(prev, cur)
    if (segLen === 0) continue
    if (cur.x !== prev.x && directDx !== 0 && Math.sign(cur.x - prev.x) !== Math.sign(directDx))
      score += segLen * 2
    if (cur.y !== prev.y && directDy !== 0 && Math.sign(cur.y - prev.y) !== Math.sign(directDy))
      score += segLen * 2
    score += (
      distanceOutsideRange(cur.x, start.x, end.x) +
      distanceOutsideRange(cur.y, start.y, end.y)
    ) * 2
  }
  return score
}

export function scorePath(
  path: Point[],
  occupied: OccupiedSegment[],
  options: { crossPenalty?: number } = {},
): number {
  const crossPenalty = options.crossPenalty ?? CROSS_PENALTY
  const normalized = normalizeOrthogonalPath(path)
  if (normalized.length < 2 || !isOrthogonalPath(normalized)) return Infinity
  let score = 0
  for (let i = 0; i < normalized.length - 1; i++) {
    const dx = normalized[i + 1].x - normalized[i].x
    const dy = normalized[i + 1].y - normalized[i].y
    score += Math.abs(dx) + Math.abs(dy)
    const seg = { x1: normalized[i].x, y1: normalized[i].y, x2: normalized[i + 1].x, y2: normalized[i + 1].y }
    for (const occ of occupied) {
      if (segmentsOverlap(seg, occ)) score += OVERLAP_PENALTY
      else if (segmentsCross(seg, occ)) score += crossPenalty
      else if (segmentsNearby(seg, occ, NEAR_THRESHOLD)) score += NEAR_PENALTY
    }
  }
  score += Math.max(0, normalized.length - 2) * 180
  score += countBends(normalized) * 360
  score += scoreRouteDirectness(normalized)
  for (let i = 0; i < normalized.length - 1; i++) {
    const len = Math.abs(normalized[i + 1].x - normalized[i].x) + Math.abs(normalized[i + 1].y - normalized[i].y)
    if (len > 0 && len < 14) score += 35
  }
  return score
}

/* ── pathToSegments ───────────────────────────────────────────── */

export function pathToSegments(path: Point[]): OccupiedSegment[] {
  const normalized = assertOrthogonalPath(normalizeOrthogonalPath(path), "pathToSegments input")
  const segs: OccupiedSegment[] = []
  for (let i = 0; i < normalized.length - 1; i++)
    segs.push({ x1: normalized[i].x, y1: normalized[i].y, x2: normalized[i + 1].x, y2: normalized[i + 1].y })
  return segs
}

/* ── Geometry helpers ─────────────────────────────────────────── */

function connPtFromOptions(cp: ConnectorPoint, port?: PortConstraint, isSource = true): Point {
  const s = cp.shape
  const raw = cp.side === "top" || cp.side === "bottom"
    ? (port ? (isSource ? port.exitX : port.entryX) : null)
    : (port ? (isSource ? port.exitY : port.entryY) : null)
  const dist = raw != null ? Math.max(0, Math.min(1, raw)) : cp.distance
  const dx = port ? (isSource ? (port.exitDx ?? 0) : (port.entryDx ?? 0)) : 0
  const dy = port ? (isSource ? (port.exitDy ?? 0) : (port.entryDy ?? 0)) : 0
  switch (cp.side) {
    case "top":    return { x: Math.round(s.left + s.width * dist + dx), y: Math.round(s.top + dy) }
    case "bottom": return { x: Math.round(s.left + s.width * dist + dx), y: Math.round(s.top + s.height + dy) }
    case "left":   return { x: Math.round(s.left + dx), y: Math.round(s.top + s.height * dist + dy) }
    case "right":  return { x: Math.round(s.left + s.width + dx), y: Math.round(s.top + s.height * dist + dy) }
  }
}

function extrudePtFromOptions(cp: ConnectorPoint, margin: number, port?: PortConstraint, isSource = true): Point {
  const { x, y } = connPtFromOptions(cp, port, isSource)
  switch (cp.side) {
    case "top":    return { x, y: Math.round(y - margin) }
    case "bottom": return { x, y: Math.round(y + margin) }
    case "left":   return { x: Math.round(x - margin), y }
    case "right":  return { x: Math.round(x + margin), y }
  }
}

function isVert(s: Side): boolean { return s === "top" || s === "bottom" }


/* ── Nudge a path away from occupied segments ─────────────────── */

const NUDGE_STEP = 10

function nudgeOffset(seg: OccupiedSegment, occupied: OccupiedSegment[]): number {
  let offset = 0
  for (let attempt = 0; attempt < 6; attempt++) {
    const shifted = {
      x1: seg.x1, y1: seg.y1 + offset,
      x2: seg.x2, y2: seg.y2 + offset,
    }
    const hasOverlap = occupied.some((occ) => segmentsOverlap(shifted, occ))
    if (!hasOverlap) return offset
    offset += (attempt % 2 === 0 ? 1 : -1) * NUDGE_STEP * Math.ceil((attempt + 1) / 2)
  }
  return 0
}

function applyNudge(path: Point[], occupied: OccupiedSegment[]): Point[] {
  if (path.length < 3 || occupied.length === 0) return path
  const out = path.map((p) => ({ ...p }))
  for (let i = 1; i < out.length - 1; i++) {
    const prev = out[i - 1], cur = out[i], next = out[i + 1]
    const isH = prev.y === cur.y && cur.y === next.y
    if (!isH) continue
    const seg: OccupiedSegment = { x1: prev.x, y1: cur.y, x2: next.x, y2: cur.y }
    const offset = nudgeOffset(seg, occupied)
    if (offset !== 0) {
      out[i] = { x: cur.x, y: cur.y + offset }
      out[i - 1] = { x: prev.x, y: prev.y + offset }
    }
  }
  return out
}

/* ── Main export: routeOrthogonal ─────────────────────────────── */

/**
 * Direct geometry orthogonal router.
 * Tries L-shape → Z-shape → U-shape in order.
 * Returns [] if no valid path found.
 */
export function routeOrthogonal(opts: RouteOptions): Point[] {
  const {
    pointA, pointB,
    obstacles: extras = [],
    shapeMargin: margin = 10,
    globalBounds: gb,
    globalBoundsMargin: gbm = 20,
    occupiedSegments: occupied = [],
    sourcePort,
    targetPort,
    jettySize,
    sourceJettySize,
    targetJettySize,
    lShapeOnly = false,
  } = opts

  const sourceJetty = sourceJettySize ?? jettySize ?? margin
  const targetJetty = targetJettySize ?? jettySize ?? margin

  const oA = connPtFromOptions(pointA, sourcePort, true)
  const oB = connPtFromOptions(pointB, targetPort, false)
  const extA = extrudePtFromOptions(pointA, sourceJetty, sourcePort, true)
  const extB = extrudePtFromOptions(pointB, targetJetty, targetPort, false)

  // Inflate shapes slightly for obstacle checking
  const infFromShape: Rect = {
    left: pointA.shape.left - 2, top: pointA.shape.top - 2,
    width: pointA.shape.width + 4, height: pointA.shape.height + 4,
  }
  const infToShape: Rect = {
    left: pointB.shape.left - 2, top: pointB.shape.top - 2,
    width: pointB.shape.width + 4, height: pointB.shape.height + 4,
  }

  // Source/target perlu aturan khusus: segmen pertama boleh keluar source dan
  // segmen terakhir boleh masuk target. Shape lain tetap obstacle penuh.
  const allObs = extras.map((o) => ({
    left: o.left - margin, top: o.top - margin,
    width: o.width + margin * 2, height: o.height + margin * 2,
  }))

  // Compute bounds
  let bounds: Rect = {
    left: Math.min(pointA.shape.left, pointB.shape.left) - gbm,
    top: Math.min(pointA.shape.top, pointB.shape.top) - gbm,
    width: Math.abs(pointB.shape.left - pointA.shape.left) + Math.max(pointA.shape.width, pointB.shape.width) + gbm * 2,
    height: Math.abs(pointB.shape.top - pointA.shape.top) + Math.max(pointA.shape.height, pointB.shape.height) + gbm * 2,
  }
  if (gb) {
    const gLeft = gb.left
    const gTop = gb.top
    const gRight = gb.left + gb.width
    const gBottom = gb.top + gb.height
    const hasUsableGlobalBounds =
      gRight - gLeft > 0 &&
      gBottom - gTop > 0
    if (hasUsableGlobalBounds) {
      // Direct L/Z tetap lokal karena dicoba lebih dulu. Detour membutuhkan
      // seluruh area pelaksana agar dapat mengitari obstacle yang menutup
      // bounding box source-target.
      bounds = {
        left: gLeft,
        top: gTop,
        width: gRight - gLeft,
        height: gBottom - gTop,
      }
    }
  }
  const MIN_ROUTER_BOUNDS_SIZE = 40
  if (bounds.width < MIN_ROUTER_BOUNDS_SIZE) {
    bounds = { ...bounds, width: MIN_ROUTER_BOUNDS_SIZE }
  }
  if (bounds.height < MIN_ROUTER_BOUNDS_SIZE) {
    bounds = { ...bounds, height: MIN_ROUTER_BOUNDS_SIZE }
  }

  const crossesHardObstacle = (path: Point[]): boolean => {
    if (path.length < 2) return true
    if (pathIntersectsRectangles(path, allObs, 2)) return true
    const lastSegment = path.length - 2
    for (let i = 0; i < path.length - 1; i += 1) {
      const a = path[i]!
      const b = path[i + 1]!
      if (i !== 0 && !edgeClear(a.x, a.y, b.x, b.y, [infFromShape])) return true
      if (i !== lastSegment && !edgeClear(a.x, a.y, b.x, b.y, [infToShape])) return true
    }
    return false
  }

  const isUsable = (path: Point[]): boolean => {
    if (path.length < 2) return false
    if (!isOrthogonalPath(path)) return false
    if (pathOverlapsSegments(path, occupied, { includeCross: false })) return false
    if (crossesHardObstacle(path)) return false
    return true
  }

  const normalize = (path: Point[]): Point[] =>
    simplifyOrthogonalPath(
      normalizeOrthogonalPath(path, { bounds }),
      undefined,
      crossesHardObstacle,
    )

  const tryPath = (raw: Point[]): Point[] | null => {
    const p = normalize(raw)
    if (!isOrthogonalPath(p)) return null
    if (isUsable(p)) return p
    // Try nudging occupied-segment conflicts
    const nudged = normalize(applyNudge(p, occupied))
    if (isOrthogonalPath(nudged) && isUsable(nudged)) return nudged
    return null
  }

  const isVertA = isVert(pointA.side)
  const isVertB = isVert(pointB.side)

  const pickLowestScore = (rawCandidates: Point[][]): Point[] | null => {
    let bestPath: Point[] | null = null
    let bestScore = Infinity
    for (const raw of rawCandidates) {
      const path = tryPath(raw)
      if (!path) continue
      const score = scorePath(path, occupied)
      if (score < bestScore) {
        bestPath = path
        bestScore = score
      }
    }
    return bestPath
  }

  // ── Strategy 1: direct L-shape, across every side combination ─
  const directL = pickLowestScore([
    [oA, extA, { x: extA.x, y: extB.y }, extB, oB],
    [oA, extA, { x: extB.x, y: extA.y }, extB, oB],
  ])
  if (directL) return directL
  if (lShapeOnly) return []

  // ── Strategy 2: midpoint Z-shape ─────────────────────────────
  if (isVertA && isVertB) {
    const midY = Math.round((extA.y + extB.y) / 2)
    const zShape = tryPath([oA, extA, { x: extA.x, y: midY }, { x: extB.x, y: midY }, extB, oB])
    if (zShape) return zShape
  }

  if (!isVertA && !isVertB) {
    const midX = Math.round((extA.x + extB.x) / 2)
    const zShape = tryPath([oA, extA, { x: midX, y: extA.y }, { x: midX, y: extB.y }, extB, oB])
    if (zShape) return zShape
  }

  if (isVertA && !isVertB) {
    const midX = Math.round((extA.x + extB.x) / 2)
    const midY = Math.round((extA.y + extB.y) / 2)
    const z1 = tryPath([oA, extA, { x: extA.x, y: midY }, { x: extB.x, y: midY }, extB, oB])
    if (z1) return z1
    const z2 = tryPath([oA, extA, { x: midX, y: extA.y }, { x: midX, y: extB.y }, extB, oB])
    if (z2) return z2
  }

  if (!isVertA && isVertB) {
    const midX = Math.round((extA.x + extB.x) / 2)
    const midY = Math.round((extA.y + extB.y) / 2)
    const z1 = tryPath([oA, extA, { x: midX, y: extA.y }, { x: midX, y: extB.y }, extB, oB])
    if (z1) return z1
    const z2 = tryPath([oA, extA, { x: extA.x, y: midY }, { x: extB.x, y: midY }, extB, oB])
    if (z2) return z2
  }

  // ── Strategy 3: U-shape (loop-back) ─────────────────────────
  const uLeft = bounds.left + 4
  const uRight = bounds.left + bounds.width - 4
  const uTop = bounds.top + 4
  const uBot = bounds.top + bounds.height - 4

  for (const pipe of [uLeft, uRight]) {
    if (!isVertA && !isVertB) {
      const u = tryPath([oA, extA, { x: pipe, y: extA.y }, { x: pipe, y: extB.y }, extB, oB])
      if (u) return u
    }
  }
  for (const pipe of [uTop, uBot]) {
    if (isVertA && isVertB) {
      const u = tryPath([oA, extA, { x: extA.x, y: pipe }, { x: extB.x, y: pipe }, extB, oB])
      if (u) return u
    }
  }

  // ── Strategy 4: obstacle-adaptive rail detour ────────────────
  const RAIL_CLEARANCE = 4
  const boundsRight = bounds.left + bounds.width
  const boundsBottom = bounds.top + bounds.height
  const withinX = (x: number) => x > bounds.left + 2 && x < boundsRight - 2
  const withinY = (y: number) => y > bounds.top + 2 && y < boundsBottom - 2
  const unique = (values: number[]) => [...new Set(values.map((value) => Math.round(value)))]
  const xRails = unique([
    uLeft,
    uRight,
    ...allObs.flatMap((obstacle) => [
      obstacle.left - RAIL_CLEARANCE,
      obstacle.left + obstacle.width + RAIL_CLEARANCE,
    ]),
  ]).filter(withinX)
  const yRails = unique([
    uTop,
    uBot,
    ...allObs.flatMap((obstacle) => [
      obstacle.top - RAIL_CLEARANCE,
      obstacle.top + obstacle.height + RAIL_CLEARANCE,
    ]),
  ]).filter(withinY)
  const railCandidates: Point[][] = [
    ...xRails.map((railX) => [
      oA,
      extA,
      { x: railX, y: extA.y },
      { x: railX, y: extB.y },
      extB,
      oB,
    ]),
    ...yRails.map((railY) => [
      oA,
      extA,
      { x: extA.x, y: railY },
      { x: extB.x, y: railY },
      extB,
      oB,
    ]),
  ]
  const railPath = pickLowestScore(railCandidates)
  if (railPath) return railPath

  // ── Strategy 5: Generic fallback ─────────────────────────────
  // Build 4 generic candidates and pick best score
  const candidates: Point[][] = [
    [oA, extA, { x: extA.x, y: extB.y }, extB, oB],
    [oA, extA, { x: extB.x, y: extA.y }, extB, oB],
    [oA, extA, { x: extA.x, y: Math.round((extA.y + extB.y) / 2) }, { x: extB.x, y: Math.round((extA.y + extB.y) / 2) }, extB, oB],
    [oA, extA, { x: Math.round((extA.x + extB.x) / 2), y: extA.y }, { x: Math.round((extA.x + extB.x) / 2), y: extB.y }, extB, oB],
  ]

  const bestPath = pickLowestScore(candidates)
  if (bestPath) return bestPath

  // ── Emergency: straight path ignoring obstacles ───────────────
  const emergency = normalize([oA, extA, { x: extA.x, y: extB.y }, extB, oB])
  if (isOrthogonalPath(emergency) && emergency.length >= 2) return emergency

  // Last resort: center-to-center via midpoint
  const cx1 = Math.round(pointA.shape.left + pointA.shape.width / 2)
  const cy1 = Math.round(pointA.shape.top + pointA.shape.height)
  const cx2 = Math.round(pointB.shape.left + pointB.shape.width / 2)
  const cy2 = Math.round(pointB.shape.top)
  const midY2 = Math.round((cy1 + cy2) / 2)
  return normalize([
    { x: cx1, y: cy1 },
    { x: cx1, y: midY2 },
    { x: cx2, y: midY2 },
    { x: cx2, y: cy2 },
  ])
}

/* ── Corridor stub (API compatibility — no-op) ────────────────── */

export interface CorridorRouteOptions {
  graph: CorridorGraph
  pointA: ConnectorPoint
  pointB: ConnectorPoint
  shapeMargin?: number
  occupiedSegments?: OccupiedSegment[]
  sourcePort?: PortConstraint
  targetPort?: PortConstraint
  jettySize?: number
  sourceJettySize?: number
  targetJettySize?: number
}

/**
 * Stub for API compatibility. Delegates directly to routeOrthogonal.
 * The pre-built corridor graph is no longer needed with the geometry router.
 */
export function routeOnCorridor(opts: CorridorRouteOptions): Point[] {
  return routeOrthogonal({
    pointA: opts.pointA,
    pointB: opts.pointB,
    shapeMargin: opts.shapeMargin,
    occupiedSegments: opts.occupiedSegments,
    sourcePort: opts.sourcePort,
    targetPort: opts.targetPort,
    jettySize: opts.jettySize,
    sourceJettySize: opts.sourceJettySize,
    targetJettySize: opts.targetJettySize,
  })
}

/**
 * Stub for API compatibility.
 * No longer builds a corridor graph — returns empty graph.
 */
export function buildCorridorGraph(
  _cells: CellInfo[][],
  _margin?: number,
): CorridorGraph {
  return { spots: [], adj: new Map(), shapeObs: [] }
}

/* ── PointKey export for consumers ───────────────────────────── */
export type PointKey = string
