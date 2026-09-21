import {
  dragFormalRouteSegmentFromOrigin,
  dragFormalRouteWaypointFromOrigin,
  findNearestFormalRouteSegmentIndex,
  insertFormalRouteWaypointAtSegmentMidpoint,
  pointsToPath,
  removeFormalRouteWaypoint,
  type DiagramPoint,
} from "@sopflow/diagram";
import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import styles from "./EditableFormalFlowchartPath.module.css";

export interface EditableFormalFlowchartPathProps {
  path: readonly DiagramPoint[];
  connectionId: string;
  selected: boolean;
  onSelect: (connectionId: string) => void;
  onChange: (path: readonly DiagramPoint[]) => void;
  onReset?: () => void;
}

type DragMode = "segment" | "waypoint";

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
  onSelect,
  onChange,
  onReset,
}: EditableFormalFlowchartPathProps) {
  const dragSessionRef = useRef<DragSession | null>(null);

  useEffect(() => {
    if (!selected || !onReset) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;

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

  const handlePointerMove = (event: ReactPointerEvent<SVGElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;

    const point = clientToSvgPoint(svg, event.clientX, event.clientY);
    if (!point) return;

    event.preventDefault();

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

  const handlePathPointerDown = (
    event: ReactPointerEvent<SVGPathElement>,
  ) => {
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

  return (
    <g data-sopflow-editable-route={connectionId}>
      <path
        d={pointsToPath(path)}
        className={styles.hitPath}
        data-selected={selected || undefined}
        onClick={handlePathClick}
        onPointerDown={handlePathPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      />

      {selected
        ? path.slice(1, -1).map((point, offset) => {
            const index = offset + 1;

            return (
              <circle
                key={`${connectionId}-waypoint-${index}`}
                cx={point.x}
                cy={point.y}
                r={6}
                className={styles.waypoint}
                data-sopflow-route-waypoint={index}
                onPointerDown={(event) =>
                  startDrag(event, "waypoint", index)
                }
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onContextMenu={(event) =>
                  handleWaypointContextMenu(index, event)
                }
              />
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
