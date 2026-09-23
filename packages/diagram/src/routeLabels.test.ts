import { describe, expect, it } from "vitest";
import { placeRouteLabel, rectsOverlap } from "./routeLabels.js";

describe("route label placement", () => {
  it("keeps label rectangles outside shape obstacles", () => {
    const placement = placeRouteLabel({
      path: [
        { x: 100, y: 100 },
        { x: 220, y: 100 },
      ],
      label: "Rejected",
      obstacles: [{ left: 140, top: 105, width: 70, height: 30 }],
      perpendicularOffset: 18,
    });

    expect(placement).not.toBeNull();
    if (!placement) return;
    expect(
      rectsOverlap(placement.bounds, {
        left: 140,
        top: 105,
        width: 70,
        height: 30,
      }),
    ).toBe(false);
  });

  it("moves later labels away from already occupied label rectangles", () => {
    const first = placeRouteLabel({
      path: [
        { x: 100, y: 100 },
        { x: 220, y: 100 },
      ],
      label: "Approved",
    });
    if (!first) throw new Error("first label placement missing");

    const second = placeRouteLabel({
      path: [
        { x: 100, y: 100 },
        { x: 220, y: 100 },
      ],
      label: "Rejected",
      occupiedLabels: [first.bounds],
    });

    expect(second).not.toBeNull();
    if (!second) return;
    expect(rectsOverlap(first.bounds, second.bounds)).toBe(false);
  });
});
