import {
  buildFormalVisualConnectorAnchors,
  dragFormalRouteSegmentFromOrigin,
  dragFormalRouteWaypointFromOrigin,
  findNearestFormalRouteSegmentIndex,
  insertFormalRouteWaypointAtSegmentMidpoint,
  pointsToPath,
  removeFormalRouteWaypoint,
  resolveFormalPreferredEndpointSnap,
  type DiagramPoint,
  type FormalFlowchartAnchorKind,
  type FormalFlowchartRect,
  type ProcedureManualAnchor,
} from "@sopflow/diagram";
import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import styles from "./EditableFormalFlowchartPath.module.css";

export interface EditableFormalFlowchartEndpointTargets {
  readonly start: FormalFlowchartRect;
  readonly end: FormalFlowchartRect;
  readonly startIsDiamond?: boolean;
  readonly endIsDiamond?: boolean;
}

export interface EditableFormalFlowchartPathProps {
  path: readonly DiagramPoint[];
  connectionId: string;
  selected: boolean;
  endpointTargets?: EditableFormalFlowchartEndpointTargets;
  onSelect: (connectionId: string) => void;
  onChange: (path: readonly DiagramPoint[]) => void;
  onEndpointChange?: (
    kind: FormalFlowchartAnchorKind,
    anchor: ProcedureManualAnchor,
  ) => void;
  onReset?: () => void;
}

type DragMode = "segment" | "waypoint" | "start-endpoint" | "end-endpoint";

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
  endpointTargets,
  onSelect,
  onChange,
  onEndpointChange,
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

  const resolveEndpoint = (
    kind: FormalFlowchartAnchorKind,
    point: DiagramPoint,
  ) => {
    if (!endpointTargets || !onEndpointChange) return;

    const startPoint = path[0];
    const endPoint = path.at(-1);
    if (!startPoint || !endPoint) return;

    const anchors = buildFormalVisualConnectorAnchors(
      connectionId,
      endpointTargets.start,
      endpointTargets.end,
      {
        fromIsDiamond: endpointTargets.startIsDiamond,
        toIsDiamond: endpointTargets.endIsDiamond,
      },
    );
    const shape =
      kind === "start" ? endpointTargets.start : endpointTargets.end;
    const oppositePoint = kind === "start" ? endPoint : startPoint;
    const shapeIsDiamond =
      kind === "start"
        ? endpointTargets.startIsDiamond
        : endpointTargets.endIsDiamond;
    const snapped = resolveFormalPreferredEndpointSnap({
      connectionId,
      shape,
      anchors,
      x: point.x,
      y: point.y,
      kind,
      oppositePoint,
      shapeIsDiamond,
    });

    if (!snapped) return;

    onEndpointChange(kind, {
      side: snapped.side,
      distance: snapped.distance,
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;

    const point = clientToSvgPoint(svg, event.clientX, event.clientY);
    if (!point) return;

    event.preventDefault();

    if (session.mode === "start-endpoint" || session.mode === "end-endpoint") {
      resolveEndpoint(
        session.mode === "start-endpoint" ? "start" : "end",
        point,
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

    onChange(next);
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

    onChange(insertFormalRouteWaypointAtSegmentMidpoint(path, segmentIndex));
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
    onChange(removeFormalRouteWaypoint(path, index));
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
      onChange(removeFormalRouteWaypoint(path, index));
      return;
    }

    const delta = keyboardDelta(event.key);
    if (!delta) return;

    event.preventDefault();
    event.stopPropagation();
    onSelect(connectionId);
    onChange(
      dragFormalRouteWaypointFromOrigin(path, index, delta.dx, delta.dy),
    );
  };

  const handleEndpointKeyDown = (
    kind: FormalFlowchartAnchorKind,
    event: ReactKeyboardEvent<SVGCircleElement>,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onSelect(connectionId);
      return;
    }

    const delta = keyboardDelta(event.key);
    if (!delta) return;

    const current = kind === "start" ? path[0] : path.at(-1);
    if (!current) return;

    event.preventDefault();
    event.stopPropagation();
    onSelect(connectionId);
    resolveEndpoint(kind, {
      x: current.x + delta.dx,
      y: current.y + delta.dy,
    });
  };

  const startPoint = path[0];
  const endPoint = path.at(-1);

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

      {selected &&
      endpointTargets &&
      onEndpointChange &&
      startPoint &&
      endPoint ? (
        <>
          <g>
            {/* biome-ignore lint/a11y/useSemanticElements: SVG endpoint handle is a directly focusable control. */}
            <circle
              cx={startPoint.x}
              cy={startPoint.y}
              r={7}
              className={styles.endpoint}
              data-sopflow-route-endpoint="start"
              role="button"
              tabIndex={0}
              aria-label={`Start endpoint route ${connectionId}`}
              onKeyDown={(event) => handleEndpointKeyDown("start", event)}
              onPointerDown={(event) => startDrag(event, "start-endpoint", 0)}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            />
          </g>
          <g>
            {/* biome-ignore lint/a11y/useSemanticElements: SVG endpoint handle is a directly focusable control. */}
            <circle
              cx={endPoint.x}
              cy={endPoint.y}
              r={7}
              className={styles.endpoint}
              data-sopflow-route-endpoint="end"
              role="button"
              tabIndex={0}
              aria-label={`End endpoint route ${connectionId}`}
              onKeyDown={(event) => handleEndpointKeyDown("end", event)}
              onPointerDown={(event) =>
                startDrag(event, "end-endpoint", path.length - 1)
              }
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            />
          </g>
        </>
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

function keyboardDelta(
  key: string,
): { readonly dx: number; readonly dy: number } | null {
  if (key === "ArrowLeft") return { dx: -4, dy: 0 };
  if (key === "ArrowRight") return { dx: 4, dy: 0 };
  if (key === "ArrowUp") return { dx: 0, dy: -4 };
  if (key === "ArrowDown") return { dx: 0, dy: 4 };
  return null;
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
