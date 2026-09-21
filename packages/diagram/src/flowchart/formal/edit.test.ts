import { describe, expect, it } from "vitest";
import {
  dragFormalRouteSegmentFromOrigin,
  dragFormalRouteWaypointFromOrigin,
  findNearestFormalRouteSegmentIndex,
  insertFormalRouteWaypointAtSegmentMidpoint,
  removeFormalRouteWaypoint,
} from "./edit.js";

const path = [
  { x: 100, y: 100 },
  { x: 140, y: 100 },
  { x: 140, y: 200 },
  { x: 220, y: 200 },
  { x: 220, y: 260 },
] as const;

describe("formal flowchart path editing", () => {
  it("moves an interior vertical segment on the x axis", () => {
    const moved = dragFormalRouteSegmentFromOrigin(path, 1, 18, 6);

    expect(moved).toEqual([
      { x: 100, y: 100 },
      { x: 160, y: 100 },
      { x: 160, y: 200 },
      { x: 220, y: 200 },
      { x: 220, y: 260 },
    ]);
  });

  it("moves an elbow while keeping the route orthogonal", () => {
    const moved = dragFormalRouteWaypointFromOrigin(path, 2, 0, 22);

    expect(moved.every((point) => Number.isFinite(point.x))).toBe(true);

    for (let index = 0; index < moved.length - 1; index += 1) {
      const from = moved[index];
      const to = moved[index + 1];
      expect(from?.x === to?.x || from?.y === to?.y).toBe(true);
    }
  });

  it("inserts and removes an interior waypoint", () => {
    const inserted = insertFormalRouteWaypointAtSegmentMidpoint(path, 1);

    expect(inserted.length).toBeGreaterThanOrEqual(path.length);

    const midpointIndex = inserted.findIndex(
      (point) => point.x === 140 && point.y === 152,
    );
    expect(midpointIndex).toBeGreaterThan(0);

    const removed = removeFormalRouteWaypoint(inserted, midpointIndex);
    expect(removed[0]).toEqual(path[0]);
    expect(removed.at(-1)).toEqual(path.at(-1));
  });

  it("finds the closest segment for direct manipulation", () => {
    expect(findNearestFormalRouteSegmentIndex(path, 142, 155)).toBe(1);
    expect(findNearestFormalRouteSegmentIndex(path, 195, 202)).toBe(2);
  });

  it("keeps endpoint-adjacent segments pinned", () => {
    expect(dragFormalRouteSegmentFromOrigin(path, 0, 20, 0)).toEqual(path);
    expect(dragFormalRouteSegmentFromOrigin(path, 3, 20, 0)).toEqual(path);
  });
});
