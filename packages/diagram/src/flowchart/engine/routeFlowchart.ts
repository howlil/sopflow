import { preferCenterAnchorDistance, scoreAnchorOffCenter, sideLengthPx } from "./anchors.js";
import { tryBuildDedicatedFlowchartPath } from "./dedicatedRoute.js";
import { placeEdgeLabel } from "./edgeLabel.js";
import { assignLoopbackCorridorIndices } from "./loopback.js";
import {
  normalizeOrthogonalPath,
  pathIntersectsRectangles,
  pathOverlapsSegments,
  pathToSegments,
  routeOrthogonal,
  scorePath,
} from "./orthogonalRouter.js";
import {
  computeConnectionRoutingBounds,
  resolveColumnForConnection,
} from "./routingBounds.js";
import { selectSidePairs } from "./selectSidePairs.js";
import { pathCrossesShapeBodies } from "./shapeBodyPath.js";
import type {
  FlowchartBounds,
  FlowchartOccupiedSegment,
  FlowchartPoint,
  FlowchartRect,
  FlowchartRouteConnection,
  FlowchartRoutingGeometry,
  FlowchartSide,
  FlowchartUsedSides,
} from "./types.js";

const SHAPE_MARGIN = 16;
const BOUNDS_MARGIN = 15;
const PATH_COLUMN_INSET = 24;
const PATH_COLUMN_INSET_RIGHT_EXTRA = 12;
const PATH_VERTICAL_INSET = 12;
const HORIZONTAL_SPAN_PENALTY_PER_PX = 0.55;
const ROUTER_INTERNAL_INSET = 4;
const MAX_TRIES = 4;
const GOOD_SCORE_LIMIT = 480;

export interface FlowchartManualRouteInput {
  readonly points: readonly FlowchartPoint[];
  readonly sourceSide?: FlowchartSide;
  readonly targetSide?: FlowchartSide;
  readonly labelPosition?: FlowchartPoint;
}

export interface FlowchartRoutedConnection extends FlowchartRouteConnection {
  readonly points: readonly FlowchartPoint[];
  readonly sourceSide: FlowchartSide;
  readonly targetSide: FlowchartSide;
  readonly labelPosition?: FlowchartPoint;
}

export interface RouteFlowchartConnectionsOptions {
  readonly manualRoutes?: Readonly<Record<string, FlowchartManualRouteInput>>;
  readonly pathLayoutSeed?: number;
}

