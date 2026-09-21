import type {
  FlowchartGridLayout,
  FlowchartPoint,
} from "./types.js";

export const FLOWCHART_GRID_CLEARANCE = 8;
export const FLOWCHART_ROW_BORDER_INSET = 16;

function rangesIntersect(
  a1: number,
  a2: number,
  b1: number,
  b2: number,
): boolean {
  const aMin = Math.min(a1, a2);
  const aMax = Math.max(a1, a2);
  const bMin = Math.min(b1, b2);
  const bMax = Math.max(b1, b2);
  return aMin < bMax && bMin < aMax;
}

export function findFlowchartRowPipeY(
  layout: FlowchartGridLayout,
  aboveRow: number,
  belowRow: number,
): number {
  if (aboveRow < 0 || belowRow >= layout.rowGutters.length + 1) {
    if (layout.horizontalLines.length > 0) {
      if (aboveRow < 0) return (layout.horizontalLines[0] ?? 0) - 20;
      return (layout.horizontalLines.at(-1) ?? 0) + 20;
    }

    return 0;
  }

  const gutterIndex = belowRow - 1;
  if (gutterIndex >= 0 && gutterIndex < layout.rowGutters.length) {
    return layout.rowGutters[gutterIndex] ?? layout.minGridY;
  }

  return layout.minGridY;
}

export function pathRunsAlongFlowchartGrid(
  path: readonly FlowchartPoint[],
  layout: FlowchartGridLayout | null | undefined,
  clearance = FLOWCHART_GRID_CLEARANCE,
): boolean {
  if (!layout || path.length < 2) return false;
  if (
    layout.horizontalLines.length === 0 ||
    layout.verticalLines.length === 0
  ) {
    return false;
  }

  for (let index = 0; index < path.length - 1; index += 1) {
    const a = path[index];
    const b = path[index + 1];
    if (!a || !b) continue;

    if (a.y === b.y && a.x !== b.x) {
      for (const y of layout.horizontalLines) {
        if (
          Math.abs(a.y - y) <= clearance &&
          rangesIntersect(a.x, b.x, layout.minGridX, layout.maxGridX)
        ) {
          return true;
        }
      }
    }

    if (a.x === b.x && a.y !== b.y) {
      for (const x of layout.verticalLines) {
        if (
          Math.abs(a.x - x) <= clearance &&
          rangesIntersect(a.y, b.y, layout.minGridY, layout.maxGridY)
        ) {
          return true;
        }
      }
    }
  }

  return false;
}
