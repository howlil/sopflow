import type { SOPDocument } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import { buildDiagram } from "../buildDiagram.js";
import { getDiamondPoints } from "./getDiamondPoints.js";
import { pointsToPath } from "./pointsToPath.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "svg-render",
  title: "SVG render",
  actors: [],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Start",
      actorIds: [],
      next: "decision",
    },
    {
      id: "decision",
      type: "decision",
      name: "Ready?",
      actorIds: [],
      yes: "approve",
      no: "reject",
    },
    { id: "approve", type: "task", name: "Approve", actorIds: [], next: "end" },
    { id: "reject", type: "task", name: "Reject", actorIds: [], next: "end" },
    { id: "end", type: "end", name: "End", actorIds: [] },
  ],
};

describe("buildSvgRenderModel", () => {
  it("creates nodes and paths from the pure diagram pipeline", () => {
    const diagram = buildDiagram(document);

    expect(diagram.nodes).toHaveLength(document.steps.length);
    expect(diagram.edges.every((edge) => edge.path.startsWith("M "))).toBe(
      true,
    );
    expect(diagram.diagnostics).toEqual([]);
  });

  it("produces identical output for identical input", () => {
    expect(buildDiagram(document)).toEqual(buildDiagram(document));
  });

  it("carries wrapped text geometry into the SVG model", () => {
    const diagram = buildDiagram({
      ...document,
      steps: document.steps.map((step) =>
        step.id === "approve"
          ? {
              ...step,
              name: "Verifikasi kelengkapan dokumen pengajuan",
            }
          : step,
      ),
    });
    const approve = diagram.nodes.find((node) => node.id === "approve");

    expect(approve?.lines.length).toBeGreaterThan(1);
    expect(approve?.lineHeight).toBe(18);
    expect(approve?.height).toBeGreaterThan(64);
  });

  it("maps node kinds to stable SVG shapes", () => {
    const diagram = buildDiagram(document);

    expect(diagram.nodes.find((node) => node.id === "start")?.shape).toBe(
      "rounded",
    );
    expect(diagram.nodes.find((node) => node.id === "decision")?.shape).toBe(
      "diamond",
    );
    expect(diagram.nodes.find((node) => node.id === "approve")?.shape).toBe(
      "rect",
    );
    expect(diagram.nodes.find((node) => node.id === "end")?.shape).toBe(
      "rounded",
    );
  });

  it("preserves branch labels and computes their positions", () => {
    const diagram = buildDiagram(document);
    const yes = diagram.edges.find((edge) => edge.kind === "yes");
    const no = diagram.edges.find((edge) => edge.kind === "no");

    expect(yes?.label).toBe("Ya");
    expect(yes?.labelPosition).toBeDefined();
    expect(no?.label).toBe("Tidak");
    expect(no?.labelPosition).toBeDefined();
  });

  it("passes layout and routing options through the pure pipeline", () => {
    const defaultDiagram = buildDiagram(document);
    const paddedDiagram = buildDiagram(document, {
      layout: { padding: 96 },
      routing: { edgeGap: 64 },
    });

    expect(paddedDiagram.width).toBeGreaterThan(defaultDiagram.width);
    expect(paddedDiagram.height).toBeGreaterThan(defaultDiagram.height);
  });
});

describe("SVG geometry helpers", () => {
  it("converts points to a predictable path", () => {
    expect(pointsToPath([])).toBe("");
    expect(
      pointsToPath([
        { x: 10, y: 20 },
        { x: 10, y: 40 },
        { x: 30, y: 40 },
      ]),
    ).toBe("M 10 20 L 10 40 L 30 40");
  });

  it("returns deterministic clockwise diamond points", () => {
    expect(getDiamondPoints(10, 20, 40, 20)).toBe("30,20 50,30 30,40 10,30");
  });
});
