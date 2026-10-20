import {
  distanceOnFormalShapeSide,
  dragFormalRouteSegmentFromOrigin,
  dragFormalRouteWaypointFromOrigin,
  formalRouteChangeFromPath,
  rebuildFormalPathForEndpoint,
  repairFormalManualRoute,
  snapFormalEndpoint,
  validateFormalManualRoute,
} from "./edit.js";
import type {
  FormalFlowchartOccupiedSegment,
  FormalFlowchartRect,
  FormalFlowchartSide,
} from "./types.js";
import type { DiagramPoint } from "../../types.js";
import type { FormalRouteChange } from "./edit.js";

export type ManualPathDragMode =
  | "segment"
  | "waypoint"
  | "source-endpoint"
  | "target-endpoint";

export interface ManualPathEditContext {
  readonly sourceSide: FormalFlowchartSide;
  readonly targetSide: FormalFlowchartSide;
  readonly sourceRect?: FormalFlowchartRect;
  readonly targetRect?: FormalFlowchartRect;
  readonly sourceIsDiamond?: boolean;
  readonly targetIsDiamond?: boolean;
  readonly obstacles?: readonly FormalFlowchartRect[];
  readonly occupied?: readonly FormalFlowchartOccupiedSegment[];
  readonly bounds?: FormalFlowchartRect | null;
}

export interface ManualPathDragInput {
  readonly mode: ManualPathDragMode;
  readonly index: number;
  readonly originPath: readonly DiagramPoint[];
  readonly originPoint: DiagramPoint;
  readonly point: DiagramPoint;
  readonly context: ManualPathEditContext;
}

export interface ManualPathPreview {
  readonly path: readonly DiagramPoint[];
  readonly sourceSide: FormalFlowchartSide;
  readonly targetSide: FormalFlowchartSide;
}

/**
 * Reusable diagram-package path-edit manager. Preview is pure and side-effect
 * free; the caller owns the pointer lifetime, local preview and final commit.
 */
export function previewManualPathDrag(
  input: ManualPathDragInput,
): ManualPathPreview {
  const { mode, originPath, originPoint, point, context, index } = input;
  if (mode === "source-endpoint" && context.sourceRect) {
    const endpoint = snapFormalEndpoint(context.sourceRect, point, {
      diamond: context.sourceIsDiamond ?? false,
      preferredSide: context.sourceSide,
    });
    return {
      path: rebuildFormalPathForEndpoint(originPath, "start", endpoint),
      sourceSide: endpoint.side,
      targetSide: context.targetSide,
    };
  }
  if (mode === "target-endpoint" && context.targetRect) {
    const endpoint = snapFormalEndpoint(context.targetRect, point, {
      diamond: context.targetIsDiamond ?? false,
      preferredSide: context.targetSide,
    });
    return {
      path: rebuildFormalPathForEndpoint(originPath, "end", endpoint),
      sourceSide: context.sourceSide,
      targetSide: endpoint.side,
    };
  }

  const dx = point.x - originPoint.x;
  const dy = point.y - originPoint.y;
  return {
    path:
      mode === "segment"
        ? dragFormalRouteSegmentFromOrigin(originPath, index, dx, dy)
        : dragFormalRouteWaypointFromOrigin(originPath, index, dx, dy),
    sourceSide: context.sourceSide,
    targetSide: context.targetSide,
  };
}

/** Finish one edit transaction. Never persist a raw invalid preview. */
export function commitManualPathEdit(
  preview: ManualPathPreview,
  context: ManualPathEditContext,
): FormalRouteChange | null {
  const { path, sourceSide, targetSide } = preview;
  const validation = validateFormalManualRoute({
    path,
    sourceSide,
    targetSide,
    ...(context.obstacles ? { obstacles: context.obstacles } : {}),
    ...(context.occupied ? { occupied: context.occupied } : {}),
    ...(context.bounds !== undefined ? { bounds: context.bounds } : {}),
  });
  const effectivePath = validation.valid
    ? path
    : repairFormalManualRoute({
        path,
        sourceSide,
        targetSide,
        ...(context.obstacles ? { obstacles: context.obstacles } : {}),
        ...(context.bounds !== undefined ? { bounds: context.bounds } : {}),
      });
  if (!effectivePath) return null;

  const start = effectivePath[0];
  const end = effectivePath.at(-1);
  const sourceDistance =
    context.sourceRect && start
      ? context.sourceIsDiamond
        ? 0.5
        : Math.max(
            0.08,
            Math.min(
              0.92,
              distanceOnFormalShapeSide(context.sourceRect, sourceSide, start),
            ),
          )
      : undefined;
  const targetDistance =
    context.targetRect && end
      ? context.targetIsDiamond
        ? 0.5
        : Math.max(
            0.08,
            Math.min(
              0.92,
              distanceOnFormalShapeSide(context.targetRect, targetSide, end),
            ),
          )
      : undefined;

  return formalRouteChangeFromPath(effectivePath, sourceSide, targetSide, {
    ...(sourceDistance !== undefined ? { sourceDistance } : {}),
    ...(targetDistance !== undefined ? { targetDistance } : {}),
  });
}

export function manualPathPreviewEquals(
  previous: ManualPathPreview,
  next: ManualPathPreview,
): boolean {
  return (
    previous.sourceSide === next.sourceSide &&
    previous.targetSide === next.targetSide &&
    previous.path.length === next.path.length &&
    previous.path.every(
      (point, index) =>
        point.x === next.path[index]?.x && point.y === next.path[index]?.y,
    )
  );
}
