import type { FlowchartBounds } from "./types.js";

export const MUTU_BAKU_RIGHT_GUARD_PX = 28;
const ROUTING_INNER_INSET = 8;

export function inferTightColumnFromShape(
  shapeLeft: number,
  shapeRight: number,
  pelaksana: FlowchartBounds | null | undefined,
): FlowchartBounds | null {
  if (!pelaksana) return null;

  const pad = 16;
  return {
    left: Math.max(pelaksana.left + ROUTING_INNER_INSET, shapeLeft - pad),
    top: pelaksana.top + ROUTING_INNER_INSET,
    right: Math.min(
      pelaksana.right - MUTU_BAKU_RIGHT_GUARD_PX,
      shapeRight + pad,
    ),
    bottom: pelaksana.bottom - ROUTING_INNER_INSET,
  };
}

export function resolveColumnForConnection(
  actorId: string | null | undefined,
  shapeCenterX: number,
  shapeLeft: number,
  shapeRight: number,
  columns: ReadonlyMap<string, FlowchartBounds> | null | undefined,
  pelaksana: FlowchartBounds | null | undefined,
): FlowchartBounds | null {
  if (actorId && columns?.get(actorId)) {
    return columns.get(actorId) ?? null;
  }

  if (columns && columns.size > 0) {
    let best: FlowchartBounds | null = null;
    let bestOverlap = -1;

    for (const bounds of columns.values()) {
      if (shapeCenterX >= bounds.left && shapeCenterX <= bounds.right) {
        return bounds;
      }

      const overlap =
        Math.min(bounds.right, shapeRight) -
        Math.max(bounds.left, shapeLeft);

      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = bounds;
      }
    }

    if (best) return best;
  }

  return inferTightColumnFromShape(shapeLeft, shapeRight, pelaksana);
}

export function computeConnectionRoutingBounds(input: {
  pelaksana: FlowchartBounds | null | undefined;
  sourceColumn: FlowchartBounds | null | undefined;
  targetColumn: FlowchartBounds | null | undefined;
  isCrossColumn: boolean;
}): FlowchartBounds | null {
  const { pelaksana, sourceColumn, targetColumn, isCrossColumn } = input;
  const top = pelaksana?.top ?? sourceColumn?.top ?? 0;
  const bottom = pelaksana?.bottom ?? sourceColumn?.bottom ?? 9999;
  const maxRight =
    (pelaksana?.right ?? sourceColumn?.right ?? 9999) -
    MUTU_BAKU_RIGHT_GUARD_PX;

  if (sourceColumn && targetColumn && isCrossColumn) {
    const left =
      Math.min(sourceColumn.left, targetColumn.left) + ROUTING_INNER_INSET;
    const right = Math.min(
      maxRight,
      Math.max(sourceColumn.right, targetColumn.right) - ROUTING_INNER_INSET,
    );

    if (right <= left) return null;

    return {
      left,
      top: top + ROUTING_INNER_INSET,
      right,
      bottom: bottom - ROUTING_INNER_INSET,
    };
  }

  if (sourceColumn) {
    const left = sourceColumn.left + ROUTING_INNER_INSET;
    const right = Math.min(
      maxRight,
      sourceColumn.right - ROUTING_INNER_INSET,
    );

    if (right <= left) return null;

    return {
      left,
      top: top + ROUTING_INNER_INSET,
      right,
      bottom: bottom - ROUTING_INNER_INSET,
    };
  }

  if (pelaksana) {
    return {
      left: pelaksana.left + ROUTING_INNER_INSET,
      top: pelaksana.top + ROUTING_INNER_INSET,
      right: maxRight,
      bottom: pelaksana.bottom - ROUTING_INNER_INSET,
    };
  }

  return null;
}

export function routingBoundsToRouterRect(
  bounds: FlowchartBounds,
): { left: number; top: number; width: number; height: number } {
  return {
    left: bounds.left,
    top: bounds.top,
    width: Math.max(12, bounds.right - bounds.left),
    height: Math.max(40, bounds.bottom - bounds.top),
  };
}
