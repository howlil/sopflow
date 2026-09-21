import { describe, expect, it } from "vitest";
import type { SOPDocument } from "@sopflow/core";
import { buildSopFlowchart } from "./buildSopFlowchart.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "flowchart",
  title: "Flowchart SOP",
  actors: [
    { id: "front-office", name: "Front Office" },
    { id: "manager", name: "Manager" },
  ],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: ["front-office"],
      next: "review",
    },
    {
      id: "review",
      type: "decision",
      name: "Valid?",
      actorIds: ["manager"],
      yes: "end",
      no: "start",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["manager"],
    },
  ],
};

describe("buildSopFlowchart", () => {
  it("creates one lane per document actor in document order", () => {
    const flowchart = buildSopFlowchart(document);

    expect(flowchart.lanes.map((lane) => lane.label)).toEqual([
      "Front Office",
      "Manager",
    ]);
    expect(flowchart.lanes[0]?.x).toBeLessThan(flowchart.lanes[1]?.x ?? 0);
  });

  it("places each step in its assigned actor lane and row", () => {
    const flowchart = buildSopFlowchart(document);
    const start = flowchart.nodes.find((node) => node.id === "start");
    const review = flowchart.nodes.find((node) => node.id === "review");

    expect(start?.row).toBe(0);
    expect(review?.row).toBe(1);
    expect(start?.placements[0]?.actorId).toBe("front-office");
    expect(review?.placements[0]?.actorId).toBe("manager");
    expect(start?.placements[0]?.y).toBeLessThan(review?.placements[0]?.y ?? 0);
  });

  it("keeps every actor placement for multi-actor steps", () => {
    const flowchart = buildSopFlowchart({
      ...document,
      steps: document.steps.map((step) =>
        step.id === "review"
          ? { ...step, actorIds: ["front-office", "manager"] }
          : step,
      ),
    });
    const review = flowchart.nodes.find((node) => node.id === "review");

    expect(review?.placements.map((placement) => placement.actorId)).toEqual([
      "front-office",
      "manager",
    ]);
  });

  it("routes forward and loopback edges without leaving the model empty", () => {
    const flowchart = buildSopFlowchart(document);
    const yes = flowchart.edges.find((edge) => edge.kind === "yes");
    const no = flowchart.edges.find((edge) => edge.kind === "no");

    expect(yes?.points.length).toBeGreaterThanOrEqual(2);
    expect(no?.points.length).toBeGreaterThanOrEqual(3);
    expect(flowchart.width).toBeGreaterThan(0);
    expect(flowchart.height).toBeGreaterThan(0);
  });

  it("provides a fallback lane when the document has no actors", () => {
    const flowchart = buildSopFlowchart({
      ...document,
      actors: [],
      steps: document.steps.map((step) => ({ ...step, actorIds: [] })),
    });

    expect(flowchart.lanes).toHaveLength(1);
    expect(flowchart.lanes[0]?.actorId).toBeNull();
    expect(flowchart.nodes.every((node) => node.placements.length === 1)).toBe(
      true,
    );
  });
});
