import { describe, expect, it } from "vitest";
import { positionFloatingMenu } from "./floating-menu-position.js";

const anchor = (left: number, top: number, width = 200, height = 36) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
});

describe("positionFloatingMenu", () => {
  it("opens below when there is room", () => {
    expect(positionFloatingMenu(anchor(120, 80), 120, 1024, 768)).toEqual({
      left: 120,
      top: 122,
      width: 200,
      maxHeight: 320,
      side: "bottom",
    });
  });

  it("flips above when the last procedure row is close to the viewport bottom", () => {
    expect(positionFloatingMenu(anchor(120, 510), 150, 900, 600)).toEqual({
      left: 120,
      top: 354,
      width: 200,
      maxHeight: 320,
      side: "top",
    });
  });

  it("shifts horizontal menu bounds and caps the menu's scroll height", () => {
    expect(positionFloatingMenu(anchor(690, 190, 190), 900, 800, 500)).toEqual({
      left: 602,
      top: 232,
      width: 190,
      maxHeight: 260,
      side: "bottom",
    });
  });

  it("handles narrow browser windows without rendering beyond their edges", () => {
    const placement = positionFloatingMenu(anchor(100, 50, 280), 500, 180, 160);
    expect(placement.left).toBe(8);
    expect(placement.width).toBe(164);
    expect(placement.left + placement.width).toBeLessThanOrEqual(172);
    expect(placement.maxHeight).toBeGreaterThanOrEqual(0);
  });
});
