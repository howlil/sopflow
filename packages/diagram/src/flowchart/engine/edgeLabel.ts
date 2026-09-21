import type { FlowchartRect as Rect } from "./types.js";

export interface EdgeLabelPlacementInput {
  path: { x: number; y: number }[]
  label?: string | null
  obstacles?: Rect[]
  distanceAlongEdge?: number
  perpendicularOffset?: number
}

function pointInRect(point: { x: number; y: number }, rect: Rect, margin = 4): boolean {
  return (
    point.x >= rect.left - margin &&
    point.x <= rect.left + rect.width + margin &&
    point.y >= rect.top - margin &&
    point.y <= rect.top + rect.height + margin
  )
}

function isDecisionLikeLabel(label: string | null | undefined): boolean {
  const t = (label ?? "").trim().toLowerCase()
  return t === "ya" || t === "yes" || t === "y" || t === "tidak" || t === "no" || t === "n"
}

/**
 * Posisi label edge di sepanjang segmen pertama path, dengan offset tegak lurus.
 * Geser tambahan jika bertabrakan dengan obstacle (gateway/task).
 */
export function placeEdgeLabel(input: EdgeLabelPlacementInput): { x: number; y: number } | null {
  const { path, label, obstacles = [] } = input
  if (path.length < 2) return null
  const start = path[0]!
  const next = path[1]!
  const dx = next.x - start.x
  const dy = next.y - start.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return { x: start.x, y: start.y }
  const distance = input.distanceAlongEdge ?? 30
  const t = Math.min(1, distance / len)
  const px = start.x + dx * t
  const py = start.y + dy * t
  const baseOffset = input.perpendicularOffset ?? (isDecisionLikeLabel(label) ? 22 : 19)
  const nx = -dy / len
  const ny = dx / len
  const candidates = [
    { x: px + nx * baseOffset, y: py + ny * baseOffset },
    { x: px - nx * baseOffset, y: py - ny * baseOffset },
    { x: px + nx * (baseOffset + 12), y: py + ny * (baseOffset + 12) },
    { x: px, y: py - baseOffset },
    { x: px, y: py + baseOffset },
  ]
  for (const candidate of candidates) {
    const hits = obstacles.some((obs) => pointInRect(candidate, obs))
    if (!hits) return candidate
  }
  return candidates[0]!
}