export function routeFlowchartConnections(
  connections: readonly FlowchartRouteConnection[],
  geometry: FlowchartRoutingGeometry,
  options: RouteFlowchartConnectionsOptions = {},
): FlowchartRoutedConnection[] {
  const sorted = sortConnections(connections, options.pathLayoutSeed ?? 0);
  const loopbackSlots = assignLoopbackCorridorIndices(connections);
  const crossColumnSlots = assignCrossColumnSlots(connections);
  const columnTrunkSlots = assignColumnTrunkSlots(connections);
  const usedSides: FlowchartUsedSides = {};
  const occupied: FlowchartOccupiedSegment[] = [];
  const routed: FlowchartRoutedConnection[] = [];

  for (const [connectionIndex, connection] of sorted.entries()) {
    const source = geometry.shapes.get(connection.from);
    const target = geometry.shapes.get(connection.to);
    if (!source || !target) continue;

    const fromShape = source.rect;
    const toShape = target.rect;
    const fromPos = withEdges(fromShape);
    const toPos = withEdges(toShape);
    const obstacles = [...geometry.shapes.values()]
      .filter(
        (shape) =>
          shape.stepId !== connection.from && shape.stepId !== connection.to,
      )
      .map((shape) => shape.rect);

    const manual = options.manualRoutes?.[connection.id];
    if (manual && manual.points.length >= 2) {
      const normalized = normalizeConnectorPath(
        [...manual.points],
        geometry.pelaksanaBounds,
      );
      const sourceSide = manual.sourceSide ?? "bottom";
      const targetSide = manual.targetSide ?? "top";
      occupied.push(...pathToSegments(normalized));
      markUsedSide(usedSides, connection, sourceSide, targetSide);
      routed.push({
        ...connection,
        points: normalized,
        sourceSide,
        targetSide,
        ...(connection.label
          ? {
              labelPosition:
                manual.labelPosition ??
                placeEdgeLabel({
                  path: normalized,
                  label: connection.label,
                  obstacles,
                }) ??
                undefined,
            }
          : {}),
      });
      continue;
    }

    const dx =
      toShape.left +
      toShape.width / 2 -
      (fromShape.left + fromShape.width / 2);
    const dy =
      toShape.top +
      toShape.height / 2 -
      (fromShape.top + fromShape.height / 2);
    const destAbove = dy < -10;
    const destBelow = dy > 10;
    const sameCol =
      Math.abs(dx) < Math.max(fromShape.width, toShape.width) * 0.5;
    const sourceColumn = resolveColumnForConnection(
      connection.fromActorId,
      fromShape.left + fromShape.width / 2,
      fromShape.left,
      fromShape.left + fromShape.width,
      geometry.columns,
      geometry.pelaksanaBounds,
    );
    const targetColumn = resolveColumnForConnection(
      connection.toActorId,
      toShape.left + toShape.width / 2,
      toShape.left,
      toShape.left + toShape.width,
      geometry.columns,
      geometry.pelaksanaBounds,
    );
    const isCrossColumn =
      Boolean(sourceColumn && targetColumn) &&
      (Math.abs((sourceColumn?.left ?? 0) - (targetColumn?.left ?? 0)) >= 4 ||
        Math.abs((sourceColumn?.right ?? 0) - (targetColumn?.right ?? 0)) >= 4);
    const connectionBounds = computeConnectionRoutingBounds({
      pelaksana: geometry.pelaksanaBounds,
      sourceColumn,
      targetColumn,
      isCrossColumn,
    });
    const pathAllowedBounds = insetPelaksanaBounds(geometry.pelaksanaBounds);
    const globalBounds = {
      left: pathAllowedBounds.left + ROUTER_INTERNAL_INSET,
      top: pathAllowedBounds.top + ROUTER_INTERNAL_INSET,
      width: Math.max(
        12,
        pathAllowedBounds.right -
          pathAllowedBounds.left -
          ROUTER_INTERNAL_INSET * 2,
      ),
      height: Math.max(
        40,
        pathAllowedBounds.bottom -
          pathAllowedBounds.top -
          ROUTER_INTERNAL_INSET * 2,
      ),
    };
    const routeCandidates = selectSidePairs(
      connection,
      fromPos,
      toPos,
      usedSides,
      undefined,
      connection.to,
      connection.id,
    );
    const preferHorizontalLoopback =
      destAbove &&
      connection.sourceType === "flowchart-decision" &&
      isTidakLabel(connection.label);
    const preferYaBottomTail =
      destBelow &&
      connection.sourceType === "flowchart-decision" &&
      isYaLabel(connection.label);
    const preferred = routeCandidates[0];
    const sourceJetty =
      preferred?.sourceJettySize ?? preferred?.jettySize ?? SHAPE_MARGIN;
    const targetJetty =
      preferred?.targetJettySize ?? preferred?.jettySize ?? SHAPE_MARGIN;

    let bestPath: FlowchartPoint[] | null = null;
    let bestSides: [FlowchartSide, FlowchartSide] | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    const isSafe = (path: FlowchartPoint[]) =>
      isSafePath(path, obstacles, occupied, fromShape, toShape);
    const isShapeSafe = (path: FlowchartPoint[]) =>
      isSafePath(path, obstacles, [], fromShape, toShape);

    for (const [candidateIndex, candidate] of routeCandidates
      .slice(0, MAX_TRIES)
      .entries()) {
      const usageA = Math.max(
        usedAnchorCount(usedSides, connection.from, candidate.sSide),
        priorShapeUseCount(sorted, connectionIndex, connection.from),
      );
      const usageB = Math.max(
        usedAnchorCount(usedSides, connection.to, candidate.eSide),
        priorShapeUseCount(sorted, connectionIndex, connection.to),
      );
      const distanceA = preferCenterAnchorDistance(
        usageA,
        sideLengthPx(fromShape, candidate.sSide),
      );
      const distanceB = preferCenterAnchorDistance(
        usageB,
        sideLengthPx(toShape, candidate.eSide),
      );
      const path = routeOrthogonal({
        pointA: {
          shape: fromShape,
          side: candidate.sSide,
          distance: distanceA,
        },
        pointB: {
          shape: toShape,
          side: candidate.eSide,
          distance: distanceB,
        },
        obstacles,
        shapeMargin: SHAPE_MARGIN,
        globalBounds,
        globalBoundsMargin: destAbove ? 36 : BOUNDS_MARGIN,
        occupiedSegments: occupied,
        sourcePort: candidate.sourcePort,
        targetPort: candidate.targetPort,
        jettySize: candidate.jettySize,
        sourceJettySize: candidate.sourceJettySize,
        targetJettySize: candidate.targetJettySize,
        preferSimple: true,
        lShapeOnly: true,
      });
      if (path.length < 2) continue;

      const normalized = normalizeConnectorPath(path, pathAllowedBounds);
      if (!isSafe(normalized)) continue;

      const score =
        scorePath(normalized, occupied) +
        scoreAnchorOffCenter(distanceA) +
        scoreAnchorOffCenter(distanceB) +
        candidateIndex * 120;

      if (score < bestScore) {
        bestPath = normalized;
        bestSides = [candidate.sSide, candidate.eSide];
        bestScore = score;
      }
    }

    if (!bestPath) {
      const dedicated = tryBuildDedicatedFlowchartPath({
        connection,
        fromShape,
        toShape,
        sourceColumn,
        targetColumn,
        routingBounds: connectionBounds ?? geometry.pelaksanaBounds,
        columns: geometry.columns,
        pelaksana: geometry.pelaksanaBounds,
        gridLayout: geometry.grid,
        obstacles,
        occupied,
        destAbove,
        destBelow,
        sameCol,
        isCrossColumn,
        loopbackCorridorIndex: loopbackSlots.get(connection.id) ?? 0,
        crossColumnGutterSlot: crossColumnSlots.get(connection.id) ?? 0,
        columnTrunkSlot: columnTrunkSlots.get(connection.id) ?? 0,
        sourceJetty,
        targetJetty,
      });

      if (dedicated) {
        const normalized = normalizeConnectorPath(
          dedicated.path,
          pathAllowedBounds,
        );
        if (isSafe(normalized)) {
          bestPath = normalized;
          bestSides = [dedicated.sSide, dedicated.eSide];
        }
      }
    }

    if (!bestPath) {
      for (const candidate of routeCandidates.slice(0, MAX_TRIES)) {
        const usageA = Math.max(
          usedAnchorCount(usedSides, connection.from, candidate.sSide),
          priorShapeUseCount(sorted, connectionIndex, connection.from),
        );
        const usageB = Math.max(
          usedAnchorCount(usedSides, connection.to, candidate.eSide),
          priorShapeUseCount(sorted, connectionIndex, connection.to),
        );
        const distanceA = preferCenterAnchorDistance(
          usageA,
          sideLengthPx(fromShape, candidate.sSide),
        );
        const distanceB = preferCenterAnchorDistance(
          usageB,
          sideLengthPx(toShape, candidate.eSide),
        );
        const path = routeOrthogonal({
          pointA: {
            shape: fromShape,
            side: candidate.sSide,
            distance: distanceA,
          },
          pointB: {
            shape: toShape,
            side: candidate.eSide,
            distance: distanceB,
          },
          obstacles,
          shapeMargin: SHAPE_MARGIN,
          globalBounds,
          globalBoundsMargin: destAbove ? 36 : BOUNDS_MARGIN,
          occupiedSegments: occupied,
          sourcePort: candidate.sourcePort,
          targetPort: candidate.targetPort,
          jettySize: candidate.jettySize,
          sourceJettySize: candidate.sourceJettySize,
          targetJettySize: candidate.targetJettySize,
          preferSimple: candidate.preferSimple,
        });
        if (path.length < 2) continue;

        const normalized = normalizeConnectorPath(path, pathAllowedBounds);
        if (!isSafe(normalized)) continue;

        let score =
          scorePath(normalized, occupied) +
          scoreAnchorOffCenter(distanceA) +
          scoreAnchorOffCenter(distanceB) +
          Math.max(0, normalized.length - 2) * 40;

        const minX = Math.min(...normalized.map((point) => point.x));
        const maxX = Math.max(...normalized.map((point) => point.x));
        score += (maxX - minX) * HORIZONTAL_SPAN_PENALTY_PER_PX;

        if (preferHorizontalLoopback) {
          const horizontal =
            candidate.sSide === candidate.eSide &&
            (candidate.sSide === "left" || candidate.sSide === "right");
          if (!horizontal) score += 10_000;

          const fromCx = fromShape.left + fromShape.width / 2;
          const toCx = toShape.left + toShape.width / 2;
          if (
            toCx < fromCx - 8 &&
            (candidate.sSide !== "left" || candidate.eSide !== "left")
          ) {
            score += 4_000;
          } else if (
            toCx > fromCx + 8 &&
            (candidate.sSide !== "right" || candidate.eSide !== "right")
          ) {
            score += 4_000;
          }
        }

        if (preferYaBottomTail) {
          if (candidate.sSide !== "bottom") score += 8_000;

          const fromCx = fromShape.left + fromShape.width / 2;
          const toCx = toShape.left + toShape.width / 2;
          if (toCx < fromCx - 8 && candidate.eSide !== "right") {
            score += 3_000;
          }
          if (toCx > fromCx + 8 && candidate.eSide !== "left") {
            score += 3_000;
          }
        }

        if (sameCol && destBelow) {
          if (candidate.sSide === "bottom" && candidate.eSide === "top") {
            score -= 6_000;
          } else {
            score += 8_000;
          }
        }

        if (sameCol && destAbove) {
          if (candidate.sSide === "top" && candidate.eSide === "bottom") {
            score -= 6_000;
          } else if (!preferHorizontalLoopback) {
            score += 8_000;
          }
        }

        if (score < bestScore) {
          bestPath = normalized;
          bestSides = [candidate.sSide, candidate.eSide];
          bestScore = score;

          if (score <= GOOD_SCORE_LIMIT) break;
        }
      }
    }

    if (!bestPath || !bestSides) {
      const fallback = routeCandidates[0];
      if (fallback) {
        const path = routeOrthogonal({
          pointA: { shape: fromShape, side: fallback.sSide, distance: 0.5 },
          pointB: { shape: toShape, side: fallback.eSide, distance: 0.5 },
          obstacles,
          shapeMargin: SHAPE_MARGIN,
          globalBounds,
          globalBoundsMargin: destAbove ? 36 : BOUNDS_MARGIN,
          occupiedSegments: occupied,
          sourcePort: fallback.sourcePort,
          targetPort: fallback.targetPort,
          jettySize: fallback.jettySize,
          sourceJettySize: fallback.sourceJettySize,
          targetJettySize: fallback.targetJettySize,
          preferSimple: fallback.preferSimple ?? true,
        });
        const normalized = normalizeConnectorPath(path, pathAllowedBounds);
        if (normalized.length >= 2 && isSafe(normalized)) {
          bestPath = normalized;
          bestSides = [fallback.sSide, fallback.eSide];
        }
      }
    }

    if (!bestPath || !bestSides) {
      let softScore = Number.POSITIVE_INFINITY;

      for (const candidate of routeCandidates.slice(0, MAX_TRIES)) {
        const path = routeOrthogonal({
          pointA: { shape: fromShape, side: candidate.sSide, distance: 0.5 },
          pointB: { shape: toShape, side: candidate.eSide, distance: 0.5 },
          obstacles,
          shapeMargin: SHAPE_MARGIN,
          globalBounds,
          globalBoundsMargin: destAbove ? 36 : BOUNDS_MARGIN,
          occupiedSegments: [],
          sourcePort: candidate.sourcePort,
          targetPort: candidate.targetPort,
          jettySize: candidate.jettySize,
          sourceJettySize: candidate.sourceJettySize,
          targetJettySize: candidate.targetJettySize,
          preferSimple: candidate.preferSimple ?? true,
        });
        const normalized = normalizeConnectorPath(path, pathAllowedBounds);
        if (normalized.length < 2 || !isShapeSafe(normalized)) continue;

        const score = scorePath(normalized, occupied);
        if (score < softScore) {
          softScore = score;
          bestPath = normalized;
          bestSides = [candidate.sSide, candidate.eSide];
        }
      }
    }

    if (!bestPath || !bestSides) {
      bestPath = buildUltimateOrthogonalFallback(
        fromShape,
        toShape,
        pathAllowedBounds,
      );
      bestSides = ["bottom", "top"];
    }

    occupied.push(...pathToSegments(bestPath));
    markUsedSide(usedSides, connection, bestSides[0], bestSides[1]);

    routed.push({
      ...connection,
      points: bestPath,
      sourceSide: bestSides[0],
      targetSide: bestSides[1],
      ...(connection.label
        ? {
            labelPosition:
              placeEdgeLabel({
                path: bestPath,
                label: connection.label,
                obstacles,
              }) ?? undefined,
          }
        : {}),
    });
  }

  return routed;
}

