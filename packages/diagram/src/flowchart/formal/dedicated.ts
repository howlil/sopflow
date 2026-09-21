import type { DiagramPoint } from "../../types.js";
import {
  computeFormalConnectionRoutingBounds,
  extrudeFormalShapePoint,
  findFormalRowPipeY,
  FORMAL_FLOWCHART_COLUMN_TRUNK_STEP_PX,
  FORMAL_FLOWCHART_LOOPBACK_STEP_PX,
  FORMAL_FLOWCHART_MUTU_BAKU_RIGHT_GUARD_PX,
  pathWithinFormalBounds,
  pickFormalColumnGutterBusX,
  pickFormalColumnPipeX,
  pointOnFormalShape,
  resolveFormalColumnBoundsForShapeX,
} from "./geometry.js";
import {
  formalPathIntersectsRectangles,
  formalPathOverlapsSegments,
  scoreFormalPath,
} from "./orthogonal.js";
import type {
  FormalFlowchartBounds,
  FormalFlowchartColumnBounds,
  FormalFlowchartGridLayout,
  FormalFlowchartOccupiedSegment,
  FormalFlowchartRect,
  FormalFlowchartRouteResult,
  FormalFlowchartSide,
} from "./types.js";

export interface FormalRouteMeta {
  readonly id: string;
  readonly fromRow: number;
  readonly toRow: number;
  readonly fromActorId: string | null;
  readonly toActorId: string | null;
  readonly sourceType:
    | "flowchart-terminator"
    | "flowchart-process"
    | "flowchart-decision";
  readonly targetType:
    | "flowchart-terminator"
    | "flowchart-process"
    | "flowchart-decision";
  readonly label?: string | null;
}

export function assignFormalLoopbackSlots(
  connections: readonly FormalRouteMeta[],
): Map<string, number> {
  const perColumn = new Map<string, number>();
  const result = new Map<string, number>();

  for (const connection of [...connections]
    .filter((item) => item.toRow < item.fromRow)
    .sort((a, b) => a.id.localeCompare(b.id))) {
    const columnKey = connection.fromActorId ?? `row:${connection.fromRow}`;
    const slot = perColumn.get(columnKey) ?? 0;
    result.set(connection.id, slot);
    perColumn.set(columnKey, slot + 1);
  }

  return result;
}

export function assignFormalCrossColumnSlots(
  connections: readonly FormalRouteMeta[],
): Map<string, number> {
  const perPair = new Map<string, number>();
  const result = new Map<string, number>();

  for (const connection of [...connections]
    .filter(
      (item) =>
        item.fromActorId &&
        item.toActorId &&
        item.fromActorId !== item.toActorId,
    )
    .sort((a, b) => a.id.localeCompare(b.id))) {
    const pairKey = [connection.fromActorId, connection.toActorId]
      .sort()
      .join("|");
    const slot = perPair.get(pairKey) ?? 0;
    result.set(connection.id, slot);
    perPair.set(pairKey, slot + 1);
  }

  return result;
}

export function assignFormalColumnTrunkSlots(
  connections: readonly FormalRouteMeta[],
): Map<string, number> {
  const perColumn = new Map<string, number>();
  const result = new Map<string, number>();

  for (const connection of [...connections]
    .filter(
      (item) =>
        item.fromActorId &&
        item.toRow > item.fromRow &&
        item.sourceType !== "flowchart-decision",
    )
    .sort((a, b) => a.id.localeCompare(b.id))) {
    const columnKey = connection.fromActorId as string;
    const slot = perColumn.get(columnKey) ?? 0;
    result.set(connection.id, slot);
    perColumn.set(columnKey, slot + 1);
  }

  return result;
}

