import { describe, expect, it } from "vitest";
import { placeFormalEdgeLabel } from "./labels.js";

describe("formal flowchart edge label placement parity", () => {
  it("places decision labels away from the first edge segment", () => {
    const point = placeFormalEdgeLabel({
      path: [
        { x: 100, y: 100 },
        { x: 180, y: 100 },
      ],
      label: "Tidak",
    });

    expect(point).not.toBeNull();
    expect(point?.x).toBeGreaterThan(100);
    expect(point?.y).not.toBe(100);
  });

  it("tries the opposite side when the preferred label position hits a shape", () => {
    const point = placeFormalEdgeLabel({
      path: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ],
      label: "Ya",
      obstacles: [
        {
          left: 120,
          top: 110,
          width: 40,
          height: 30,
        },
      ],
    });

    expect(point).not.toBeNull();
    expect(point?.y).toBeLessThan(100);
  });
});
