import { useEffect, useRef, useState, type ReactNode } from "react";

import { calculateFitScale } from "./calculateFitScale.js";
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
  pannable = true,
  className,
  children,
}: SopDiagramViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const {
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = useDragPan({ enabled: pannable });

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const updateScale = () => {
      setScale(
        calculateFitScale({
          containerWidth: container.clientWidth,
          contentWidth: width,
          minZoom,
          maxZoom,
        }),
      );
    };

    updateScale();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateScale);
    observer.observe(container);

    return () => observer.disconnect();
  }, [width, minZoom, maxZoom]);

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <div
        ref={containerRef}
        className={styles.viewport}
        data-dragging={isDragging ? "true" : undefined}
        data-pannable={pannable ? "true" : "false"}
        data-testid="sopflow-diagram-viewport"
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
