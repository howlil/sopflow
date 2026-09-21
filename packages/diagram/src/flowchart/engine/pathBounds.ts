import type { FlowchartPoint as Point } from "./types.js";

export interface PelaksanaBoundsRect {
  left: number
  top: number
  right: number
  bottom: number
}

/** Jaga semua titik path di dalam koridor kolom pelaksana (hindari Mutu Baku). */
export function clampPathToPelaksanaBounds(
  path: Point[],
  bounds: PelaksanaBoundsRect | null | undefined,
): Point[] {
  if (!bounds || path.length === 0) return path.map((p) => ({ ...p }))
  const left = bounds.left
  const right = bounds.right
  const top = bounds.top
  const bottom = bounds.bottom
  return path.map((p) => ({
    x: Math.round(Math.max(left, Math.min(right, p.x))),
    y: Math.round(Math.max(top, Math.min(bottom, p.y))),
  }))
}

export function pathWithinPelaksanaBounds(
  path: Point[],
  bounds: PelaksanaBoundsRect | null | undefined,
  margin = 0,
): boolean {
  if (!bounds || path.length === 0) return true
  const left = bounds.left - margin
  const right = bounds.right + margin
  const top = bounds.top - margin
  const bottom = bounds.bottom + margin
  return path.every(
    (p) => p.x >= left && p.x <= right && p.y >= top && p.y <= bottom,
  )
}
