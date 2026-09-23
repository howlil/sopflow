import { describe, expect, it } from "vitest";
import {
  dragFormalRouteSegmentFromOrigin,
  dragFormalRouteWaypointFromOrigin,
  findNearestFormalRouteSegmentIndex,
  insertFormalRouteWaypointAtSegmentMidpoint,
  rebuildFormalPathForEndpoint,
  removeFormalRouteWaypoint,
  snapFormalEndpoint,
  validateFormalManualRoute,
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

  it("snaps rectangular endpoints to the nearest side and prefers center", () => {
    const snapped = snapFormalEndpoint(
      { left: 100, top: 100, width: 100, height: 60 },
      { x: 197, y: 132 },
    );

    expect(snapped.side).toBe("right");
    expect(snapped.distance).toBe(0.5);
    expect(snapped.point).toEqual({ x: 200, y: 130 });
  });

  it("locks decision endpoints to a diamond vertex", () => {
    const snapped = snapFormalEndpoint(
      { left: 100, top: 100, width: 60, height: 60 },
      { x: 131, y: 92 },
      { diamond: true },
    );

    expect(snapped.side).toBe("top");
    expect(snapped.distance).toBe(0.5);
    expect(snapped.point).toEqual({ x: 130, y: 100 });
  });

  it("rebuilds the endpoint-adjacent segment orthogonally", () => {
    const moved = rebuildFormalPathForEndpoint(path, "start", {
      point: { x: 80, y: 130 },
      side: "left",
      distance: 0.5,
    });

    expect(moved[0]).toEqual({ x: 80, y: 130 });
    expect(moved[1]?.y).toBe(130);
  });

  it("rejects manual paths that cross obstacles or leave the routing bounds", () => {
    const crossing = validateFormalManualRoute({
      path: [
        { x: 100, y: 100 },
        { x: 180, y: 100 },
        { x: 180, y: 220 },
      ],
      sourceSide: "right",
      targetSide: "top",
      obstacles: [{ left: 140, top: 80, width: 30, height: 40 }],
      bounds: { left: 80, top: 60, width: 180, height: 220 },
    });
    expect(crossing).toEqual({ valid: false, reason: "CROSSES_SHAPE" });

    const outside = validateFormalManualRoute({
      path: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 220 },
      ],
      sourceSide: "right",
      targetSide: "top",
      bounds: { left: 80, top: 60, width: 180, height: 220 },
    });
    expect(outside).toEqual({ valid: false, reason: "OUT_OF_BOUNDS" });
  });

});
