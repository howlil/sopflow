import { describe, expect, it } from "vitest";
import {
  finalizeFormalManualOrthogonalPath,
  formalPathCrossesShapeBodies,
  isFormalPathBlockingShapes,
  rebuildFormalPathForAnchorSides,
  repairFormalPathAroundShapes,
} from "./path-guard.js";

const obstacle = { left: 90, top: 90, width: 40, height: 40 };
const fromShape = { left: 20, top: 20, width: 40, height: 40 };
const toShape = { left: 200, top: 200, width: 40, height: 40 };

describe("formal manual path shape guard parity", () => {
  it("detects a path crossing another shape", () => {
    expect(
      isFormalPathBlockingShapes({
        path: [
          { x: 40, y: 60 },
          { x: 110, y: 60 },
          { x: 110, y: 200 },
          { x: 220, y: 200 },
        ],
        obstacles: [obstacle],
        fromShape,
        toShape,
      }),
    ).toBe(true);
  });

  it("detects a path travelling through the source body", () => {
    expect(
      formalPathCrossesShapeBodies(
        [
          { x: 40, y: 20 },
          { x: 40, y: 60 },
        ],
        fromShape,
        toShape,
      ),
    ).toBe(true);
  });

  it("allows a route that exits from the source boundary", () => {
    expect(
      formalPathCrossesShapeBodies(
        [
          { x: 40, y: 60 },
          { x: 40, y: 160 },
          { x: 220, y: 160 },
          { x: 220, y: 200 },
        ],
        fromShape,
        toShape,
      ),
    ).toBe(false);
  });

  it("repairs a blocking route around shape obstacles", () => {
    const repaired = repairFormalPathAroundShapes({
      startPoint: { x: 40, y: 60 },
      endPoint: { x: 220, y: 200 },
      sourceSide: "bottom",
      targetSide: "top",
      fromShape,
      toShape,
      obstacles: [obstacle],
      bounds: { left: 0, top: 0, width: 300, height: 300 },
    });

    expect(repaired).not.toBeNull();
    expect(
      repaired &&
        isFormalPathBlockingShapes({
          path: repaired,
          obstacles: [obstacle],
          fromShape,
          toShape,
        }),
    ).toBe(false);
  });

  it("rebuilds a route after an endpoint side changes", () => {
    const rebuilt = rebuildFormalPathForAnchorSides({
      startPoint: { x: 20, y: 40 },
      endPoint: { x: 220, y: 200 },
      sourceSide: "left",
      targetSide: "top",
      fromShape,
      toShape,
      bounds: { left: 0, top: 0, width: 400, height: 400 },
    });

    expect(rebuilt).not.toBeNull();
    expect(rebuilt?.[0]).toEqual({ x: 20, y: 40 });
    expect(rebuilt?.at(-1)).toEqual({ x: 220, y: 200 });
    expect(
      rebuilt && formalPathCrossesShapeBodies(rebuilt, fromShape, toShape),
    ).toBe(false);
  });

  it("keeps a colliding manual path when collision policy is warn", () => {
    const manual = [
      { x: 40, y: 60 },
      { x: 110, y: 60 },
      { x: 110, y: 200 },
      { x: 220, y: 200 },
    ];

    expect(
      finalizeFormalManualOrthogonalPath(manual, {
        collisionPolicy: "warn",
        check: {
          path: manual,
          obstacles: [obstacle],
          fromShape,
          toShape,
        },
        repair: {
          startPoint: manual[0] as { x: number; y: number },
          endPoint: manual.at(-1) as { x: number; y: number },
          sourceSide: "bottom",
          targetSide: "top",
          fromShape,
          toShape,
          obstacles: [obstacle],
          bounds: { left: 0, top: 0, width: 300, height: 300 },
        },
      }),
    ).toEqual(manual);
  });

  it("repairs a colliding path when collision policy is repair", () => {
    const manual = [
      { x: 40, y: 60 },
      { x: 110, y: 60 },
      { x: 110, y: 200 },
      { x: 220, y: 200 },
    ];

    const finalized = finalizeFormalManualOrthogonalPath(manual, {
      collisionPolicy: "repair",
      check: {
        path: manual,
        obstacles: [obstacle],
        fromShape,
        toShape,
      },
      repair: {
        startPoint: manual[0] as { x: number; y: number },
        endPoint: manual.at(-1) as { x: number; y: number },
        sourceSide: "bottom",
        targetSide: "top",
        fromShape,
        toShape,
        obstacles: [obstacle],
        bounds: { left: 0, top: 0, width: 300, height: 300 },
      },
    });

    expect(
      isFormalPathBlockingShapes({
        path: finalized,
        obstacles: [obstacle],
        fromShape,
        toShape,
      }),
    ).toBe(false);
  });
});
