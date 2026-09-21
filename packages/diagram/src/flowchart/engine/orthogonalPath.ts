import type { FlowchartPoint as Point, FlowchartRect as Rect } from "./types.js";

export function isOrthogonalPath(path: Point[]): boolean {
  if (path.length < 2) return false
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    if (a.x !== b.x && a.y !== b.y) return false
  }
  return true
}

export function assertOrthogonalPath(path: Point[], context = "path"): Point[] {
  if (!isOrthogonalPath(path)) {
    throw new Error(`${context} must be orthogonal`)
  }
  return path
}

function clonePoint(p: Point): Point {
  return { x: Math.round(p.x), y: Math.round(p.y) }
}

export function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function dedupeConsecutivePoints(points: Point[]): Point[] {
  if (points.length <= 1) return points.map(clonePoint)
  const out: Point[] = []
  for (const point of points) {
    const next = clonePoint(point)
    const prev = out[out.length - 1]
    if (!prev || prev.x !== next.x || prev.y !== next.y) out.push(next)
  }
  return out
}

function pointInRect(p: Point, rect: Rect): boolean {
  return p.x >= rect.left
    && p.x <= rect.left + rect.width
    && p.y >= rect.top
    && p.y <= rect.top + rect.height
}

function chooseElbow(a: Point, b: Point, bounds: Rect | null | undefined): Point {
  const elbows = [
    { x: a.x, y: b.y },
    { x: b.x, y: a.y },
  ]
  if (!bounds) return elbows[0]
  const scored = elbows.map((elbow, index) => ({
    elbow,
    score: (pointInRect(elbow, bounds) ? 0 : 10_000) + index,
  }))
  scored.sort((left, right) => left.score - right.score)
  return scored[0].elbow
}

export interface NormalizeOrthogonalPathOptions {
  preserveTerminalJetty?: boolean
  bounds?: Rect | null
}

export function normalizeOrthogonalPath(
  path: Point[],
  options: NormalizeOrthogonalPathOptions = {},
): Point[] {
  const { preserveTerminalJetty = true, bounds = null } = options
  if (path.length === 0) return []

  const deduped = dedupeConsecutivePoints(path)
  if (deduped.length <= 1) return deduped

  const expanded: Point[] = [deduped[0]]
  for (let i = 0; i < deduped.length - 1; i++) {
    const a = expanded[expanded.length - 1]
    const b = deduped[i + 1]
    if (a.x === b.x || a.y === b.y) {
      expanded.push(clonePoint(b))
      continue
    }
    const elbow = chooseElbow(a, b, bounds)
    if (a.x !== elbow.x || a.y !== elbow.y) expanded.push(elbow)
    expanded.push(clonePoint(b))
  }

  const clean = dedupeConsecutivePoints(expanded)
  if (clean.length <= 2) return clean

  const out: Point[] = [clean[0]]
  const TERMINAL_JETTY_KEEP_MAX = 32
  for (let i = 1; i < clean.length - 1; i++) {
    const prev = out[out.length - 1]
    const cur = clean[i]
    const next = clean[i + 1]
    const keepJetty = preserveTerminalJetty && (
      (i === 1 && manhattanDistance(clean[0], cur) <= TERMINAL_JETTY_KEEP_MAX) ||
      (i === clean.length - 2 && manhattanDistance(cur, clean[clean.length - 1]) <= TERMINAL_JETTY_KEEP_MAX)
    )
    const collinear =
      (prev.x === cur.x && cur.x === next.x) ||
      (prev.y === cur.y && cur.y === next.y)
    if (keepJetty || !collinear) out.push(cur)
  }
  out.push(clean[clean.length - 1])

  return dedupeConsecutivePoints(out)
}

function isCollinearMiddle(prev: Point, cur: Point, next: Point): boolean {
  return (prev.x === cur.x && cur.x === next.x) || (prev.y === cur.y && cur.y === next.y)
}

type SegmentAxis = "horizontal" | "vertical"

function segmentAxis(from: Point, to: Point): SegmentAxis | null {
  if (from.x === to.x && from.y !== to.y) return "vertical"
  if (from.y === to.y && from.x !== to.x) return "horizontal"
  return null
}

/** Optional callback to check whether a simplified path would cross obstacles. */
export type PathObstacleCheck = (candidate: Point[]) => boolean