function insetPelaksanaBounds(bounds: FlowchartBounds): FlowchartBounds {
  return {
    left: Math.round(bounds.left + PATH_COLUMN_INSET),
    top: Math.round(bounds.top + PATH_VERTICAL_INSET),
    right: Math.max(
      bounds.left + PATH_COLUMN_INSET + 20,
      Math.round(
        bounds.right - PATH_COLUMN_INSET - PATH_COLUMN_INSET_RIGHT_EXTRA,
      ),
    ),
    bottom: Math.max(
      bounds.top + PATH_VERTICAL_INSET + 40,
      Math.round(bounds.bottom - PATH_VERTICAL_INSET),
    ),
  };
}

function normalizeConnectorPath(
  points: FlowchartPoint[],
  bounds: FlowchartBounds,
): FlowchartPoint[] {
  const clamped = points.map((point) => ({
    x: Math.round(Math.max(bounds.left, Math.min(bounds.right, point.x))),
    y: Math.round(Math.max(bounds.top, Math.min(bounds.bottom, point.y))),
  }));

  return normalizeOrthogonalPath(clamped, {
    bounds: {
      left: bounds.left,
      top: bounds.top,
      width: Math.max(0, bounds.right - bounds.left),
      height: Math.max(0, bounds.bottom - bounds.top),
    },
  });
}

