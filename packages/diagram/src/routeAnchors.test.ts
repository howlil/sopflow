import { describe, expect, it } from "vitest";
import {
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
