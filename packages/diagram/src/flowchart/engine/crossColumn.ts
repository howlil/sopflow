import { pointOnFlowchartDecisionVertex } from "./decisionGeometry.js";
import {
  pickColumnGutterBusX,
  resolveColumnBoundsForShapeX,
} from "./columns.js";
import { findFlowchartRowPipeY } from "./grid.js";
import { MUTU_BAKU_RIGHT_GUARD_PX } from "./routingBounds.js";
import type {
  FlowchartBounds as FlowchartPelaksanaBoundsRect,
  FlowchartGridLayout,
  FlowchartPoint as Point,
  FlowchartRect as Rect,
  FlowchartSide as Side,
} from "./types.js";
type ImplementerColumnBoundsMap = ReadonlyMap<string, FlowchartPelaksanaBoundsRect>;

export const FLOWCHART_CROSS_COLUMN_GUTTER_STEP_PX = 8

export interface BuildFlowchartCrossColumnPathInput {
  fromShape: Rect
  toShape: Rect
  fromIsDiamond: boolean
  toIsDiamond: boolean
  sSide: Side
  eSide: Side
  sourceJetty: number
  targetJetty: number
  columns: ImplementerColumnBoundsMap | null | undefined
  pelaksanaFallback: FlowchartPelaksanaBoundsRect | null | undefined
  gridLayout: FlowchartGridLayout | null
  gutterSlot: number
  fromRow: number
  toRow: number
}

function anchorOnShape(shape: Rect, side: Side, isDiamond: boolean): Point {
  if (isDiamond) return pointOnFlowchartDecisionVertex(shape, side)
  switch (side) {
    case "top":
      return { x: Math.round(shape.left + shape.width / 2), y: shape.top }
    case "bottom":
      return { x: Math.round(shape.left + shape.width / 2), y: shape.top + shape.height }
    case "left":
      return { x: shape.left, y: Math.round(shape.top + shape.height / 2) }
    case "right":
      return { x: shape.left + shape.width, y: Math.round(shape.top + shape.height / 2) }
  }
}

function extrude(shape: Rect, side: Side, isDiamond: boolean, margin: number): Point {
  const p = anchorOnShape(shape, side, isDiamond)
  switch (side) {
    case "top":
      return { x: p.x, y: p.y - margin }
    case "bottom":
      return { x: p.x, y: p.y + margin }
    case "left":
      return { x: p.x - margin, y: p.y }
    case "right":
      return { x: p.x + margin, y: p.y }
  }
}

function appendIfDistinct(path: Point[], pt: Point): void {
  const last = path[path.length - 1]
  if (!last || last.x !== pt.x || last.y !== pt.y) path.push(pt)
}

function rowPipeY(
  gridLayout: FlowchartGridLayout | null,
  row: number,
  fallbackY: number,
): number {
  if (!gridLayout) return fallbackY
  if (row >= 0 && row < gridLayout.rowGutters.length) {
    return gridLayout.rowGutters[row]!
  }
  return findFlowchartRowPipeY(gridLayout, Math.max(0, row - 1), row)
}

/** Path Z/bus untuk koneksi lintas kolom pelaksana (≥2 kolom berbeda). */
export function buildFlowchartCrossColumnPath(
  input: BuildFlowchartCrossColumnPathInput,
): Point[] | null {
  const {
    fromShape,
    toShape,
    fromIsDiamond,
    toIsDiamond,
    sSide,
    eSide,
    sourceJetty,
    targetJetty,
    columns,
    pelaksanaFallback,
    gridLayout,
    gutterSlot,
    fromRow,
    toRow,
  } = input
  const fromCx = fromShape.left + fromShape.width / 2
  const toCx = toShape.left + toShape.width / 2
  const fromCol = resolveColumnBoundsForShapeX(fromCx, columns, pelaksanaFallback)
  const toCol = resolveColumnBoundsForShapeX(toCx, columns, pelaksanaFallback)
  if (!fromCol || !toCol) return null
  const sameColumn =
    Math.abs(fromCol.left - toCol.left) < 4 && Math.abs(fromCol.right - toCol.right) < 4
  if (sameColumn) return null

  const oA = anchorOnShape(fromShape, sSide, fromIsDiamond)
  const oB = anchorOnShape(toShape, eSide, toIsDiamond)
  const extA = extrude(fromShape, sSide, fromIsDiamond, sourceJetty)
  const extB = extrude(toShape, eSide, toIsDiamond, targetJetty)
  const busXRaw = pickColumnGutterBusX(fromCol, toCol, gutterSlot)
  const minX = Math.min(fromCol.left, toCol.left) + 4
  const maxX = pelaksanaFallback
    ? pelaksanaFallback.right - MUTU_BAKU_RIGHT_GUARD_PX
    : Math.max(fromCol.right, toCol.right) - 4
  const busX = Math.round(Math.max(minX, Math.min(maxX, busXRaw)))
  const lowRow = Math.min(fromRow, toRow)
  const highRow = Math.max(fromRow, toRow)
  const busY =
    fromRow <= toRow
      ? rowPipeY(gridLayout, lowRow, (extA.y + extB.y) / 2)
      : rowPipeY(gridLayout, highRow - 1, (extA.y + extB.y) / 2)

  const path: Point[] = [oA, extA]
  if (extA.x !== busX) appendIfDistinct(path, { x: busX, y: extA.y })
  if (extA.y !== busY) appendIfDistinct(path, { x: busX, y: busY })
  if (extB.y !== busY) appendIfDistinct(path, { x: busX, y: extB.y })
  if (extB.x !== busX) appendIfDistinct(path, { x: extB.x, y: extB.y })
  appendIfDistinct(path, extB)
  appendIfDistinct(path, oB)
  return path.length >= 2 ? path : null
}

export interface CrossColumnRoutableMeta {
  id: string
  from: string
  to: string
  fromImplementerId?: string
  toImplementerId?: string
}

export function assignCrossColumnGutterSlots(
  connections: ReadonlyArray<CrossColumnRoutableMeta>,
): Map<string, number> {
  const cross = connections.filter((c) => {
    if (!c.fromImplementerId || !c.toImplementerId) return false
    if (c.fromImplementerId === c.toImplementerId) return false
    return true
  })
  cross.sort((a, b) => a.id.localeCompare(b.id))
  const perPair = new Map<string, number>()
  const map = new Map<string, number>()
  for (const c of cross) {
    const pairKey = [c.fromImplementerId, c.toImplementerId].sort().join("|")
    const slot = perPair.get(pairKey) ?? 0
    map.set(c.id, slot)
    perPair.set(pairKey, slot + 1)
  }
  return map
}
