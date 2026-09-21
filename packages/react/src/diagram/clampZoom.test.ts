import { describe, expect, it } from "vitest";

import { clampZoom } from "./clampZoom.js";

describe("clampZoom", () => {
  it("clamps values to both bounds and preserves in-range values", () => {
    expect(clampZoom(0.2, 0.5, 1.5)).toBe(0.5);
    expect(clampZoom(2, 0.5, 1.5)).toBe(1.5);
    expect(clampZoom(1, 0.5, 1.5)).toBe(1);
  });
});