/** Hapus satu lipatan persegi (4 titik) menjadi satu siku ortogonal. */
function tryCollapseRectangle(path: Point[], wouldCross?: PathObstacleCheck): Point[] | null {
  for (let i = 0; i < path.length - 3; i += 1) {
    const p0 = path[i]!
    const p1 = path[i + 1]!
    const p2 = path[i + 2]!
    const p3 = path[i + 3]!
    if (p0.x === p2.x && p1.y === p3.y && (p0.x !== p1.x || p0.y !== p1.y)) {
      const corner = { x: p0.x, y: p3.y }
      const merged = normalizeOrthogonalPath([...path.slice(0, i + 1), corner, p3, ...path.slice(i + 4)].map((p) => ({ ...p })))
      if (wouldCross && wouldCross(merged)) continue
      return merged
    }
    if (p0.y === p2.y && p1.x === p3.x && (p0.y !== p1.y || p0.x !== p1.x)) {
      const corner = { x: p3.x, y: p0.y }
      const merged = normalizeOrthogonalPath([...path.slice(0, i + 1), corner, p3, ...path.slice(i + 4)].map((p) => ({ ...p })))
      if (wouldCross && wouldCross(merged)) continue
      return merged
    }
  }
  return null
}

/** Maks. offset dari spine agar lipatan dianggap notch (bukan L-routing sengaja). */
const SPINE_NOTCH_MAX_PX = 48

/**
 * Hapus lipatan 2-langkah dekat spine vertikal/horizontal (b dan e sejajar sumbu utama).
 * L-routing yang menyimpang jauh dari spine (mis. elbow ke kolom lain) tidak dihapus.
 */
function tryRemoveSpineDetour(path: Point[], maxSpineNotchPx = SPINE_NOTCH_MAX_PX, wouldCross?: PathObstacleCheck): Point[] | null {
  for (let i = 0; i < path.length - 3; i += 1) {
    const b = path[i]!
    const c = path[i + 1]!
    const d = path[i + 2]!
    const e = path[i + 3]!
    const bc = segmentAxis(b, c)
    const cd = segmentAxis(c, d)
    const de = segmentAxis(d, e)
    if (!bc || !cd || !de || bc === cd || cd === de) continue
    if (b.x === e.x && bc === "horizontal" && cd === "vertical" && de === "horizontal") {
      if (Math.abs(c.x - b.x) <= maxSpineNotchPx && Math.abs(d.x - b.x) <= maxSpineNotchPx) {
        const merged = normalizeOrthogonalPath([...path.slice(0, i + 1), ...path.slice(i + 3)].map((p) => ({ ...p })))
        if (wouldCross && wouldCross(merged)) continue
        return merged
      }
    }
    if (b.y === e.y && bc === "vertical" && cd === "horizontal" && de === "vertical") {
      if (Math.abs(c.y - b.y) <= maxSpineNotchPx && Math.abs(d.y - b.y) <= maxSpineNotchPx) {
        const merged = normalizeOrthogonalPath([...path.slice(0, i + 1), ...path.slice(i + 3)].map((p) => ({ ...p })))
        if (wouldCross && wouldCross(merged)) continue
        return merged
      }
    }
  }
  return null
}

/** Hapus detour 2 titik (b-c-d-e) bila b dan e sejajar - hanya lipatan kecil. */
function tryRemoveTwoStepDetour(path: Point[], maxNotchPx: number, wouldCross?: PathObstacleCheck): Point[] | null {
  for (let i = 0; i < path.length - 3; i += 1) {
    const b = path[i]!
    const c = path[i + 1]!
    const d = path[i + 2]!
    const e = path[i + 3]!
    const bc = segmentAxis(b, c)
    const cd = segmentAxis(c, d)
    const de = segmentAxis(d, e)
    if (!bc || !cd || !de || bc === cd || cd === de) continue
    if (b.x === e.x && bc === "horizontal" && cd === "vertical" && de === "horizontal") {
      const detourW = Math.abs(c.x - b.x)
      const detourH = Math.abs(d.y - c.y)
      if (detourW <= maxNotchPx && detourH <= maxNotchPx) {
        const merged = normalizeOrthogonalPath([...path.slice(0, i + 1), ...path.slice(i + 3)].map((p) => ({ ...p })))
        if (wouldCross && wouldCross(merged)) continue
        return merged
      }
    }
    if (b.y === e.y && bc === "vertical" && cd === "horizontal" && de === "vertical") {
      const detourW = Math.abs(c.x - b.x)
      const detourH = Math.abs(d.y - c.y)
      if (detourW <= maxNotchPx && detourH <= maxNotchPx) {
        const merged = normalizeOrthogonalPath([...path.slice(0, i + 1), ...path.slice(i + 3)].map((p) => ({ ...p })))
        if (wouldCross && wouldCross(merged)) continue
        return merged
      }
    }
  }
  return null
}

