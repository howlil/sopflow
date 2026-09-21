import { columnBoundsToCorridor } from "./columns.js";
import { buildFlowchartColumnTrunkPath } from "./columnTrunk.js";
import { classifyFlowchartRouteComplexity, isSimpleSequentialFlow, rowSpanBetween } from "./complexity.js";
import { buildFlowchartCrossColumnPath } from "./crossColumn.js";
import { buildFlowchartLoopbackPath } from "./loopback.js";
import {
  pathIntersectsRectangles,
  pathOverlapsSegments,
  scorePath,
} from "./orthogonalRouter.js";
import { pathWithinPelaksanaBounds } from "./pathBounds.js";
import { pathCrossesShapeBodies } from "./shapeBodyPath.js";
import type {
  FlowchartBounds,
  FlowchartGridLayout,
  FlowchartOccupiedSegment,
  FlowchartPoint,
  FlowchartRect,
  FlowchartRouteConnection,
  FlowchartSide,
} from "./types.js";

export interface DedicatedFlowchartPathResult {
  readonly path: FlowchartPoint[];
  readonly sSide: FlowchartSide;
  readonly eSide: FlowchartSide;
}

function isUsable(
  path: FlowchartPoint[],
  routingBounds: FlowchartBounds | null,
  obstacles: FlowchartRect[],
  occupied: FlowchartOccupiedSegment[],
  fromShape: FlowchartRect,
  toShape: FlowchartRect,
): boolean {
  if (path.length < 2) return false;
  if (!pathWithinPelaksanaBounds(path, routingBounds, 0)) return false;
  if (pathIntersectsRectangles(path, obstacles, 2)) return false;
  if (pathOverlapsSegments(path, occupied)) return false;
  if (
    pathCrossesShapeBodies(path, fromShape, toShape, obstacles, 2)
  ) {
    return false;
  }
  return true;
}

function lowerScore(
  current: DedicatedFlowchartPathResult | null,
  candidate: DedicatedFlowchartPathResult,
  occupied: FlowchartOccupiedSegment[],
): DedicatedFlowchartPathResult {
  if (!current) return candidate;
  return scorePath(candidate.path, occupied) < scorePath(current.path, occupied)
    ? candidate
    : current;
}

function mergeBounds(
  source: FlowchartBounds,
  target: FlowchartBounds | null,
): FlowchartBounds {
  if (!target) return source;

  return {
    left: Math.min(source.left, target.left),
    top: Math.min(source.top, target.top),
    right: Math.max(source.right, target.right),
    bottom: Math.max(source.bottom, target.bottom),
  };
}

export function tryBuildDedicatedFlowchartPath(input: {
  connection: FlowchartRouteConnection;
  fromShape: FlowchartRect;
  toShape: FlowchartRect;
  sourceColumn: FlowchartBounds | null;
  targetColumn: FlowchartBounds | null;
  routingBounds: FlowchartBounds | null;
  columns: ReadonlyMap<string, FlowchartBounds> | null;
  pelaksana: FlowchartBounds | null;
  gridLayout: FlowchartGridLayout | null;
  obstacles: FlowchartRect[];
  occupied: FlowchartOccupiedSegment[];
  destAbove: boolean;
  destBelow: boolean;
  sameCol: boolean;
  isCrossColumn: boolean;
  loopbackCorridorIndex: number;
  crossColumnGutterSlot: number;
  columnTrunkSlot: number;
  sourceJetty: number;
  targetJetty: number;
}): DedicatedFlowchartPathResult | null {
  const {
    connection,
    fromShape,
    toShape,
    sourceColumn,
    targetColumn,
    routingBounds,
    columns,
    pelaksana,
    gridLayout,
    obstacles,
    occupied,
    destAbove,
    destBelow,
    sameCol,
    isCrossColumn,
    loopbackCorridorIndex,
    crossColumnGutterSlot,
    columnTrunkSlot,
    sourceJetty,
    targetJetty,
  } = input;

  const routeGeometry = {
    destAbove,
    destBelow,
    sameCol,
    isCrossColumn,
  };

  if (isSimpleSequentialFlow(connection, routeGeometry)) {
    return null;
  }

  const fromIsDiamond = connection.sourceType === "flowchart-decision";
  const toIsDiamond = connection.targetType === "flowchart-decision";

  if (destAbove && sourceColumn) {
    const corridor = columnBoundsToCorridor(
      routingBounds ?? mergeBounds(sourceColumn, targetColumn),
    );
    const targetLeft =
      toShape.left + toShape.width / 2 <
      fromShape.left + fromShape.width / 2;
    const sides: Array<"left" | "right"> = targetLeft
      ? ["left", "right"]
      : ["right", "left"];

    let best: DedicatedFlowchartPathResult | null = null;

    for (const side of sides) {
      const path = buildFlowchartLoopbackPath({
        fromShape,
        toShape,
        sSide: side,
        eSide: side,
        fromIsDiamond,
        toIsDiamond,
        sourceJetty,
        targetJetty,
        corridorBounds: corridor,
        gridLayout,
        corridorIndex: loopbackCorridorIndex,
        fromRow: connection.fromRow,
        toRow: connection.toRow,
      });

      if (
        path &&
        isUsable(
          path,
          routingBounds,
          obstacles,
          occupied,
          fromShape,
          toShape,
        )
      ) {
        best = lowerScore(
          best,
          { path, sSide: side, eSide: side },
          occupied,
        );
      }
    }

    if (best) return best;
  }

  const complexity = classifyFlowchartRouteComplexity(
    connection,
    routeGeometry,
  );
  const span = rowSpanBetween(connection);

  if (
    complexity === "complex" &&
    isCrossColumn &&
    (destBelow || destAbove) &&
    span >= 2
  ) {
    const pairs: Array<[FlowchartSide, FlowchartSide]> = [
      ["bottom", "top"],
      ["right", "top"],
      ["left", "top"],
      ["bottom", "left"],
      ["bottom", "right"],
    ];

    let best: DedicatedFlowchartPathResult | null = null;

    for (const [sSide, eSide] of pairs) {
      const path = buildFlowchartCrossColumnPath({
        fromShape,
        toShape,
        fromIsDiamond,
        toIsDiamond,
        sSide,
        eSide,
        sourceJetty,
        targetJetty,
        columns,
        pelaksanaFallback: pelaksana,
        gridLayout,
        gutterSlot: crossColumnGutterSlot,
        fromRow: connection.fromRow,
        toRow: connection.toRow,
      });

      if (
        path &&
        isUsable(
          path,
          routingBounds,
          obstacles,
          occupied,
          fromShape,
          toShape,
        )
      ) {
        best = lowerScore(best, { path, sSide, eSide }, occupied);
      }
    }

    if (best) return best;
  }

  if (
    destBelow &&
    sameCol &&
    sourceColumn &&
    connection.sourceType !== "flowchart-decision" &&
    span >= 2
  ) {
    const path = buildFlowchartColumnTrunkPath({
      fromShape,
      toShape,
      fromIsDiamond,
      toIsDiamond,
      column: sourceColumn,
      trunkSlot: columnTrunkSlot,
      sourceJetty,
      targetJetty,
    });

    if (
      path &&
      isUsable(
        path,
        routingBounds,
        obstacles,
        occupied,
        fromShape,
        toShape,
      )
    ) {
      return { path, sSide: "bottom", eSide: "top" };
    }
  }

  return null;
}
