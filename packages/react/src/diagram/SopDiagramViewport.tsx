import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent,
} from "react";

import { calculateFitScale } from "./calculateFitScale.js";
import { clampZoom } from "./clampZoom.js";
import { useDragPan } from "./hooks/useDragPan.js";
import styles from "./SopDiagramViewport.module.css";

export interface SopDiagramViewportProps {
  width: number;
  height: number;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  pannable?: boolean;
  className?: string;
  children: (scale: number) => ReactNode;
}

export function SopDiagramViewport({
  width,
  height,
  minZoom = 0.4,
  maxZoom = 1.75,
  zoomStep = 0.1,
  pannable = true,
  className,
  children,
}: SopDiagramViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [manualZoom, setManualZoom] = useState(false);
  const {
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = useDragPan({ enabled: pannable });

  const clampScale = useCallback(
    (value: number) => clampZoom(value, minZoom, maxZoom),
    [minZoom, maxZoom],
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const updateFitScale = () => {
      const nextFitScale = calculateFitScale({
        containerWidth: container.clientWidth,
        contentWidth: width,
        minZoom,
        maxZoom,
      });

      setFitScale(nextFitScale);
      if (!manualZoom) {
        setScale(nextFitScale);
      }
    };

    updateFitScale();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateFitScale);
    observer.observe(container);

    return () => observer.disconnect();
  }, [width, minZoom, maxZoom, manualZoom]);

  const zoomIn = () => {
    setManualZoom(true);
    setScale((current) => clampScale(current + zoomStep));
  };

  const zoomOut = () => {
    setManualZoom(true);
    setScale((current) => clampScale(current - zoomStep));
  };

  const resetZoom = () => {
    setManualZoom(false);
    setScale(fitScale);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    event.preventDefault();
    setManualZoom(true);

    const direction = event.deltaY < 0 ? 1 : -1;
    setScale((current) => clampScale(current + direction * zoomStep));
  };

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label="Kontrol zoom diagram"
      >
        <button
          type="button"
          className={styles.button}
          disabled={scale <= minZoom}
          aria-label="Perkecil diagram"
          onClick={zoomOut}
        >
          −
        </button>
        <button
          type="button"
          className={styles.zoomValue}
          aria-label="Reset zoom"
          onClick={resetZoom}
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={scale >= maxZoom}
          aria-label="Perbesar diagram"
          onClick={zoomIn}
        >
          +
        </button>
      </div>
      <div
        ref={containerRef}
        className={styles.viewport}
        data-dragging={isDragging ? "true" : undefined}
        data-pannable={pannable ? "true" : "false"}
        data-testid="sopflow-diagram-viewport"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          className={styles.content}
          style={{ width: width * scale, height: height * scale }}
        >
          {children(scale)}
        </div>
      </div>
    </div>
  );
}