export function buildFormalColumnTrunkPath(input: {
  readonly source: FormalFlowchartRect;
  readonly target: FormalFlowchartRect;
  readonly sourceDecision: boolean;
  readonly targetDecision: boolean;
  readonly column: FormalFlowchartBounds;
  readonly slot: number;
  readonly sourceJetty: number;
  readonly targetJetty: number;
}): DiagramPoint[] {
  const start = pointOnFormalShape(
    input.source,
    "bottom",
    input.sourceDecision,
  );
  const end = pointOnFormalShape(input.target, "top", input.targetDecision);
  const sourceExit = extrudeFormalShapePoint(
    input.source,
    "bottom",
    input.sourceDecision,
    input.sourceJetty,
  );
  const targetEntry = extrudeFormalShapePoint(
    input.target,
    "top",
    input.targetDecision,
    input.targetJetty,
  );
  const side = input.slot % 2 === 0 ? "left" : "right";
  const pipeX = pickFormalColumnPipeX(
    side,
    input.column,
    Math.floor(input.slot / 2),
    FORMAL_FLOWCHART_COLUMN_TRUNK_STEP_PX,
  );

  return compact([
    start,
    sourceExit,
    { x: pipeX, y: sourceExit.y },
    { x: pipeX, y: targetEntry.y },
    { x: targetEntry.x, y: targetEntry.y },
    targetEntry,
    end,
  ]);
}

export function buildFormalCrossColumnPath(input: {
  readonly source: FormalFlowchartRect;
  readonly target: FormalFlowchartRect;
  readonly sourceDecision: boolean;
  readonly targetDecision: boolean;
  readonly sourceSide: FormalFlowchartSide;
  readonly targetSide: FormalFlowchartSide;
  readonly sourceJetty: number;
  readonly targetJetty: number;
  readonly columns: FormalFlowchartColumnBounds;
  readonly pelaksana: FormalFlowchartBounds | null;
  readonly gridLayout: FormalFlowchartGridLayout | null;
  readonly slot: number;
  readonly fromRow: number;
  readonly toRow: number;
}): DiagramPoint[] | null {
  const sourceCenterX = input.source.left + input.source.width / 2;
  const targetCenterX = input.target.left + input.target.width / 2;
  const sourceColumn = resolveFormalColumnBoundsForShapeX(
    sourceCenterX,
    input.columns,
    input.pelaksana,
  );
  const targetColumn = resolveFormalColumnBoundsForShapeX(
    targetCenterX,
    input.columns,
    input.pelaksana,
  );

  if (!sourceColumn || !targetColumn) return null;

  const sameColumn =
    Math.abs(sourceColumn.left - targetColumn.left) < 4 &&
    Math.abs(sourceColumn.right - targetColumn.right) < 4;
  if (sameColumn) return null;

  const start = pointOnFormalShape(
    input.source,
    input.sourceSide,
    input.sourceDecision,
  );
  const end = pointOnFormalShape(
    input.target,
    input.targetSide,
    input.targetDecision,
  );
  const sourceExit = extrudeFormalShapePoint(
    input.source,
    input.sourceSide,
    input.sourceDecision,
    input.sourceJetty,
  );
  const targetEntry = extrudeFormalShapePoint(
    input.target,
    input.targetSide,
    input.targetDecision,
    input.targetJetty,
  );

  const rawBusX = pickFormalColumnGutterBusX(
    sourceColumn,
    targetColumn,
    input.slot,
  );
  const minX = Math.min(sourceColumn.left, targetColumn.left) + 4;
  const maxX = input.pelaksana
    ? input.pelaksana.right - FORMAL_FLOWCHART_MUTU_BAKU_RIGHT_GUARD_PX
    : Math.max(sourceColumn.right, targetColumn.right) - 4;
  const busX = Math.round(Math.max(minX, Math.min(maxX, rawBusX)));

  const lowRow = Math.min(input.fromRow, input.toRow);
  const highRow = Math.max(input.fromRow, input.toRow);
  const fallbackY = (sourceExit.y + targetEntry.y) / 2;
  const busY = input.gridLayout
    ? input.fromRow <= input.toRow
      ? rowPipe(input.gridLayout, lowRow, fallbackY)
      : rowPipe(input.gridLayout, highRow - 1, fallbackY)
    : Math.round(fallbackY);

  return compact([
    start,
    sourceExit,
    { x: busX, y: sourceExit.y },
    { x: busX, y: busY },
    { x: busX, y: targetEntry.y },
    { x: targetEntry.x, y: targetEntry.y },
    targetEntry,
    end,
  ]);
}

