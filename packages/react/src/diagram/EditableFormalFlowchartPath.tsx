import {
  commitManualPathEdit,
  dragFormalRouteWaypointFromOrigin,
  findNearestFormalRouteSegmentIndex,
  insertFormalRouteWaypointAtSegmentMidpoint,
  manualPathPreviewEquals,
  pointsToPath,
  previewManualPathDrag,
  removeFormalRouteWaypoint,
  type DiagramPoint,
  type FormalFlowchartOccupiedSegment,
  type FormalFlowchartRect,
  type FormalFlowchartSide,
  type FormalRouteChange,
  type ManualPathDragMode,
  type ManualPathEditContext,
  type ManualPathPreview,
} from "@sopflow/diagram";
import {
  useEffect,
  useRef,
  useState,
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

interface DragSession {
  readonly pointerId: number;
  readonly mode: ManualPathDragMode;
  readonly index: number;
  readonly originPath: readonly DiagramPoint[];
  readonly originPoint: DiagramPoint;
  latestPreview: ManualPathPreview | null;
  moved: boolean;
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

  const [preview, setPreview] = useState<ManualPathPreview | null>(null);
  const displayPath = preview?.path ?? path;
  const editContext: ManualPathEditContext = {
    sourceSide,
    targetSide,
    ...(sourceRect ? { sourceRect } : {}),
    ...(targetRect ? { targetRect } : {}),
    sourceIsDiamond,
    targetIsDiamond,
    obstacles,
    occupied: occupiedSegments,
    bounds: routingBounds,
  };

  const emitPath = (
    nextPath: readonly DiagramPoint[],
    nextSourceSide = sourceSide,
    nextTargetSide = targetSide,
  ) => {
    const change = commitManualPathEdit(
      {
        path: nextPath,
        sourceSide: nextSourceSide,
        targetSide: nextTargetSide,
      },
      editContext,
    );
    if (change) onChange(change);
  };

  // Manual drag is a transaction: preview in React only, persist on pointerup.
  // Clean up a canceled drag without accidentally committing it.
  useEffect(
    () => () => {
      dragSessionRef.current = null;
    },
    [],
  );

  const startDrag = (
    event: ReactPointerEvent<SVGElement>,
    mode: ManualPathDragMode,
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
      latestPreview: null,
      moved: false,
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

    const nextPreview = previewManualPathDrag({
      mode: session.mode,
      index: session.index,
      originPath: session.originPath,
      originPoint: session.originPoint,
      point,
      context: editContext,
    });
    session.latestPreview = nextPreview;
    session.moved ||= !manualPathPreviewEquals(
      {
        path: session.originPath,
        sourceSide,
        targetSide,
      },
      nextPreview,
    );
    setPreview(nextPreview);
  };

  const finishDrag = (
    event: ReactPointerEvent<SVGElement>,
    cancelled = false,
  ) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional in test DOMs.
    }
    dragSessionRef.current = null;
    setPreview(null);
    if (cancelled || !session.moved || !session.latestPreview) return;
    const next = session.latestPreview;
    if (
      manualPathPreviewEquals(
        { path: session.originPath, sourceSide, targetSide },
        next,
      )
    ) {
      return;
    }
    emitPath(next.path, next.sourceSide, next.targetSide);
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
    if (
      selected &&
      onReset &&
      (event.key === "Delete" || event.key === "Backspace")
    ) {
      event.preventDefault();
      event.stopPropagation();
      onReset();
      return;
    }
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
        d={pointsToPath(displayPath)}
        className={styles.hitPath}
        data-selected={selected || undefined}
        data-dragging={preview ? "true" : undefined}
        role="button"
        tabIndex={0}
        aria-label={`Edit route ${connectionId}`}
        onKeyDown={handlePathKeyDown}
        onClick={handlePathClick}
        onPointerDown={handlePathPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={(event) => finishDrag(event, true)}
      />

      {preview ? (
        <path
          d={pointsToPath(displayPath)}
          data-sopflow-manual-route-preview
          className={styles.previewPath}
        />
      ) : null}

      {selected && sourceRect && displayPath[0] ? (
        // biome-ignore lint/a11y/useSemanticElements: SVG endpoint handles are directly focusable controls.
        <circle
          cx={displayPath[0].x}
          cy={displayPath[0].y}
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
          onPointerCancel={(event) => finishDrag(event, true)}
        />
      ) : null}

      {selected && targetRect && displayPath.at(-1) ? (
        // biome-ignore lint/a11y/useSemanticElements: SVG endpoint handles are directly focusable controls.
        <circle
          cx={displayPath.at(-1)?.x}
          cy={displayPath.at(-1)?.y}
          r={7}
          className={styles.endpoint}
          data-sopflow-route-endpoint="target"
          role="button"
          tabIndex={0}
          aria-label={`Target endpoint route ${connectionId}`}
          onKeyDown={handleEndpointKeyDown}
          onPointerDown={(event) =>
            startDrag(event, "target-endpoint", displayPath.length - 1)
          }
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={(event) => finishDrag(event, true)}
        />
      ) : null}

      {selected
        ? displayPath.slice(1, -1).map((point, offset) => {
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
                  onPointerCancel={(event) => finishDrag(event, true)}
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
