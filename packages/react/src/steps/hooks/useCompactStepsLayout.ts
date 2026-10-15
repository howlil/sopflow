import { useSyncExternalStore } from "react";

/** Subscribe once to the responsive layout rather than mounting both editors. */
const QUERY = "(max-width: 768px)";

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function getSnapshot(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useCompactStepsLayout(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
