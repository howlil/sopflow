import { describe, expect, it } from "vitest";

import { calculateFitScale } from "./calculateFitScale.js";

describe("calculateFitScale", () => {
  it("scales large diagrams down to fit", () => {
    expect(
      calculateFitScale({
        containerWidth: 600,
        contentWidth: 1200,
        minZoom: 0.25,
        maxZoom: 1,
      }),
    ).toBe(0.5);
  });

  it("does not scale below minZoom", () => {
    expect(
      calculateFitScale({
        containerWidth: 300,
        contentWidth: 2000,
        minZoom: 0.5,
        maxZoom: 1,
      }),
    ).toBe(0.5);
  });

  it("does not enlarge above maxZoom", () => {
    expect(
      calculateFitScale({
        containerWidth: 1200,
        contentWidth: 600,
        minZoom: 0.5,
        maxZoom: 1,
      }),
    ).toBe(1);
  });

  it("returns the neutral scale for invalid dimensions", () => {
    expect(
      calculateFitScale({
        containerWidth: 0,
        contentWidth: 600,
        minZoom: 0.5,
        maxZoom: 1,
      }),
    ).toBe(1);
    expect(
      calculateFitScale({
        containerWidth: 600,
        contentWidth: -1,
        minZoom: 0.5,
        maxZoom: 1,
      }),
    ).toBe(1);
    expect(
      calculateFitScale({
        containerWidth: Number.NaN,
        contentWidth: 600,
        minZoom: 0.5,
        maxZoom: 1,
      }),
    ).toBe(1);
  });
});
