import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SopDiagramViewport } from "./SopDiagramViewport.js";

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

describe("SopDiagramViewport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("auto-fits content width without changing the original coordinates", async () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      value: 600,
    });

    render(
      <SopDiagramViewport width={1200} height={800} minZoom={0.25} maxZoom={1}>
        {(scale) => (
          <svg
            data-testid="diagram"
            width={1200 * scale}
            viewBox="0 0 1200 800"
          />
        )}
      </SopDiagramViewport>,
    );

    try {
      await waitFor(() => {
        expect(screen.getByTestId("diagram")).toHaveAttribute("width", "600");
      });

      expect(screen.getByTestId("diagram")).toHaveAttribute(
        "viewBox",
        "0 0 1200 800",
      );
    } finally {
      if (originalClientWidth) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientWidth",
          originalClientWidth,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      }
    }
  });

  it("does not render zoom controls", () => {
    render(
      <SopDiagramViewport width={1200} height={800}>
        {() => <div />}
      </SopDiagramViewport>,
    );

    expect(
      screen.queryByRole("button", { name: /perbesar diagram/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /perkecil diagram/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reset zoom/i }),
    ).not.toBeInTheDocument();
  });

  it("updates the fit scale when the viewport is resized", async () => {
    let notifyResize: (() => void) | undefined;

    class MockResizeObserver {
      constructor(callback: () => void) {
        notifyResize = callback;
      }
      observe() {}
      disconnect() {}
    }

    vi.stubGlobal("ResizeObserver", MockResizeObserver);

    const originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      value: 600,
    });

    render(
      <SopDiagramViewport width={1200} height={800} minZoom={0.25} maxZoom={1}>
        {(scale) => (
          <output data-testid="scale">{Math.round(scale * 100)}%</output>
        )}
      </SopDiagramViewport>,
    );

    try {
      await waitFor(() => {
        expect(screen.getByTestId("scale")).toHaveTextContent("50%");
      });
      expect(notifyResize).toBeDefined();

      Object.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        value: 800,
      });
      notifyResize?.();

      await waitFor(() => {
        expect(screen.getByTestId("scale")).toHaveTextContent("67%");
      });
    } finally {
      if (originalClientWidth) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientWidth",
          originalClientWidth,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      }
    }
  });

  it("pans the viewport by dragging its background", () => {
    render(
      <SopDiagramViewport width={1200} height={800}>
        {() => <div />}
      </SopDiagramViewport>,
    );

    const viewport = screen.getByTestId("sopflow-diagram-viewport");
    Object.defineProperties(viewport, {
      scrollLeft: { configurable: true, writable: true, value: 100 },
      scrollTop: { configurable: true, writable: true, value: 60 },
    });

    dispatchPointerEvent(viewport, "pointerdown", {
      pointerId: 1,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    dispatchPointerEvent(viewport, "pointermove", {
      pointerId: 1,
      clientX: 50,
      clientY: 70,
    });

    expect(viewport.scrollLeft).toBe(150);
    expect(viewport.scrollTop).toBe(90);

    dispatchPointerEvent(viewport, "pointerup", { pointerId: 1 });
    expect(viewport).not.toHaveAttribute("data-dragging");
  });

  it("does not pan when pannable is disabled", () => {
    render(
      <SopDiagramViewport width={1200} height={800} pannable={false}>
        {() => <div />}
      </SopDiagramViewport>,
    );

    const viewport = screen.getByTestId("sopflow-diagram-viewport");
    Object.defineProperties(viewport, {
      scrollLeft: { configurable: true, writable: true, value: 100 },
      scrollTop: { configurable: true, writable: true, value: 60 },
    });

    dispatchPointerEvent(viewport, "pointerdown", {
      pointerId: 1,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    dispatchPointerEvent(viewport, "pointermove", {
      pointerId: 1,
      clientX: 50,
      clientY: 70,
    });

    expect(viewport.scrollLeft).toBe(100);
    expect(viewport.scrollTop).toBe(60);
  });
});
