import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
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

  it("fits content width without changing the original content coordinates", async () => {
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

  it("zooms with toolbar controls and resets to the latest fit scale", async () => {
    const user = userEvent.setup();
    const originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      value: 600,
    });

    render(
      <SopDiagramViewport width={1200} height={800} minZoom={0.4} maxZoom={1.5}>
        {(scale) => (
          <output data-testid="zoom">{Math.round(scale * 100)}%</output>
        )}
      </SopDiagramViewport>,
    );

    try {
      const reset = await screen.findByRole("button", { name: "Reset zoom" });
      expect(reset).toHaveTextContent("50%");

      await user.click(
        screen.getByRole("button", { name: "Perbesar diagram" }),
      );
      expect(reset).toHaveTextContent("60%");

      await user.click(reset);
      expect(reset).toHaveTextContent("50%");
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

  it("disables controls at the configured bounds", async () => {
    const user = userEvent.setup();
    const originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      value: 100,
    });

    render(
      <SopDiagramViewport
        width={2000}
        height={800}
        minZoom={0.5}
        maxZoom={0.7}
        zoomStep={0.1}
      >
        {(scale) => (
          <output data-testid="zoom">{Math.round(scale * 100)}%</output>
        )}
      </SopDiagramViewport>,
    );

    try {
      const zoomOut = await screen.findByRole("button", {
        name: "Perkecil diagram",
      });
      const zoomIn = screen.getByRole("button", { name: "Perbesar diagram" });
      expect(zoomOut).toBeDisabled();
      expect(zoomIn).not.toBeDisabled();

      await user.click(zoomIn);
      await user.click(zoomIn);
      expect(zoomIn).toBeDisabled();
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

  it("zooms only for modified wheel events", async () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      value: 600,
    });

    const { container } = render(
      <SopDiagramViewport width={1200} height={800} minZoom={0.4} maxZoom={1.5}>
        {(scale) => (
          <output data-testid="zoom">{Math.round(scale * 100)}%</output>
        )}
      </SopDiagramViewport>,
    );

    try {
      const viewport = container.querySelector('[class*="viewport"]');
      if (!viewport) throw new Error("Expected viewport");

      const plainWheel = fireEvent.wheel(viewport, { deltaY: -100 });
      expect(plainWheel).toBe(true);
      expect(screen.getByTestId("zoom")).toHaveTextContent("50%");

      fireEvent.wheel(viewport, { deltaY: -100, ctrlKey: true });
      expect(screen.getByTestId("zoom")).toHaveTextContent("60%");

      fireEvent.wheel(viewport, { deltaY: 100, metaKey: true });
      expect(screen.getByTestId("zoom")).toHaveTextContent("50%");
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

  it("keeps manual scale when ResizeObserver reports a new fit scale", async () => {
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
      <SopDiagramViewport width={1200} height={800} minZoom={0.4} maxZoom={1.5}>
        {(scale) => (
          <output data-testid="zoom">{Math.round(scale * 100)}%</output>
        )}
      </SopDiagramViewport>,
    );

    try {
      const zoom = await screen.findByTestId("zoom");
      expect(zoom).toHaveTextContent("50%");
      await waitFor(() => expect(notifyResize).toBeDefined());

      Object.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        value: 800,
      });
      notifyResize?.();
      await waitFor(() => expect(zoom).toHaveTextContent("67%"));

      fireEvent.click(screen.getByRole("button", { name: "Perbesar diagram" }));
      expect(zoom).toHaveTextContent("77%");

      Object.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        value: 400,
      });
      notifyResize?.();
      await waitFor(() => expect(zoom).toHaveTextContent("77%"));

      fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
      expect(zoom).toHaveTextContent("40%");
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
});
