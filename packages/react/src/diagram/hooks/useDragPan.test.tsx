import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDragPan } from "./useDragPan.js";

function Harness({ enabled = true }: { enabled?: boolean }) {
  const pan = useDragPan({ enabled });

  return (
    <div
      data-testid="viewport"
      data-dragging={pan.isDragging ? "true" : undefined}
      onPointerDown={pan.handlePointerDown}
      onPointerMove={pan.handlePointerMove}
      onPointerUp={pan.handlePointerUp}
      onPointerCancel={pan.handlePointerCancel}
    >
      <button type="button" data-sopflow-diagram-interactive>
        Node
      </button>
    </div>
  );
}

function setScrollPosition(element: HTMLElement, left: number, top: number) {
  Object.defineProperties(element, {
    scrollLeft: { configurable: true, writable: true, value: left },
    scrollTop: { configurable: true, writable: true, value: top },
  });
}

function dispatchPointerEvent(
  element: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup",
  init: {
    button?: number;
    clientX?: number;
    clientY?: number;
    pointerId: number;
  },
) {
  const event = new Event(type, { bubbles: true });
  for (const [key, value] of Object.entries(init)) {
    Object.defineProperty(event, key, {
      configurable: true,
      value,
    });
  }
  element.dispatchEvent(event);
}

describe("useDragPan", () => {
  it("changes scroll position after the pointer crosses the drag threshold", async () => {
    render(<Harness />);
    const viewport = screen.getByTestId("viewport");
    setScrollPosition(viewport, 100, 60);

    dispatchPointerEvent(viewport, "pointerdown", {
      pointerId: 1,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    dispatchPointerEvent(viewport, "pointermove", {
      pointerId: 1,
      clientX: 99,
      clientY: 99,
    });

    expect(viewport.scrollLeft).toBe(100);
    expect(viewport.scrollTop).toBe(60);
    expect(viewport).not.toHaveAttribute("data-dragging");

    dispatchPointerEvent(viewport, "pointermove", {
      pointerId: 1,
      clientX: 50,
      clientY: 70,
    });

    expect(viewport.scrollLeft).toBe(150);
    expect(viewport.scrollTop).toBe(90);
    await waitFor(() => {
      expect(viewport).toHaveAttribute("data-dragging", "true");
    });

    dispatchPointerEvent(viewport, "pointerup", { pointerId: 1 });
    await waitFor(() => {
      expect(viewport).not.toHaveAttribute("data-dragging");
    });
  });

  it("does not start from an interactive target or when disabled", () => {
    const { rerender } = render(<Harness />);
    const viewport = screen.getByTestId("viewport");
    const node = screen.getByRole("button", { name: "Node" });
    setScrollPosition(viewport, 100, 60);

    dispatchPointerEvent(node, "pointerdown", {
      pointerId: 1,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    dispatchPointerEvent(viewport, "pointermove", {
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    });

    expect(viewport.scrollLeft).toBe(100);
    expect(viewport.scrollTop).toBe(60);

    rerender(<Harness enabled={false} />);
    dispatchPointerEvent(viewport, "pointerdown", {
      pointerId: 2,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    dispatchPointerEvent(viewport, "pointermove", {
      pointerId: 2,
      clientX: 50,
      clientY: 50,
    });

    expect(viewport.scrollLeft).toBe(100);
    expect(viewport.scrollTop).toBe(60);
  });
});
