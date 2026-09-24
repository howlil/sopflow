import {
  distanceOnFormalShapeSide,
  dragFormalRouteSegmentFromOrigin,
  dragFormalRouteWaypointFromOrigin,
  findNearestFormalRouteSegmentIndex,
  formalRouteChangeFromPath,
  insertFormalRouteWaypointAtSegmentMidpoint,
  pointsToPath,
  rebuildFormalPathForEndpoint,
  repairFormalManualRoute,
  removeFormalRouteWaypoint,
  snapFormalEndpoint,
  validateFormalManualRoute,
  type DiagramPoint,
  type FormalFlowchartOccupiedSegment,
  type FormalFlowchartRect,
  type FormalFlowchartSide,
  type FormalRouteChange,
} from "@sopflow/diagram";
import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import styles from "./EditableFormalFlowchartPath.module.css";

export interface EditableFormalFlowchartPathProps {
  path: readonly DiagramPoint[];
  connectionId: string;
  selected: boolean;
  sourceSide?: FormalFlowchartSide;
  targetSide?: FormalFlowchartSide;
  sourceRect?: FormalFlowchartRect;
  targetRect?: FormalFlowchartRect;
  sourceIsDiamond?: boolean;
  targetIsDiamond?: boolean;
  obstacles?: readonly FormalFlowchartRect[];
  occupiedSegments?: readonly FormalFlowchartOccupiedSegment[];
  routingBounds?: FormalFlowchartRect | null;
  onSelect: (connectionId: string) => void;
  onChange: (route: FormalRouteChange) => void;
  onReset?: () => void;
}

type DragMode = "segment" | "waypoint" | "source-endpoint" | "target-endpoint";

interface DragSession {
  readonly pointerId: number;
  readonly mode: DragMode;
  readonly index: number;
  readonly originPath: readonly DiagramPoint[];
  readonly originPoint: DiagramPoint;
}