function isSafePath(
  path: FlowchartPoint[],
  obstacles: FlowchartRect[],
  occupied: FlowchartOccupiedSegment[],
  fromShape: FlowchartRect,
  toShape: FlowchartRect,
): boolean {
  if (path.length < 2) return false;
  if (pathIntersectsRectangles(path, obstacles, 2)) return false;
  if (pathOverlapsSegments(path, occupied)) return false;
  return !pathCrossesShapeBodies(path, fromShape, toShape, obstacles, 2);
}

function buildUltimateOrthogonalFallback(
  fromShape: FlowchartRect,
  toShape: FlowchartRect,
  bounds: FlowchartBounds,
): FlowchartPoint[] {
  const x1 = clamp(
    Math.round(fromShape.left + fromShape.width / 2),
    bounds.left,
    bounds.right,
  );
  const x2 = clamp(
    Math.round(toShape.left + toShape.width / 2),
    bounds.left,
    bounds.right,
  );
  const y1 = clamp(
    Math.round(fromShape.top + fromShape.height),
    bounds.top,
    bounds.bottom,
  );
  const y2 = clamp(Math.round(toShape.top), bounds.top, bounds.bottom);
  const xMid = clamp(Math.round((x1 + x2) / 2), bounds.left, bounds.right);

  return normalizeConnectorPath(
    [
      { x: x1, y: y1 },
      { x: xMid, y: y1 },
      { x: xMid, y: y2 },
      { x: x2, y: y2 },
    ],
    bounds,
  );
}

