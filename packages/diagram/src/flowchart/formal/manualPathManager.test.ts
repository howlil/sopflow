import { describe, expect, it } from "vitest";
import type { DiagramPoint } from "../../types.js";
import {
  commitManualPathEdit,
  manualPathPreviewEquals,
  previewManualPathDrag,
  type ManualPathEditContext,
} from "./manualPathManager.js";

const path: DiagramPoint[] = [
  { x: 100, y: 100 },
  { x: 140, y: 100 },
  { x: 140, y: 180 },
  { x: 220, y: 180 },
  { x: 220, y: 240 },
];

const context: ManualPathEditContext = {
  sourceSide: "right",
  targetSide: "top",
  bounds: { left: 0, top: 0, width: 500, height: 400 },
};

describe("manual path manager", () => {
  it("previews waypoint changes from immutable origin coordinates", () => {
    const first = previewManualPathDrag({
      mode: "waypoint",
      index: 2,
      originPath: path,
      originPoint: { x: 140, y: 180 },
      point: { x: 140, y: 196 },
      context,
    });
    const second = previewManualPathDrag({
      mode: "waypoint",
      index: 2,
      originPath: path,
      originPoint: { x: 140, y: 180 },
      point: { x: 140, y: 196 },
      context,
    });

    expect(second).toEqual(first);
    expect(first.path).not.toBe(path);
    expect(path[2]).toEqual({ x: 140, y: 180 });
    expect(manualPathPreviewEquals(first, second)).toBe(true);
  });

  it("uses grid-aligned segment movement without mutating input", () => {
    const preview = previewManualPathDrag({
      mode: "segment",
      index: 1,
      originPath: path,
      originPoint: { x: 140, y: 140 },
      point: { x: 158, y: 140 },
      context,
    });
    expect(preview.path[1]?.x).toBe(160);
    expect(preview.path[2]?.x).toBe(160);
    expect(path[1]?.x).toBe(140);
    expect(
      manualPathPreviewEquals(preview, {
        ...preview,
        sourceSide: "left",
      }),
    ).toBe(false);
  });

  it("snaps endpoint moves to allowed shape sides", () => {
    const preview = previewManualPathDrag({
      mode: "source-endpoint",
      index: 0,
      originPath: path,
      originPoint: { x: 100, y: 100 },
      point: { x: 180, y: 120 },
      context: {
        ...context,
        sourceRect: { left: 80, top: 80, width: 40, height: 40 },
      },
    });
    expect(preview.sourceSide).toBe("right");
    expect(preview.path[0]?.x).toBe(120);
    expect(preview.path[0]?.y).toBeGreaterThanOrEqual(80);
  });

  it("commits one validated route without altering the stored origin path", () => {
    const preview = {
      path,
      sourceSide: context.sourceSide,
      targetSide: context.targetSide,
    };
    const result = commitManualPathEdit(preview, context);
    expect(result).not.toBeNull();
    expect(result?.startPoint).toEqual(path[0]);
    expect(result?.endPoint).toEqual(path.at(-1));
    expect(result?.bendPoints.length).toBeGreaterThan(0);
    expect(path).toHaveLength(5);
  });
});
