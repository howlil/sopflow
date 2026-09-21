import { useRef, useState, type PointerEvent } from "react";

export interface UseDragPanOptions {
  enabled?: boolean;
}

interface DragPanState {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
  dragging: boolean;
}

export function useDragPan({ enabled = true }: UseDragPanOptions = {}) {
  const stateRef = useRef<DragPanState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.button !== 0) {
      return;
    }

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("[data-sopflow-diagram-interactive]")
    ) {
      return;
    }

    const element = event.currentTarget;
    stateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
      dragging: false,
    };

    if (typeof element.setPointerCapture === "function") {
      element.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = stateRef.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;

    if (!state.dragging && Math.hypot(deltaX, deltaY) < 4) {
      return;
    }

    if (!state.dragging) {
      state.dragging = true;
      setIsDragging(true);
    }

    event.currentTarget.scrollLeft = state.scrollLeft - deltaX;
    event.currentTarget.scrollTop = state.scrollTop - deltaY;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const state = stateRef.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    if (
      typeof event.currentTarget.hasPointerCapture === "function" &&
      event.currentTarget.hasPointerCapture(event.pointerId) &&
      typeof event.currentTarget.releasePointerCapture === "function"
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsDragging(false);
    stateRef.current = null;
  }

  return {
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: endDrag,
    handlePointerCancel: endDrag,
  };
}
