import type { FlowchartBounds } from "./types.js";

export type FlowchartColumnBounds = FlowchartBounds;

export function resolveColumnBoundsForShapeX(
  shapeCenterX: number,
  columns: ReadonlyMap<string, FlowchartColumnBounds> | null | undefined,
  pelaksanaFallback: FlowchartBounds | null | undefined,
): FlowchartColumnBounds | null {
  if (columns && columns.size > 0) {
    let best: FlowchartColumnBounds | null = null;
    let bestOverlap = -1;

    for (const bounds of columns.values()) {
      if (shapeCenterX >= bounds.left && shapeCenterX <= bounds.right) {
        return bounds;
      }

      const overlap =
        Math.min(bounds.right, shapeCenterX + 40) -
        Math.max(bounds.left, shapeCenterX - 40);

      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = bounds;
      }
    }

    if (best) return best;
  }

  return pelaksanaFallback ?? null;
}

export function columnBoundsToCorridor(
  bounds: FlowchartBounds,
): FlowchartBounds {
  return { ...bounds };
}

export function pickColumnPipeX(
  side: "left" | "right",
  column: FlowchartBounds,
  slotIndex: number,
  stepPx: number,
): number {
  const inset = 10;

  if (side === "left") {
    return Math.round(column.left + inset + slotIndex * stepPx);
  }

  return Math.round(column.right - inset - slotIndex * stepPx);
}

export function pickColumnGutterBusX(
  fromColumn: FlowchartBounds,
  toColumn: FlowchartBounds,
  gutterSlot: number,
): number {
  const step = 8;

  if (fromColumn.left <= toColumn.left) {
    const gapLeft = fromColumn.right;
    const gapRight = toColumn.left;
    const mid = (gapLeft + gapRight) / 2;

    return Math.round(
      mid +
        (gutterSlot % 2 === 0 ? -1 : 1) *
          Math.ceil(gutterSlot / 2) *
          step,
    );
  }

  const gapLeft = toColumn.right;
  const gapRight = fromColumn.left;
  const mid = (gapLeft + gapRight) / 2;

  return Math.round(
    mid +
      (gutterSlot % 2 === 0 ? 1 : -1) *
        Math.ceil(gutterSlot / 2) *
        step,
  );
}
