import { describe, expect, it } from "vitest";
import {
  channelAnchorDistance,
  distanceOnRectSide,
  extrudePoint,
  nearestRectSide,
  pointOnRectSide,
} from "./routeAnchors.js";

const rect = { left: 100, top: 50, width: 80, height: 40 };

describe("route anchors", () => {
  it("places and measures points consistently along rectangle sides", () => {
    const point = pointOnRectSide(rect, "right", 0.25);

    expect(point).toEqual({ x: 180, y: 60 });
    expect(distanceOnRectSide(rect, "right", point)).toBe(0.25);
  });

  it("clamps side distance and resolves the nearest side", () => {
    expect(pointOnRectSide(rect, "top", 2)).toEqual({ x: 180, y: 50 });
    expect(nearestRectSide(rect, { x: 178, y: 72 })).toBe("right");
  });

  it("allocates centered anchor channels using physical side spacing", () => {
    expect(channelAnchorDistance(0, 100)).toBe(0.5);
    expect(channelAnchorDistance(1, 100)).toBeCloseTo(0.36);
    expect(channelAnchorDistance(2, 100)).toBeCloseTo(0.64);
    expect(channelAnchorDistance(3, 100)).toBeCloseTo(0.22);
    expect(channelAnchorDistance(4, 100)).toBeCloseTo(0.78);
  });

  it("keeps dense channels distinct after physical spacing saturates", () => {
    const distances = Array.from({ length: 12 }, (_, index) =>
      channelAnchorDistance(index, 40),
    );

    expect(distances.every((distance) => distance >= 0.08)).toBe(true);
    expect(distances.every((distance) => distance <= 0.92)).toBe(true);
    expect(new Set(distances).size).toBe(distances.length);
  });

  it("extrudes a point in the selected side direction", () => {
    expect(extrudePoint({ x: 180, y: 70 }, "right", 18)).toEqual({
      x: 198,
      y: 70,
    });
    expect(extrudePoint({ x: 140, y: 50 }, "top", 18)).toEqual({
      x: 140,
      y: 32,
    });
  });
});
