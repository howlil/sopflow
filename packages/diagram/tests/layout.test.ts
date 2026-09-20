import { describe, expect, it } from "vitest";
import { buildDiagramModel } from "../src/buildDiagramModel.js";
import { layoutDiagram } from "../src/layout.js";
import type { DiagramModel } from "../src/types.js";
import type { SOPDocument } from "@sopflow/core";

const linearDocument: SOPDocument = {
  schemaVersion: "1",
  id: "linear",
  title: "Linear",
  actors: [],
  steps: [
    { id: "start", type: "start", name: "Start", actorIds: [], next: "task" },
    { id: "task", type: "task", name: "Task", actorIds: [], next: "end" },
    { id: "end", type: "end", name: "End", actorIds: [] },
  ],
};

const decisionDocument: SOPDocument = {
  schemaVersion: "1",
  id: "decision",
  title: "Decision",
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
      name: "Decision",
      actorIds: [],
      yes: "approve",
      no: "reject",
    },
    { id: "approve", type: "task", name: "Approve", actorIds: [], next: "end" },
    { id: "reject", type: "task", name: "Reject", actorIds: [], next: "end" },
    { id: "end", type: "end", name: "End", actorIds: [] },
  ],
};

const cyclicDocument: SOPDocument = {
  schemaVersion: "1",
  id: "cycle",
  title: "Cycle",
  actors: [],
  steps: [
    { id: "start", type: "start", name: "Start", actorIds: [], next: "review" },
    { id: "review", type: "task", name: "Review", actorIds: [], next: "fix" },
    {
      id: "fix",
      type: "decision",
      name: "Fix needed?",
      actorIds: [],
      yes: "review",
      no: "end",
    },
    { id: "end", type: "end", name: "End", actorIds: [] },
  ],
};

function getNode(model: DiagramModel, id: string) {
  const node = model.nodes.find((candidate) => candidate.id === id);

  if (!node) {
    throw new Error(`Node ${id} not found`);
  }

  return node;
}

describe("layoutDiagram", () => {
  it("places a linear workflow on consecutive layers", () => {
    const model = layoutDiagram(buildDiagramModel(linearDocument));
    const start = getNode(model, "start");
    const task = getNode(model, "task");
    const end = getNode(model, "end");

    expect(start.position.y).toBeLessThan(task.position.y);
    expect(task.position.y).toBeLessThan(end.position.y);
    expect(model.width).toBeGreaterThan(0);
    expect(model.height).toBeGreaterThan(0);
  });

  it("places decision branches on the same layer", () => {
    const model = layoutDiagram(buildDiagramModel(decisionDocument));
    const approve = getNode(model, "approve");
    const reject = getNode(model, "reject");

    expect(approve.position.y).toBe(reject.position.y);
    expect(approve.position.x).not.toBe(reject.position.x);
  });

  it("lays out cyclic workflows deterministically", () => {
    const first = layoutDiagram(buildDiagramModel(cyclicDocument));
    const second = layoutDiagram(buildDiagramModel(cyclicDocument));
    const review = getNode(first, "review");
    const fix = getNode(first, "fix");
    const end = getNode(first, "end");

    expect(second.nodes).toEqual(first.nodes);
    expect(second.width).toBe(first.width);
    expect(second.height).toBe(first.height);
    expect(review.position.y).toBeLessThan(fix.position.y);
    expect(fix.position.y).toBeLessThan(end.position.y);
  });

  it("returns an empty canvas for an empty model", () => {
    expect(
      layoutDiagram({
        nodes: [],
        edges: [],
        routedEdges: [],
        width: 320,
        height: 240,
      }),
    ).toEqual({
      nodes: [],
      edges: [],
      routedEdges: [],
      width: 0,
      height: 0,
    });
  });
});
