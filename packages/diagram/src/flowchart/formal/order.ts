import type { FormalFlowchartOccupiedSegment } from "./types.js";
import { formalSegmentsCross, formalSegmentsOverlap } from "./orthogonal.js";
import type { FormalRouteMeta } from "./dedicated.js";

function labelOrder(label: string | null | undefined): number {
  const value = (label ?? "").trim().toLowerCase();
  if (value === "ya" || value === "yes" || value === "y") return 1;
  if (value === "tidak" || value === "no" || value === "n") return 2;
  return 0;
}

function hashId(seed: number, id: string): number {
  return (
    id
      .split("")
      .reduce(
        (accumulator, char, index) =>
          accumulator +
          char.charCodeAt(0) * ((seed + 1) * (index + 31) + seed * 7),
        0,
      ) >>> 0
  );
}

export function sortFormalRoutesForPlanning(
  connections: readonly FormalRouteMeta[],
  pathLayoutSeed = 0,
  options: {
    readonly priorityIds?: ReadonlySet<string>;
    readonly reconcilePass?: number;
    readonly priorityRoutesLast?: boolean;
  } = {},
): FormalRouteMeta[] {
  const priority = options.priorityIds;
  const violatorsLast =
    options.priorityRoutesLast === true && (options.reconcilePass ?? 0) > 0;
  const list = [...connections];

  list.sort((a, b) => {
    const priorityA = priority?.has(a.id)
      ? violatorsLast
        ? 1
        : 0
      : violatorsLast
        ? 0
        : 1;
    const priorityB = priority?.has(b.id)
      ? violatorsLast
        ? 1
        : 0
      : violatorsLast
        ? 0
        : 1;

    if (priorityA !== priorityB) return priorityA - priorityB;

    const spanA = Math.abs(a.toRow - a.fromRow);
    const spanB = Math.abs(b.toRow - b.fromRow);
    if (spanA !== spanB) return spanB - spanA;

    const labelA = labelOrder(a.label);
    const labelB = labelOrder(b.label);
    if (labelA !== labelB) return labelB - labelA;

    if (labelA === 2) {
      const loopbackA = a.toRow < a.fromRow ? 0 : 1;
      const loopbackB = b.toRow < b.fromRow ? 0 : 1;
      if (loopbackA !== loopbackB) return loopbackA - loopbackB;
    }

    const hashDifference =
      hashId(pathLayoutSeed, a.id) - hashId(pathLayoutSeed, b.id);
    if (hashDifference !== 0) return hashDifference;

    if ((options.reconcilePass ?? 0) > 0) {
      return a.id.localeCompare(b.id);
    }

    return 0;
  });

  if (
    list.length > 1 &&
    pathLayoutSeed > 0 &&
    (options.reconcilePass ?? 0) === 0
  ) {
    const rotation = pathLayoutSeed % list.length;
    if (rotation !== 0) {
      return [...list.slice(rotation), ...list.slice(0, rotation)];
    }
  }

  return list;
}

export function findFormalRouteCrossingIds(
  segmentsByConnection: ReadonlyMap<
    string,
    readonly FormalFlowchartOccupiedSegment[]
  >,
): string[] {
  const ids = [...segmentsByConnection.keys()];
  const violators = new Set<string>();

  for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
    const leftId = ids[leftIndex];
    if (!leftId) continue;
    const leftSegments = segmentsByConnection.get(leftId) ?? [];

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < ids.length;
      rightIndex += 1
    ) {
      const rightId = ids[rightIndex];
      if (!rightId) continue;
      const rightSegments = segmentsByConnection.get(rightId) ?? [];

      let violates = false;
      for (const left of leftSegments) {
        for (const right of rightSegments) {
          if (
            formalSegmentsOverlap(left, right) ||
            formalSegmentsCross(left, right)
          ) {
            violates = true;
            break;
          }
        }
        if (violates) break;
      }

      if (violates) {
        violators.add(leftId);
        violators.add(rightId);
      }
    }
  }

  return [...violators];
}
