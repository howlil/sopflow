import { describe, expect, it } from "vitest";
import {
  buildFormalEdgeAnchorId,
  buildFormalVisualConnectorAnchors,
  formalSnapDistanceToCenter,
  pickFormalDiamondSideFromPointer,
  pickFormalSnapSideForPointer,
  projectPointerToFormalShapeEdge,
  resolveFormalAnchorSnap,
  resolveFormalConstrainedEdgeSnap,
  resolveFormalMagneticAnchorSnap,
  resolveFormalPreferredEndpointSnap,
} from "./anchor-snap.js";

const anchors = [
  { id: "start-top", x: 100, y: 80, side: "top", kind: "start" },
  { id: "start-right", x: 140, y: 100, side: "right", kind: "start" },
  { id: "end-left", x: 260, y: 100, side: "left", kind: "end" },
] as const;

const shape = { left: 100, top: 80, width: 40, height: 40 };

describe("formal flowchart endpoint snapping parity", () => {
  it("snaps to the nearest anchor and keeps a locked anchor until release", () => {
    expect(
      resolveFormalAnchorSnap({
        anchors,
        x: 136,
        y: 98,
        kind: "start",
        snapDistancePx: 12,
        releaseDistancePx: 18,
      })?.id,
    ).toBe("start-right");

    expect(
      resolveFormalAnchorSnap({
        anchors,
        x: 152,
        y: 111,
        kind: "start",
        snapDistancePx: 8,
        releaseDistancePx: 20,
        lockedAnchorId: "start-right",
      })?.id,
    ).toBe("start-right");
  });

  it("returns a magnetic position and hard-snaps near the anchor", () => {
    const soft = resolveFormalMagneticAnchorSnap({
      anchors,
      x: 128,
      y: 100,
      kind: "start",
      snapDistancePx: 16,
      releaseDistancePx: 24,
      hardSnapDistancePx: 5,
    });
    expect(soft?.anchor.id).toBe("start-right");
    expect(soft?.hardSnapped).toBe(false);
    expect(soft?.x).toBeGreaterThan(128);
    expect(soft?.x).toBeLessThan(140);

    const hard = resolveFormalMagneticAnchorSnap({
      anchors,
      x: 137,
      y: 100,
      kind: "start",
      snapDistancePx: 16,
      releaseDistancePx: 24,
      hardSnapDistancePx: 5,
    });
    expect(hard?.hardSnapped).toBe(true);
    expect(hard?.x).toBe(140);
  });

  it("projects a pointer onto a requested shape edge", () => {
    expect(projectPointerToFormalShapeEdge(shape, 115, 70)?.side).toBe("top");
    expect(projectPointerToFormalShapeEdge(shape, 150, 95)?.side).toBe("right");
    expect(projectPointerToFormalShapeEdge(shape, 150, 95, "top")?.y).toBe(80);
  });

  it("slides regular shapes on the perimeter but pins diamonds to vertices", () => {
    const regular = resolveFormalConstrainedEdgeSnap({
      connectionId: "edge",
      shape,
      x: 90,
      y: 95,
      kind: "start",
    });
    expect(regular?.side).toBe("left");
    expect(regular?.x).toBe(100);

    const diamond = { left: 100, top: 100, width: 80, height: 80 };
    expect(pickFormalDiamondSideFromPointer(diamond, 90, 120)).toBe("left");

    const snapped = resolveFormalConstrainedEdgeSnap({
      connectionId: "edge",
      shape: diamond,
      x: 95,
      y: 130,
      kind: "start",
      shapeIsDiamond: true,
    });
    expect(snapped).toMatchObject({
      side: "left",
      x: 100,
      y: 140,
      distance: 0.5,
      hardSnapped: true,
    });
  });

  it("uses pointer zones then the opposite point to choose a side", () => {
    const wide = { left: 100, top: 200, width: 200, height: 40 };

    expect(pickFormalSnapSideForPointer(wide, 105, 150)).toBe("left");
    expect(pickFormalSnapSideForPointer(wide, 285, 220)).toBe("right");
    expect(
      pickFormalSnapSideForPointer(wide, 170, 150, {
        oppositePoint: { x: 200, y: 80 },
      }),
    ).toBe("top");
  });

  it("builds four diamond anchors and twelve regular anchors", () => {
    const diamond = { left: 100, top: 100, width: 80, height: 80 };
    const process = { left: 300, top: 100, width: 120, height: 50 };
    const built = buildFormalVisualConnectorAnchors("edge", diamond, process, {
      fromIsDiamond: true,
    });

    expect(built.filter((anchor) => anchor.kind === "start")).toHaveLength(4);
    expect(built.filter((anchor) => anchor.kind === "end")).toHaveLength(12);
  });

  it("prefers the center anchor without switching the projected side", () => {
    const rect = { left: 100, top: 100, width: 120, height: 50 };
    const built = buildFormalVisualConnectorAnchors("edge", rect, {
      left: 300,
      top: 100,
      width: 80,
      height: 40,
    });

    const snapped = resolveFormalPreferredEndpointSnap({
      connectionId: "edge",
      shape: rect,
      anchors: built,
      x: 162,
      y: 100,
      kind: "start",
    });

    expect(snapped?.side).toBe("top");
    expect(snapped?.distance).toBe(0.5);
    expect(snapped?.x).toBe(160);
  });

  it("keeps the center threshold compatible with sop-ta", () => {
    expect(formalSnapDistanceToCenter(0.48, 200)).toBe(0.5);
    expect(formalSnapDistanceToCenter(0.2, 200)).toBe(0.2);
    expect(buildFormalEdgeAnchorId("edge", "end", "bottom")).toBe(
      "edge-end-bottom",
    );
  });
});