function withEdges(rect: FlowchartRect): FlowchartRect & {
  right: number;
  bottom: number;
} {
  return {
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
  };
}

function usedAnchorCount(
  usedSides: FlowchartUsedSides,
  shapeId: string,
  side: FlowchartSide,
): number {
  const usage = usedSides[shapeId];
  return (
    (usage?.in?.[side]?.length ?? 0) + (usage?.out?.[side]?.length ?? 0)
  );
}

function priorShapeUseCount(
  connections: readonly FlowchartRouteConnection[],
  currentIndex: number,
  shapeId: string,
): number {
  return connections
    .slice(0, currentIndex)
    .filter(
      (connection) =>
        connection.from === shapeId || connection.to === shapeId,
    ).length;
}

function markUsedSide(
  usedSides: FlowchartUsedSides,
  connection: FlowchartRouteConnection,
  sourceSide: FlowchartSide,
  targetSide: FlowchartSide,
): void {
  const sourceKey = connection.from;
  const targetKey = connection.to;
  const source = (usedSides[sourceKey] ??= {});
  const target = (usedSides[targetKey] ??= {});
  const outgoing = (source.out ??= {});
  const incoming = (target.in ??= {});
  (outgoing[sourceSide] ??= []).push(connection.id);
  (incoming[targetSide] ??= []).push(connection.id);
}

