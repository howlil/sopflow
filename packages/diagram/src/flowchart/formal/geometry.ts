import type { DiagramPoint } from "../../types.js";
import type {
  FormalFlowchartBounds,
  FormalFlowchartColumnBounds,
  FormalFlowchartGridLayout,
  FormalFlowchartRect,
  FormalFlowchartSide,
} from "./types.js";

export const FORMAL_FLOWCHART_DECISION_VIEWBOX = {
  minX: -2,
  minY: -2,
  width: 64,
  height: 64,
} as const;

export const FORMAL_FLOWCHART_DECISION_VERTICES: Record<
  FormalFlowchartSide,
  DiagramPoint
> = {
  top: { x: 30, y: 1 },
  right: { x: 59, y: 30 },
  bottom: { x: 30, y: 59 },
  left: { x: 1, y: 30 },
};

export const FORMAL_FLOWCHART_LOOPBACK_STEP_PX = 18;
export const FORMAL_FLOWCHART_COLUMN_TRUNK_STEP_PX = 10;
export const FORMAL_FLOWCHART_CROSS_COLUMN_GUTTER_STEP_PX = 8;
export const FORMAL_FLOWCHART_MUTU_BAKU_RIGHT_GUARD_PX = 28;
export const FORMAL_FLOWCHART_GRID_CLEARANCE = 8;

const ROUTING_INNER_INSET = 8;

export function pointOnFormalDecisionVertex(
  rect: FormalFlowchartRect,
  side: FormalFlowchartSide,
): DiagramPoint {
  const vb = FORMAL_FLOWCHART_DECISION_VIEWBOX;
  const vertex = FORMAL_FLOWCHART_DECISION_VERTICES[side];

  return {
    x: Math.round(
      rect.left + ((vertex.x - vb.minX) / vb.width) * rect.width,
    ),
    y: Math.round(
      rect.top + ((vertex.y - vb.minY) / vb.height) * rect.height,
    ),
  };
}

export function pointOnFormalShape(
  rect: FormalFlowchartRect,
  side: FormalFlowchartSide,
  isDecision: boolean,
): DiagramPoint {
  if (isDecision) return pointOnFormalDecisionVertex(rect, side);

  switch (side) {
    case "top":
      return {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top),
      };
    case "bottom":
      return {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height),
      };
    case "left":
      return {
        x: Math.round(rect.left),
        y: Math.round(rect.top + rect.height / 2),
      };
    case "right":
      return {
        x: Math.round(rect.left + rect.width),
        y: Math.round(rect.top + rect.height / 2),
      };
  }
}

export function extrudeFormalShapePoint(
  rect: FormalFlowchartRect,
  side: FormalFlowchartSide,
  isDecision: boolean,
  margin: number,
): DiagramPoint {
  const point = pointOnFormalShape(rect, side, isDecision);

  switch (side) {
    case "top":
      return { x: point.x, y: point.y - margin };
    case "bottom":
      return { x: point.x, y: point.y + margin };
    case "left":
      return { x: point.x - margin, y: point.y };
    case "right":
      return { x: point.x + margin, y: point.y };
  }
}