export function EditableFormalFlowchartPath({
  path,
  connectionId,
  selected,
  sourceSide = "bottom",
  targetSide = "top",
  sourceRect,
  targetRect,
  sourceIsDiamond = false,
  targetIsDiamond = false,
  obstacles = [],
  occupiedSegments = [],
  routingBounds = null,
  onSelect,
  onChange,
  onReset,
}: EditableFormalFlowchartPathProps) {
  const dragSessionRef = useRef<DragSession | null>(null);

  useEffect(() => {
    if (!selected || !onReset) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (isEditableKeyboardTarget(event.target)) return;

      event.preventDefault();
      onReset();
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [onReset, selected]);

  const emitPath = (
    nextPath: readonly DiagramPoint[],
    nextSourceSide = sourceSide,
    nextTargetSide = targetSide,
  ) => {
    const validation = validateFormalManualRoute({
      path: nextPath,
      sourceSide: nextSourceSide,
      targetSide: nextTargetSide,
      obstacles,
      occupied: occupiedSegments,
      bounds: routingBounds,
    });
    const effectivePath = validation.valid
      ? nextPath
      : repairFormalManualRoute({
          path: nextPath,
          sourceSide: nextSourceSide,
          targetSide: nextTargetSide,
          obstacles,
          bounds: routingBounds,
        });
    if (!effectivePath) return;

    const effectiveStart = effectivePath[0];
    const effectiveEnd = effectivePath.at(-1);
    const sourceDistance =
      sourceRect && effectiveStart
        ? sourceIsDiamond
          ? 0.5
          : Math.max(
              0.08,
              Math.min(
                0.92,
                distanceOnFormalShapeSide(
                  sourceRect,
                  nextSourceSide,
                  effectiveStart,
                ),
              ),
            )
        : undefined;
    const targetDistance =
      targetRect && effectiveEnd
        ? targetIsDiamond
          ? 0.5
          : Math.max(
              0.08,
              Math.min(
                0.92,
                distanceOnFormalShapeSide(
                  targetRect,
                  nextTargetSide,
                  effectiveEnd,
                ),
              ),
            )
        : undefined;
    const change = formalRouteChangeFromPath(
      effectivePath,
      nextSourceSide,
      nextTargetSide,
      {
        ...(sourceDistance !== undefined ? { sourceDistance } : {}),
        ...(targetDistance !== undefined ? { targetDistance } : {}),
      },
    );
    if (change) onChange(change);
  };

  const startDrag = (
    event: ReactPointerEvent<SVGElement>,
    mode: DragMode,
    index: number,
  ) => {
    if (event.button !== 0) return;

    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;

    const point = clientToSvgPoint(svg, event.clientX, event.clientY);
    if (!point) return;

    event.preventDefault();
    event.stopPropagation();
    onSelect(connectionId);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort in browsers and absent in some test DOMs.
    }

    dragSessionRef.current = {
      pointerId: event.pointerId,
      mode,
      index,
      originPath: path.map((candidate) => ({ ...candidate })),
      originPoint: point,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;

    const point = clientToSvgPoint(svg, event.clientX, event.clientY);
    if (!point) return;

    event.preventDefault();

    if (session.mode === "source-endpoint" && sourceRect) {
      const endpoint = snapFormalEndpoint(sourceRect, point, {
        diamond: sourceIsDiamond,
        preferredSide: sourceSide,
      });
      emitPath(
        rebuildFormalPathForEndpoint(session.originPath, "start", endpoint),
        endpoint.side,
        targetSide,
      );
      return;
    }

    if (session.mode === "target-endpoint" && targetRect) {
      const endpoint = snapFormalEndpoint(targetRect, point, {
        diamond: targetIsDiamond,
        preferredSide: targetSide,
      });
      emitPath(
        rebuildFormalPathForEndpoint(session.originPath, "end", endpoint),
        sourceSide,
        endpoint.side,
      );
      return;
    }

    const dx = point.x - session.originPoint.x;
    const dy = point.y - session.originPoint.y;
    const next =
      session.mode === "segment"
        ? dragFormalRouteSegmentFromOrigin(
            session.originPath,
            session.index,
            dx,
            dy,
          )
        : dragFormalRouteWaypointFromOrigin(
            session.originPath,
            session.index,
            dx,
            dy,
          );

    emitPath(next);
  };

  const finishDrag = (event: ReactPointerEvent<SVGElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort.
    }

    dragSessionRef.current = null;
  };

  const handlePathClick = (event: ReactMouseEvent<SVGPathElement>) => {
    event.stopPropagation();
    onSelect(connectionId);

    if (event.detail < 2) return;

    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;

    const point = clientToSvgPoint(svg, event.clientX, event.clientY);
    if (!point) return;

    const segmentIndex = findNearestFormalRouteSegmentIndex(
      path,
      point.x,
      point.y,
    );
    if (segmentIndex < 0) return;

    emitPath(insertFormalRouteWaypointAtSegmentMidpoint(path, segmentIndex));
  };

  const handlePathPointerDown = (event: ReactPointerEvent<SVGPathElement>) => {
    if (!selected) {
      event.stopPropagation();
      onSelect(connectionId);
      return;
    }

    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;

    const point = clientToSvgPoint(svg, event.clientX, event.clientY);
    if (!point) return;

    const segmentIndex = findNearestFormalRouteSegmentIndex(
      path,
      point.x,
      point.y,
    );
    if (segmentIndex <= 0 || segmentIndex >= path.length - 2) return;

    startDrag(event, "segment", segmentIndex);
  };

  const handleWaypointContextMenu = (
    index: number,
    event: ReactMouseEvent<SVGCircleElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    emitPath(removeFormalRouteWaypoint(path, index));
  };

  const handlePathKeyDown = (event: ReactKeyboardEvent<SVGPathElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    event.stopPropagation();
    onSelect(connectionId);
  };

  const handleWaypointKeyDown = (
    index: number,
    event: ReactKeyboardEvent<SVGCircleElement>,
  ) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      emitPath(removeFormalRouteWaypoint(path, index));
      return;
    }

    const delta =
      event.key === "ArrowLeft"
        ? { dx: -4, dy: 0 }
        : event.key === "ArrowRight"
          ? { dx: 4, dy: 0 }
          : event.key === "ArrowUp"
            ? { dx: 0, dy: -4 }
            : event.key === "ArrowDown"
              ? { dx: 0, dy: 4 }
              : null;

    if (!delta) return;

    event.preventDefault();
    event.stopPropagation();
    onSelect(connectionId);
    emitPath(
      dragFormalRouteWaypointFromOrigin(path, index, delta.dx, delta.dy),
    );
  };

  const handleEndpointKeyDown = (
    event: ReactKeyboardEvent<SVGCircleElement>,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(connectionId);
  };

  return (
    <g data-sopflow-editable-route={connectionId}>
      {/* biome-ignore lint/a11y/useSemanticElements: SVG geometry is the interactive route hit target. */}
      <path
        d={pointsToPath(path)}
        className={styles.hitPath}
        data-selected={selected || undefined}
        role="button"
        tabIndex={0}
        aria-label={`Edit route ${connectionId}`}
        onKeyDown={handlePathKeyDown}
        onClick={handlePathClick}
        onPointerDown={handlePathPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      />

      {selected && sourceRect && path[0] ? (
        // biome-ignore lint/a11y/useSemanticElements: SVG endpoint handles are directly focusable controls.
        <circle
          cx={path[0].x}
          cy={path[0].y}
          r={7}
          className={styles.endpoint}
          data-sopflow-route-endpoint="source"
          role="button"
          tabIndex={0}
          aria-label={`Source endpoint route ${connectionId}`}
          onKeyDown={handleEndpointKeyDown}
          onPointerDown={(event) => startDrag(event, "source-endpoint", 0)}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        />
      ) : null}

      {selected && targetRect && path.at(-1) ? (
        // biome-ignore lint/a11y/useSemanticElements: SVG endpoint handles are directly focusable controls.
        <circle
          cx={path.at(-1)?.x}
          cy={path.at(-1)?.y}
          r={7}
          className={styles.endpoint}
          data-sopflow-route-endpoint="target"
          role="button"
          tabIndex={0}
          aria-label={`Target endpoint route ${connectionId}`}
          onKeyDown={handleEndpointKeyDown}
          onPointerDown={(event) =>
            startDrag(event, "target-endpoint", path.length - 1)
          }
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        />
      ) : null}

      {selected
        ? path.slice(1, -1).map((point, offset) => {
            const index = offset + 1;

            return (
              <g key={`${connectionId}-waypoint-${index}`}>
                {/* biome-ignore lint/a11y/useSemanticElements: SVG waypoint handles are directly focusable controls. */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={6}
                  className={styles.waypoint}
                  data-sopflow-route-waypoint={index}
                  role="button"
                  tabIndex={0}
                  aria-label={`Waypoint ${index} route ${connectionId}`}
                  onKeyDown={(event) => handleWaypointKeyDown(index, event)}
                  onPointerDown={(event) => startDrag(event, "waypoint", index)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={finishDrag}
                  onPointerCancel={finishDrag}
                  onContextMenu={(event) =>
                    handleWaypointContextMenu(index, event)
                  }
                />
              </g>
            );
          })
        : null}
    </g>
  );
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function clientToSvgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): DiagramPoint | null {
  const matrix = svg.getScreenCTM?.();

  if (matrix && typeof svg.createSVGPoint === "function") {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;

    const mapped = point.matrixTransform(matrix.inverse());
    return { x: mapped.x, y: mapped.y };
  }

  const rect = svg.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const viewBox = svg.viewBox.baseVal;
  const width = viewBox.width || rect.width;
  const height = viewBox.height || rect.height;

  return {
    x: ((clientX - rect.left) / rect.width) * width + viewBox.x,
    y: ((clientY - rect.top) / rect.height) * height + viewBox.y,
  };
}
