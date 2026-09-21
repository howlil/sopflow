import type { DiagramPoint } from "../../types.js";
import {
  formalPathIntersectsRectangles,
  normalizeFormalOrthogonalPath,
  routeFormalOrthogonal,
} from "./orthogonal.js";
import type {
  FormalFlowchartRect,
  FormalFlowchartSide,
} from "./types.js";

export type FormalManualPathCollisionPolicy = "repair" | "warn";

export interface FormalManualPathGuardInput {
  readonly path: readonly DiagramPoint[];
  readonly fromShape: FormalFlowchartRect;
  readonly toShape: FormalFlowchartRect;
  readonly obstacles?: readonly FormalFlowchartRect[];
  readonly clearance?: number;
}

export interface FormalManualPathRepairInput {
  readonly startPoint: DiagramPoint;
  readonly endPoint: DiagramPoint;
  readonly sourceSide: FormalFlowchartSide;
  readonly targetSide: FormalFlowchartSide;
  readonly fromShape: FormalFlowchartRect;
  readonly toShape: FormalFlowchartRect;
  readonly obstacles?: readonly FormalFlowchartRect[];
  readonly bounds?: FormalFlowchartRect | null;
  readonly clearance?: number;
}

export interface FinalizeFormalManualPathOptions {
  readonly collisionPolicy: FormalManualPathCollisionPolicy;
  readonly check: FormalManualPathGuardInput;
  readonly repair: FormalManualPathRepairInput;
  readonly fallbackPath?: readonly DiagramPoint[];
}

export function formalPathCrossesShapeBodies(
  path: readonly DiagramPoint[],
  fromShape: FormalFlowchartRect,
  toShape: FormalFlowchartRect,
  obstacles: readonly FormalFlowchartRect[] = [],
  clearance = 0,
): boolean {
  return formalPathIntersectsRectangles(
    path,
    [fromShape, toShape, ...obstacles],
    clearance,
  );
}

export function isFormalPathBlockingShapes(
  input: FormalManualPathGuardInput,
): boolean {
  if (input.path.length < 2) return true;

  return formalPathCrossesShapeBodies(
    input.path,
    input.fromShape,
    input.toShape,
    input.obstacles ?? [],
    input.clearance ?? 0,
  );
}

export function rebuildFormalPathForAnchorSides(
  input: FormalManualPathRepairInput,
): DiagramPoint[] | null {
  const sourceDistance = distanceOnRectEdge(
    input.fromShape,
    input.sourceSide,
    input.startPoint,
  );
  const targetDistance = distanceOnRectEdge(
    input.toShape,
    input.targetSide,
    input.endPoint,
  );

  const routed = routeFormalOrthogonal({
    source: {
      shape: input.fromShape,
      side: input.sourceSide,
      distance: sourceDistance,
    },
    target: {
      shape: input.toShape,
      side: input.targetSide,
      distance: targetDistance,
    },
    obstacles: input.obstacles ?? [],
    shapeMargin: input.clearance ?? 8,
    bounds: input.bounds ?? null,
  });

  if (routed.length < 2) return null;

  const normalized = normalizeFormalOrthogonalPath([
    input.startPoint,
    ...routed.slice(1, -1),
    input.endPoint,
  ]);

  return isFormalPathBlockingShapes({
    path: normalized,
    fromShape: input.fromShape,
    toShape: input.toShape,
    obstacles: input.obstacles,
    clearance: input.clearance,
  })
    ? null
    : normalized;
}

export function repairFormalPathAroundShapes(
  input: FormalManualPathRepairInput,
): DiagramPoint[] | null {
  return rebuildFormalPathForAnchorSides(input);
}

export function finalizeFormalManualOrthogonalPath(
  path: readonly DiagramPoint[],
  options: FinalizeFormalManualPathOptions,
): DiagramPoint[] {
  const normalized = normalizeFormalOrthogonalPath(path);

  const check = (candidate: readonly DiagramPoint[]) =>
    !isFormalPathBlockingShapes({
      ...options.check,
      path: candidate,
    });

  if (check(normalized)) return normalized;
  if (options.collisionPolicy === "warn") return normalized;

  const repaired = repairFormalPathAroundShapes(options.repair);
  if (repaired && check(repaired)) return repaired;

  if (options.fallbackPath && options.fallbackPath.length >= 2) {
    const fallback = normalizeFormalOrthogonalPath(options.fallbackPath);
    if (check(fallback)) return fallback;
  }

  return normalized;
}

function distanceOnRectEdge(
  rect: FormalFlowchartRect,
  side: FormalFlowchartSide,
  point: DiagramPoint,
): number {
  if (side === "top" || side === "bottom") {
    if (rect.width <= 0) return 0.5;
    return clamp01((point.x - rect.left) / rect.width);
  }

  if (rect.height <= 0) return 0.5;
  return clamp01((point.y - rect.top) / rect.height);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
