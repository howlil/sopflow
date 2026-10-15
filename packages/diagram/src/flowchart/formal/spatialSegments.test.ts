import { describe, expect, it } from "vitest";
import { measureRouteQuality, type RouteSegment } from "../../routeGeometry.js";
import { createRouteSegmentSpatialIndex } from "./spatialSegments.js";

const segments = new Map<string, readonly RouteSegment[]>([
  ["self", [{ x1: 0, y1: 0, x2: 500, y2: 0 }]],
  ["cross", [{ x1: 100, y1: -50, x2: 100, y2: 50 }]],
  ["overlap", [{ x1: 250, y1: 0, x2: 750, y2: 0 }]],
  ["far", [{ x1: 9000, y1: 9000, x2: 9100, y2: 9000 }]],
  ["long", [{ x1: -10000, y1: 0, x2: 10000, y2: 0 }]],
]);

describe("route scoring spatial index", () => {
  it("matches exhaustive quality scoring for intersections and long segments", () => {
    const index = createRouteSegmentSpatialIndex(segments);
    const routes = [
      [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
      ],
      [
        { x: 100, y: -100 },
        { x: 100, y: 100 },
      ],
      [
        { x: 9000, y: 9000 },
        { x: 9200, y: 9000 },
      ],
      [
        { x: -20000, y: 0 },
        { x: 20000, y: 0 },
      ],
    ];
    for (const ownerId of ["self", "cross", "overlap", "far", "long"]) {
      const brute = [...segments]
        .filter(([id]) => id !== ownerId)
        .flatMap(([, entries]) => entries);
      for (const route of routes) {
        expect(
          measureRouteQuality(route, [], index.nearby(ownerId, route)),
        ).toEqual(measureRouteQuality(route, [], brute));
      }
    }
  });

  it("omits distant segments while retaining crossing candidates", () => {
    const index = createRouteSegmentSpatialIndex(segments);
    const nearby = index.nearby("self", [
      { x: 90, y: 0 },
      { x: 110, y: 0 },
    ]);
    expect(nearby).toContainEqual(segments.get("cross")?.[0]);
    expect(nearby).not.toContainEqual(segments.get("far")?.[0]);
    expect(nearby).not.toContainEqual(segments.get("self")?.[0]);
  });
});
