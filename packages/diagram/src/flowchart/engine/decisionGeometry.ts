import type { FlowchartRect as DiagramShapeRect, FlowchartSide as DiagramAnchorSide } from "./types.js";

/**
 * Geometri diamond flowchart — selaras dengan polygon di SOPDiagramFlowchart.tsx:
 * viewBox="-2 -2 64 64", points="30,1 59,30 30,59 1,30"
 */
export const FLOWCHART_DECISION_VIEWBOX = {
  minX: -2,
  minY: -2,
  width: 64,
  height: 64,
} as const

/** Vertex dalam koordinat viewBox (urutan: top, right, bottom, left). */
export const FLOWCHART_DECISION_VERTICES_VIEWBOX: Record<DiagramAnchorSide, { x: number; y: number }> = {
  top: { x: 30, y: 1 },
  right: { x: 59, y: 30 },
  bottom: { x: 30, y: 59 },
  left: { x: 1, y: 30 },
}

export function pointOnFlowchartDecisionVertex(
  rect: DiagramShapeRect,
  side: DiagramAnchorSide,
): { x: number; y: number } {
  const vb = FLOWCHART_DECISION_VIEWBOX
  const v = FLOWCHART_DECISION_VERTICES_VIEWBOX[side]
  const x = rect.left + ((v.x - vb.minX) / vb.width) * rect.width
  const y = rect.top + ((v.y - vb.minY) / vb.height) * rect.height
  return { x: Math.round(x), y: Math.round(y) }
}

export function isFlowchartDecisionSide(side: string): side is DiagramAnchorSide {
  return side === "top" || side === "right" || side === "bottom" || side === "left"
}