/** Hapus detour 3 titik bila notch kecil dan titik awal/akhir sejajar. */
function tryRemoveThreeStepDetour(path: Point[], maxNotchPx: number, wouldCross?: PathObstacleCheck): Point[] | null {
  for (let i = 0; i < path.length - 4; i += 1) {
    const b = path[i]!
    const c = path[i + 1]!
    const d = path[i + 2]!
    const e = path[i + 3]!
    const f = path[i + 4]!
    const bc = segmentAxis(b, c)
    const cd = segmentAxis(c, d)
    const de = segmentAxis(d, e)
    const ef = segmentAxis(e, f)
    if (!bc || !cd || !de || !ef || bc === cd || cd === de || de === ef) continue
    const detourW = Math.max(Math.abs(c.x - b.x), Math.abs(d.x - e.x))
    const detourH = Math.max(Math.abs(c.y - b.y), Math.abs(d.y - e.y))
    if (detourW > maxNotchPx || detourH > maxNotchPx) continue
    if (
      b.x === f.x &&
      bc === "vertical" &&
      cd === "horizontal" &&
      de === "vertical" &&
      ef === "horizontal"
    ) {
      const merged = normalizeOrthogonalPath([...path.slice(0, i + 1), ...path.slice(i + 4)].map((p) => ({ ...p })))
      if (wouldCross && wouldCross(merged)) continue
      return merged
    }
    if (
      b.y === f.y &&
      bc === "horizontal" &&
      cd === "vertical" &&
      de === "horizontal" &&
      ef === "vertical"
    ) {
      const merged = normalizeOrthogonalPath([...path.slice(0, i + 1), ...path.slice(i + 4)].map((p) => ({ ...p })))
      if (wouldCross && wouldCross(merged)) continue
      return merged
    }
  }
  return null
}

function removeOrthogonalNotches(path: Point[], maxNotchPx: number, wouldCross?: PathObstacleCheck): Point[] {
  let next = normalizeOrthogonalPath(path.map((p) => ({ ...p })))
  let changed = true
  while (changed) {
    changed = false
    const collapsed = tryCollapseRectangle(next, wouldCross)
    if (collapsed) {
      next = collapsed
      changed = true
      continue
    }
    const spineDetour = tryRemoveSpineDetour(next, SPINE_NOTCH_MAX_PX, wouldCross)
    if (spineDetour) {
      next = spineDetour
      changed = true
      continue
    }
    const twoStep = tryRemoveTwoStepDetour(next, maxNotchPx, wouldCross)
    if (twoStep) {
      next = twoStep
      changed = true
      continue
    }
    const threeStep = tryRemoveThreeStepDetour(next, maxNotchPx, wouldCross)
    if (threeStep) {
      next = threeStep
      changed = true
    }
  }
  return next
}

/** Kurangi zig-zag: collinear, dogleg pendek, dan lipatan persegi redundan. */
export function simplifyOrthogonalPath(
  path: Point[],
  minSegmentPx = 10,
  wouldCrossObstacles?: PathObstacleCheck,
): Point[] {
  if (path.length < 3) return normalizeOrthogonalPath(path.map((p) => ({ ...p })))
  const maxNotchPx = Math.max(minSegmentPx + 8, 24)
  let next = removeOrthogonalNotches(path, maxNotchPx, wouldCrossObstacles)
  const withoutCollinear: Point[] = [next[0]!]
  for (let i = 1; i < next.length - 1; i += 1) {
    const prev = withoutCollinear[withoutCollinear.length - 1]!
    const cur = next[i]!
    const after = next[i + 1]!
    if (!isCollinearMiddle(prev, cur, after)) {
      withoutCollinear.push(cur)
    }
  }
  withoutCollinear.push(next[next.length - 1]!)
  next = withoutCollinear
  let changed = true
  while (changed && next.length > 2) {
    changed = false
    const simplified: Point[] = [next[0]!]
    for (let i = 1; i < next.length - 1; i += 1) {
      const prev = simplified[simplified.length - 1]!
      const cur = next[i]!
      const after = next[i + 1]!
      const leg1 = Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y)
      const leg2 = Math.abs(after.x - cur.x) + Math.abs(after.y - cur.y)
      if (leg1 < minSegmentPx && leg2 < minSegmentPx) {
        changed = true
        continue
      }
      simplified.push(cur)
    }
    simplified.push(next[next.length - 1]!)
    next = normalizeOrthogonalPath(simplified)
  }
  return removeOrthogonalNotches(next, maxNotchPx, wouldCrossObstacles)
}
