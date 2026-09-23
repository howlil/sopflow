import { describe, expect, it } from "vitest";
import { scorePath, scoreRouteDirectness } from "./routeGeometry.js";

describe("route directness scoring", () => {
  it("penalizes backtracking and overshoot relative to the endpoints", () => {
    const direct = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
    ];
    const detour = [
      { x: 100, y: 100 },
      { x: 60, y: 100 },
      { x: 60, y: 220 },
      { x: 200, y: 220 },
      { x: 200, y: 200 },
    ];

    expect(scoreRouteDirectness(direct)).toBe(0);
    expect(scoreRouteDirectness(detour)).toBeGreaterThan(0);
    expect(scorePath(direct)).toBeLessThan(scorePath(detour));
  });

  it("does not penalize monotonic orthogonal progress", () => {
    expect(
      scoreRouteDirectness([
        { x: 100, y: 100 },
        { x: 160, y: 100 },
        { x: 160, y: 150 },
        { x: 220, y: 150 },
        { x: 220, y: 240 },
      ]),
    ).toBe(0);
  });
});