export function resolveFormalColumnBoundsForShapeX(
  shapeCenterX: number,
  columns: FormalFlowchartColumnBounds | null | undefined,
  fallback: FormalFlowchartBounds | null | undefined,
): FormalFlowchartBounds | null {
  if (columns && Object.keys(columns).length > 0) {
    let best: FormalFlowchartBounds | null = null;
    let bestOverlap = -Infinity;

    for (const bounds of Object.values(columns)) {
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

  return fallback ?? null;
}

export function resolveFormalColumnForConnection(
  actorId: string | null | undefined,
  shape: FormalFlowchartRect,
  columns: FormalFlowchartColumnBounds | null | undefined,
  pelaksana: FormalFlowchartBounds | null | undefined,
): FormalFlowchartBounds | null {
  if (actorId && columns?.[actorId]) return columns[actorId];

  const centerX = shape.left + shape.width / 2;
  const byCenter = resolveFormalColumnBoundsForShapeX(
    centerX,
    columns,
    pelaksana,
  );
  if (byCenter && byCenter !== pelaksana) return byCenter;
  if (!pelaksana) return byCenter;

  const pad = 16;
  return {
    left: Math.max(pelaksana.left + ROUTING_INNER_INSET, shape.left - pad),
    top: pelaksana.top + ROUTING_INNER_INSET,
    right: Math.min(
      pelaksana.right - FORMAL_FLOWCHART_MUTU_BAKU_RIGHT_GUARD_PX,
      shape.left + shape.width + pad,
    ),
    bottom: pelaksana.bottom - ROUTING_INNER_INSET,
  };
}

export function computeFormalConnectionRoutingBounds(input: {
  readonly pelaksana: FormalFlowchartBounds | null | undefined;
  readonly sourceColumn: FormalFlowchartBounds | null | undefined;
  readonly targetColumn: FormalFlowchartBounds | null | undefined;
  readonly isCrossColumn: boolean;
}): FormalFlowchartBounds | null {
  const { pelaksana, sourceColumn, targetColumn, isCrossColumn } = input;
  const top = pelaksana?.top ?? sourceColumn?.top ?? 0;
  const bottom = pelaksana?.bottom ?? sourceColumn?.bottom ?? 9999;
  const maxRight =
    (pelaksana?.right ?? sourceColumn?.right ?? 9999) -
    FORMAL_FLOWCHART_MUTU_BAKU_RIGHT_GUARD_PX;

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

export function pickFormalColumnPipeX(
  side: "left" | "right",
  column: FormalFlowchartBounds,
  slotIndex: number,
  stepPx: number,
): number {
  const inset = 10;

  if (side === "left") {
    return Math.round(column.left + inset + slotIndex * stepPx);
  }

  return Math.round(column.right - inset - slotIndex * stepPx);
}

export function pickFormalColumnGutterBusX(
  fromColumn: FormalFlowchartBounds,
  toColumn: FormalFlowchartBounds,
  gutterSlot: number,
): number {
  const step = FORMAL_FLOWCHART_CROSS_COLUMN_GUTTER_STEP_PX;

  if (fromColumn.left <= toColumn.left) {
    const mid = (fromColumn.right + toColumn.left) / 2;
    return Math.round(
      mid +
        (gutterSlot % 2 === 0 ? -1 : 1) *
          Math.ceil(gutterSlot / 2) *
          step,
    );
  }

  const mid = (toColumn.right + fromColumn.left) / 2;
  return Math.round(
    mid +
      (gutterSlot % 2 === 0 ? 1 : -1) *
        Math.ceil(gutterSlot / 2) *
        step,
  );
}

export function findFormalRowPipeY(
  layout: FormalFlowchartGridLayout,
  aboveRow: number,
  belowRow: number,
): number {
  if (aboveRow < 0 || belowRow >= layout.rowGutters.length + 1) {
    if (layout.horizontalLines.length > 0) {
      if (aboveRow < 0) return (layout.horizontalLines[0] ?? 0) - 20;
      return (layout.horizontalLines.at(-1) ?? layout.maxGridY) + 20;
    }
    return 0;
  }

  const gutterIndex = belowRow - 1;
  if (gutterIndex >= 0 && gutterIndex < layout.rowGutters.length) {
    return layout.rowGutters[gutterIndex] ?? layout.minGridY;
  }

  return layout.minGridY;
}

export function pathWithinFormalBounds(
  path: readonly DiagramPoint[],
  bounds: FormalFlowchartBounds | null | undefined,
  margin = 0,
): boolean {
  if (!bounds || path.length === 0) return true;

  return path.every(
    (point) =>
      point.x >= bounds.left - margin &&
      point.x <= bounds.right + margin &&
      point.y >= bounds.top - margin &&
      point.y <= bounds.bottom + margin,
  );
}

export function clampPointToFormalBounds(
  point: DiagramPoint,
  bounds: FormalFlowchartBounds | null | undefined,
): DiagramPoint {
  if (!bounds) return { x: Math.round(point.x), y: Math.round(point.y) };

  return {
    x: Math.round(Math.max(bounds.left, Math.min(bounds.right, point.x))),
    y: Math.round(Math.max(bounds.top, Math.min(bounds.bottom, point.y))),
  };
}
