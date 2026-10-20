import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCompactStepsLayout } from "./useCompactStepsLayout.js";

describe("useCompactStepsLayout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("projects the editor container width rather than the host viewport", () => {
    let width = 980;
    let notify: (() => void) | undefined;
    const node = document.createElement("section");
    vi.spyOn(node, "getBoundingClientRect").mockImplementation(
      () => ({ width }) as DOMRect,
    );

    class ObserverMock {
      constructor(callback: ResizeObserverCallback) {
        notify = () => callback([], this as unknown as ResizeObserver);
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ObserverMock);

    const { result } = renderHook(() =>
      useCompactStepsLayout({ current: node }),
    );
    expect(result.current).toBe(false);

    act(() => {
      width = 640;
      notify?.();
    });
    expect(result.current).toBe(true);

    act(() => {
      width = 1024;
      notify?.();
    });
    expect(result.current).toBe(false);
  });
});