export function buildFormalLoopbackPath(input: {
  readonly source: FormalFlowchartRect;
  readonly target: FormalFlowchartRect;
  readonly sourceDecision: boolean;
  readonly targetDecision: boolean;
  readonly side: "left" | "right";
  readonly sourceJetty: number;
  readonly targetJetty: number;
  readonly corridor: FormalFlowchartBounds;
  readonly gridLayout: FormalFlowchartGridLayout | null;
  readonly slot: number;
  readonly fromRow: number;
  readonly toRow: number;
}): DiagramPoint[] {
  const start = pointOnFormalShape(
    input.source,
    input.side,
    input.sourceDecision,
  );
  const end = pointOnFormalShape(
    input.target,
    input.side,
    input.targetDecision,
  );
  const sourceExit = extrudeFormalShapePoint(
    input.source,
    input.side,
    input.sourceDecision,
    input.sourceJetty,
  );
  const targetEntry = extrudeFormalShapePoint(
    input.target,
    input.side,
    input.targetDecision,
    input.targetJetty,
  );

  const rawPipeX = pickFormalColumnPipeX(
    input.side,
    input.corridor,
    input.slot,
    FORMAL_FLOWCHART_LOOPBACK_STEP_PX,
  );
  const pipeX = Math.max(
    input.corridor.left + 8,
    Math.min(input.corridor.right - 8, rawPipeX),
  );

  const vertical: DiagramPoint[] = [{ x: pipeX, y: sourceExit.y }];

  if (input.gridLayout && input.fromRow > input.toRow + 1) {
    const minY = Math.min(sourceExit.y, targetEntry.y);
    const maxY = Math.max(sourceExit.y, targetEntry.y);

    for (let row = input.toRow; row < input.fromRow; row += 1) {
      const gutterY = rowPipe(input.gridLayout, row, minY);
      if (gutterY > minY + 8 && gutterY < maxY - 8) {
        vertical.push({ x: pipeX, y: gutterY });
      }
    }
  }

  vertical.push({ x: pipeX, y: targetEntry.y });

  return compact([
    start,
    sourceExit,
    ...vertical,
    { x: targetEntry.x, y: targetEntry.y },
    targetEntry,
    end,
  ]);
}

