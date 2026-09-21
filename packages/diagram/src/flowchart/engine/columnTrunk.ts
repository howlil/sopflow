import { pointOnFlowchartDecisionVertex } from "./decisionGeometry.js";
import { pickColumnPipeX } from "./columns.js";
import type {
  FlowchartBounds as FlowchartPelaksanaBoundsRect,
  FlowchartPoint as Point,
  FlowchartRect as Rect,
  FlowchartSide as Side,
} from "./types.js";

export const FLOWCHART_COLUMN_TRUNK_STEP_PX = 10

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

export interface BuildFlowchartColumnTrunkPathInput {
  fromShape: Rect
  toShape: Rect
  fromIsDiamond: boolean
  toIsDiamond: boolean
  column: FlowchartPelaksanaBoundsRect
  trunkSlot: number
  sourceJetty: number
  targetJetty: number
}

/**
 * Trunk vertikal di tengah kolom untuk alur ke bawah same-column (bottom→top).
 * Slot memisahkan beberapa panah vertikal di kolom yang sama.
 */
export function buildFlowchartColumnTrunkPath(
  input: BuildFlowchartColumnTrunkPathInput,
): Point[] | null {
  const {
    fromShape,
    toShape,
    fromIsDiamond,
    toIsDiamond,
    column,
    trunkSlot,
    sourceJetty,
    targetJetty,
  } = input
  const oA = anchorOnShape(fromShape, "bottom", fromIsDiamond)
  const oB = anchorOnShape(toShape, "top", toIsDiamond)
  const extA = extrude(fromShape, "bottom", fromIsDiamond, sourceJetty)
  const extB = extrude(toShape, "top", toIsDiamond, targetJetty)
  const side: "left" | "right" = trunkSlot % 2 === 0 ? "left" : "right"
  const pipeX = pickColumnPipeX(side, column, Math.floor(trunkSlot / 2), FLOWCHART_COLUMN_TRUNK_STEP_PX)
  const path: Point[] = [oA, extA]
  if (Math.abs(extA.x - pipeX) > 1) path.push({ x: pipeX, y: extA.y })
  path.push({ x: pipeX, y: extB.y })
  if (Math.abs(extB.x - pipeX) > 1) path.push({ x: extB.x, y: extB.y })
  path.push(extB, oB)
  return path.length >= 2 ? path : null
}

export interface TrunkRoutableMeta {
  id: string
  from: string
  to: string
  fromImplementerId?: string
  label?: string | null
  sourceType?: string
}

export function assignColumnTrunkSlots(
  connections: ReadonlyArray<TrunkRoutableMeta>,
): Map<string, number> {
  const trunks = connections.filter((c) => {
    if (!c.fromImplementerId) return false
    const fromSeq = Number((c.from.match(/(\d+)/) ?? [])[1])
    const toSeq = Number((c.to.match(/(\d+)/) ?? [])[1])
    if (!Number.isFinite(fromSeq) || !Number.isFinite(toSeq)) return false
    return toSeq > fromSeq && c.sourceType !== "flowchart-decision"
  })
  trunks.sort((a, b) => a.id.localeCompare(b.id))
  const perCol = new Map<string, number>()
  const map = new Map<string, number>()
  for (const c of trunks) {
    const col = c.fromImplementerId!
    const slot = perCol.get(col) ?? 0
    map.set(c.id, slot)
    perCol.set(col, slot + 1)
  }
  return map
}
