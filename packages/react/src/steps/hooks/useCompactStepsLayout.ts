import { useCallback, useSyncExternalStore, type RefObject } from "react";

/**
 * Embedded SOP editors switch layout by their available width, not the
 * viewport width. A wide host with a narrow editor pane must not render an
 * unusable horizontally clipped table.
 */
const COMPACT_WIDTH = 768;
const MEDIA_QUERY = "(max-width: 768px)";

export function useCompactStepsLayout(
  containerRef: RefObject<HTMLElement | null>,
): boolean {
  const subscribe = useCallback(
    (listener: () => void): (() => void) => {
      if (typeof window === "undefined") return () => {};

      const container = containerRef.current;
      if (container && typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(listener);
        observer.observe(container);
        return () => observer.disconnect();
      }

      window.addEventListener("resize", listener);
      const media = window.matchMedia?.(MEDIA_QUERY);
      media?.addEventListener?.("change", listener);
      return () => {
        window.removeEventListener("resize", listener);
        media?.removeEventListener?.("change", listener);
      };
    },
    [containerRef],
  );

  const getSnapshot = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    const width = containerRef.current?.getBoundingClientRect().width ?? 0;
    return width > 0
      ? width <= COMPACT_WIDTH
      : (window.matchMedia?.(MEDIA_QUERY).matches ?? false);
  }, [containerRef]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
