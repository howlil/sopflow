import { pickColumnPipeX } from "./columns.js";
import { pointOnFlowchartDecisionVertex } from "./decisionGeometry.js";
import { findFlowchartRowPipeY } from "./grid.js";
import type {
  FlowchartBounds,
  FlowchartGridLayout,
  FlowchartPoint,
  FlowchartRect,
  FlowchartRouteConnection,
  FlowchartSide,
} from "./types.js";

export const FLOWCHART_LOOPBACK_CORRIDOR_STEP_PX = 18;

function anchorOnShape(
  shape: FlowchartRect,
  side: FlowchartSide,
  isDiamond: boolean,
): FlowchartPoint {
  if (isDiamond) return pointOnFlowchartDecisionVertex(shape, side);

  switch (side) {
    case "top":
      return { x: Math.round(shape.left + shape.width / 2), y: shape.top };
    case "bottom":
      return {
        x: Math.round(shape.left + shape.width / 2),
        y: shape.top + shape.height,
      };
    case "left":
      return {
        x: shape.left,
        y: Math.round(shape.top + shape.height / 2),
      };
    case "right":
      return {
        x: shape.left + shape.width,
        y: Math.round(shape.top + shape.height / 2),
      };
  }
}

function extrude(
  shape: FlowchartRect,
  side: FlowchartSide,
  isDiamond: boolean,
  margin: number,
): FlowchartPoint {
  const point = anchorOnShape(shape, side, isDiamond);

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

export function assignLoopbackCorridorIndices(
  connections: readonly FlowchartRouteConnection[],
): Map<string, number> {
  const loopbacks = connections
    .filter((connection) => connection.toRow < connection.fromRow)
    .toSorted((left, right) => left.id.localeCompare(right.id));

  const perColumn = new Map<string, number>();
  const result = new Map<string, number>();

  for (const connection of loopbacks) {
    const key = connection.fromActorId ?? `shape:${connection.from}`;
    const slot = perColumn.get(key) ?? 0;
    result.set(connection.id, slot);
    perColumn.set(key, slot + 1);
  }

  return result;
}

export function isHorizontalLoopbackSides(
  sourceSide: FlowchartSide,
  targetSide: FlowchartSide,
): boolean {
  return (
    sourceSide === targetSide &&
    (sourceSide === "left" || sourceSide === "right")
  );
}

export function buildFlowchartLoopbackPath(input: {
  fromShape: FlowchartRect;
  toShape: FlowchartRect;
  sSide: FlowchartSide;
  eSide: FlowchartSide;
  fromIsDiamond: boolean;
  toIsDiamond: boolean;
  sourceJetty: number;
  targetJetty: number;
  corridorBounds: FlowchartBounds;
  gridLayout: FlowchartGridLayout | null;
  corridorIndex: number;
  fromRow: number;
  toRow: number;
}): FlowchartPoint[] | null {
  const {
    fromShape,
    toShape,
    sSide,
    eSide,
    fromIsDiamond,
    toIsDiamond,
    sourceJetty,
    targetJetty,
    corridorBounds,
    gridLayout,
    corridorIndex,
    fromRow,
    toRow,
  } = input;

  if (!isHorizontalLoopbackSides(sSide, eSide)) return null;

  const start = anchorOnShape(fromShape, sSide, fromIsDiamond);
  const end = anchorOnShape(toShape, eSide, toIsDiamond);
  const startJetty = extrude(fromShape, sSide, fromIsDiamond, sourceJetty);
  const endJetty = extrude(toShape, eSide, toIsDiamond, targetJetty);
  const pipeX = pickColumnPipeX(
    sSide,
    corridorBounds,
    corridorIndex,
    FLOWCHART_LOOPBACK_CORRIDOR_STEP_PX,
  );
  const clampedPipeX = Math.max(
    corridorBounds.left + 8,
    Math.min(corridorBounds.right - 8, pipeX),
  );
  const points: FlowchartPoint[] = [start, startJetty];

  const minY = Math.min(startJetty.y, endJetty.y);
  const maxY = Math.max(startJetty.y, endJetty.y);
  points.push({ x: clampedPipeX, y: startJetty.y });

  if (gridLayout && fromRow > toRow + 1) {
    const lowRow = Math.min(fromRow, toRow);
    const highRow = Math.max(fromRow, toRow);

    for (let row = lowRow; row < highRow; row += 1) {
      const gutterY =
        row >= 0 && row < gridLayout.rowGutters.length
          ? gridLayout.rowGutters[row]
          : findFlowchartRowPipeY(gridLayout, row, row + 1);

      if (
        gutterY !== undefined &&
        gutterY > minY + 8 &&
        gutterY < maxY - 8
      ) {
        points.push({ x: clampedPipeX, y: gutterY });
      }
    }
  }

  points.push({ x: clampedPipeX, y: endJetty.y }, endJetty, end);
  return dedupe(points);
}

function dedupe(points: readonly FlowchartPoint[]): FlowchartPoint[] {
  const result: FlowchartPoint[] = [];

  for (const point of points) {
    const previous = result.at(-1);
    if (previous?.x === point.x && previous.y === point.y) continue;
    result.push({ ...point });
  }

  return result;
}