function assignCrossColumnSlots(
  connections: readonly FlowchartRouteConnection[],
): Map<string, number> {
  const result = new Map<string, number>();
  const perPair = new Map<string, number>();

  for (const connection of connections
    .filter(
      (candidate) =>
        candidate.fromActorId &&
        candidate.toActorId &&
        candidate.fromActorId !== candidate.toActorId,
    )
    .toSorted((left, right) => left.id.localeCompare(right.id))) {
    const pair = [
      connection.fromActorId as string,
      connection.toActorId as string,
    ]
      .sort()
      .join("|");
    const slot = perPair.get(pair) ?? 0;
    result.set(connection.id, slot);
    perPair.set(pair, slot + 1);
  }

  return result;
}

function assignColumnTrunkSlots(
  connections: readonly FlowchartRouteConnection[],
): Map<string, number> {
  const result = new Map<string, number>();
  const perColumn = new Map<string, number>();

  for (const connection of connections
    .filter(
      (candidate) =>
        candidate.fromActorId &&
        candidate.toRow > candidate.fromRow &&
        candidate.sourceType !== "flowchart-decision",
    )
    .toSorted((left, right) => left.id.localeCompare(right.id))) {
    const column = connection.fromActorId as string;
    const slot = perColumn.get(column) ?? 0;
    result.set(connection.id, slot);
    perColumn.set(column, slot + 1);
  }

  return result;
}

function sortConnections(
  connections: readonly FlowchartRouteConnection[],
  seed: number,
): FlowchartRouteConnection[] {
  const list = [...connections];

  list.sort((left, right) => {
    const span =
      Math.abs(right.toRow - right.fromRow) -
      Math.abs(left.toRow - left.fromRow);
    if (span !== 0) return span;

    const labelOrder =
      routeLabelOrder(right.label) - routeLabelOrder(left.label);
    if (labelOrder !== 0) return labelOrder;

    if (isTidakLabel(left.label) && isTidakLabel(right.label)) {
      const leftLoopback = left.toRow < left.fromRow ? 0 : 1;
      const rightLoopback = right.toRow < right.fromRow ? 0 : 1;
      if (leftLoopback !== rightLoopback) {
        return leftLoopback - rightLoopback;
      }
    }

    const hashDiff = hashId(seed, left.id) - hashId(seed, right.id);
    return hashDiff !== 0 ? hashDiff : left.id.localeCompare(right.id);
  });

  if (list.length > 1 && seed > 0) {
    const rotation = seed % list.length;
    if (rotation !== 0) {
      return [...list.slice(rotation), ...list.slice(0, rotation)];
    }
  }

  return list;
}

function routeLabelOrder(label: string | undefined): number {
  if (isTidakLabel(label)) return 2;
  if (isYaLabel(label)) return 1;
  return 0;
}

function hashId(seed: number, id: string): number {
  return (
    id
      .split("")
      .reduce(
        (total, character, index) =>
          total +
          character.charCodeAt(0) *
            ((seed + 1) * (index + 31) + seed * 7),
        0,
      ) >>> 0
  );
}

function isYaLabel(label: string | null | undefined): boolean {
  return /^(ya|yes|y)$/i.test((label ?? "").trim());
}

function isTidakLabel(label: string | null | undefined): boolean {
  return /^(tidak|no|n)$/i.test((label ?? "").trim());
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