export function tryBuildFormalDedicatedRoute(input: {
  readonly meta: FormalRouteMeta;
  readonly source: FormalFlowchartRect;
  readonly target: FormalFlowchartRect;
  readonly sourceColumn: FormalFlowchartBounds | null;
  readonly targetColumn: FormalFlowchartBounds | null;
  readonly pelaksana: FormalFlowchartBounds | null;
  readonly columns: FormalFlowchartColumnBounds;
  readonly gridLayout: FormalFlowchartGridLayout | null;
  readonly obstacles: readonly FormalFlowchartRect[];
  readonly occupied: readonly FormalFlowchartOccupiedSegment[];
  readonly loopbackSlot: number;
  readonly crossColumnSlot: number;
  readonly columnTrunkSlot: number;
  readonly sourceJetty: number;
  readonly targetJetty: number;
}): FormalFlowchartRouteResult | null {
  const { meta } = input;
  const sourceCenterX = input.source.left + input.source.width / 2;
  const targetCenterX = input.target.left + input.target.width / 2;
  const sameColumn =
    meta.fromActorId === meta.toActorId ||
    Math.abs(sourceCenterX - targetCenterX) <
      Math.max(input.source.width, input.target.width) * 0.5;
  const crossColumn = !sameColumn;
  const destinationAbove = meta.toRow < meta.fromRow;
  const destinationBelow = meta.toRow > meta.fromRow;
  const rowSpan = Math.abs(meta.toRow - meta.fromRow);
  const sourceDecision = meta.sourceType === "flowchart-decision";
  const targetDecision = meta.targetType === "flowchart-decision";
  const routingBounds = computeFormalConnectionRoutingBounds({
    pelaksana: input.pelaksana,
    sourceColumn: input.sourceColumn,
    targetColumn: input.targetColumn,
    isCrossColumn: crossColumn,
  });

  const usable = (path: readonly DiagramPoint[]) =>
    path.length >= 2 &&
    pathWithinFormalBounds(path, routingBounds) &&
    !formalPathIntersectsRectangles(path, input.obstacles, 2) &&
    !formalPathOverlapsSegments(path, input.occupied);

  if (destinationAbove && input.sourceColumn) {
    const corridor =
      routingBounds ?? mergeBounds(input.sourceColumn, input.targetColumn);
    const targetLeft = targetCenterX < sourceCenterX;
    const sides: Array<"left" | "right"> = targetLeft
      ? ["left", "right"]
      : ["right", "left"];
    let best: FormalFlowchartRouteResult | null = null;

    for (const side of sides) {
      const path = buildFormalLoopbackPath({
        source: input.source,
        target: input.target,
        sourceDecision,
        targetDecision,
        side,
        sourceJetty: input.sourceJetty,
        targetJetty: input.targetJetty,
        corridor,
        gridLayout: input.gridLayout,
        slot: input.loopbackSlot,
        fromRow: meta.fromRow,
        toRow: meta.toRow,
      });

      if (!usable(path)) continue;

      const candidate: FormalFlowchartRouteResult = {
        points: path,
        sourceSide: side,
        targetSide: side,
      };

      if (
        !best ||
        scoreFormalPath(candidate.points, input.occupied) <
          scoreFormalPath(best.points, input.occupied)
      ) {
        best = candidate;
      }
    }

    if (best) return best;
  }

  if (crossColumn && rowSpan >= 2) {
    const sidePairs: Array<[FormalFlowchartSide, FormalFlowchartSide]> = [
      ["bottom", "top"],
      ["right", "top"],
      ["left", "top"],
      ["bottom", "left"],
      ["bottom", "right"],
    ];
    let best: FormalFlowchartRouteResult | null = null;

    for (const [sourceSide, targetSide] of sidePairs) {
      const path = buildFormalCrossColumnPath({
        source: input.source,
        target: input.target,
        sourceDecision,
        targetDecision,
        sourceSide,
        targetSide,
        sourceJetty: input.sourceJetty,
        targetJetty: input.targetJetty,
        columns: input.columns,
        pelaksana: input.pelaksana,
        gridLayout: input.gridLayout,
        slot: input.crossColumnSlot,
        fromRow: meta.fromRow,
        toRow: meta.toRow,
      });

      if (!path || !usable(path)) continue;

      const candidate: FormalFlowchartRouteResult = {
        points: path,
        sourceSide,
        targetSide,
      };

      if (
        !best ||
        scoreFormalPath(candidate.points, input.occupied) <
          scoreFormalPath(best.points, input.occupied)
      ) {
        best = candidate;
      }
    }

    if (best) return best;
  }

  if (
    destinationBelow &&
    sameColumn &&
    input.sourceColumn &&
    !sourceDecision &&
    rowSpan >= 2
  ) {
    const path = buildFormalColumnTrunkPath({
      source: input.source,
      target: input.target,
      sourceDecision,
      targetDecision,
      column: input.sourceColumn,
      slot: input.columnTrunkSlot,
      sourceJetty: input.sourceJetty,
      targetJetty: input.targetJetty,
    });

    if (usable(path)) {
      return {
        points: path,
        sourceSide: "bottom",
        targetSide: "top",
      };
    }
  }

  return null;
}

function mergeBounds(
  source: FormalFlowchartBounds,
  target: FormalFlowchartBounds | null,
): FormalFlowchartBounds {
  if (!target) return source;

  return {
    left: Math.min(source.left, target.left),
    top: Math.min(source.top, target.top),
    right: Math.max(source.right, target.right),
    bottom: Math.max(source.bottom, target.bottom),
  };
}

function rowPipe(
  layout: FormalFlowchartGridLayout,
  row: number,
  fallback: number,
): number {
  if (row >= 0 && row < layout.rowGutters.length) {
    return layout.rowGutters[row] ?? Math.round(fallback);
  }

  return findFormalRowPipeY(layout, Math.max(0, row - 1), Math.max(0, row));
}

function compact(points: readonly DiagramPoint[]): DiagramPoint[] {
  const result: DiagramPoint[] = [];

  for (const point of points) {
    const previous = result.at(-1);
    if (previous?.x === point.x && previous.y === point.y) continue;
    result.push({ x: Math.round(point.x), y: Math.round(point.y) });
  }

  if (result.length <= 2) return result;

  const simplified: DiagramPoint[] = [result[0] as DiagramPoint];

  for (let index = 1; index < result.length - 1; index += 1) {
    const previous = simplified.at(-1);
    const current = result[index];
    const next = result[index + 1];
    if (!previous || !current || !next) continue;

    const collinear =
      (previous.x === current.x && current.x === next.x) ||
      (previous.y === current.y && current.y === next.y);

    if (!collinear) simplified.push(current);
  }

  simplified.push(result.at(-1) as DiagramPoint);
  return simplified;
}
