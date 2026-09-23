import { describe, expect, it } from "vitest";
import { buildDiagramModel } from "./buildDiagramModel.js";
import { layoutDiagram } from "./layout.js";
import type { DiagramModel } from "./types.js";
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

function overlaps(
  a: ReturnType<typeof getNode>,
  b: ReturnType<typeof getNode>,
) {
  return !(
    a.position.x + a.size.width <= b.position.x ||
    b.position.x + b.size.width <= a.position.x ||
    a.position.y + a.size.height <= b.position.y ||
    b.position.y + b.size.height <= a.position.y
  );
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
        diagnostics: [],
        width: 320,
        height: 240,
      }),
    ).toEqual({
      nodes: [],
      edges: [],
      routedEdges: [],
      diagnostics: [],
      width: 0,
      height: 0,
    });
  });

  it("accounts for dynamic node heights during layout", () => {
    const model = layoutDiagram(
      buildDiagramModel({
        ...linearDocument,
        id: "long-label",
        steps: linearDocument.steps.map((step) =>
          step.id === "task"
            ? {
                ...step,
                name: "Verifikasi seluruh kelengkapan dokumen pengajuan sebelum diteruskan",
              }
            : step,
        ),
      }),
    );
    const task = getNode(model, "task");
    const end = getNode(model, "end");

    expect(task.position.y + task.size.height).toBeLessThan(end.position.y);
  });

  it("does not overlap sibling nodes in one layer", () => {
    const model = layoutDiagram(buildDiagramModel(decisionDocument));
    const approve = getNode(model, "approve");
    const reject = getNode(model, "reject");

    expect(overlaps(approve, reject)).toBe(false);
  });

  it("sanitizes invalid node dimensions and layout options", () => {
    const model = layoutDiagram(
      {
        nodes: [
          {
            id: "invalid",
            kind: "task",
            label: "Invalid",
            text: { lines: ["Invalid"], lineHeight: 18 },
            position: { x: Number.POSITIVE_INFINITY, y: Number.NaN },
            size: { width: Number.NaN, height: -20 },
          },
        ],
        edges: [],
        routedEdges: [],
        diagnostics: [],
        width: Number.NaN,
        height: Number.POSITIVE_INFINITY,
      },
      {
        nodeGap: Number.NaN,
        layerGap: -10,
        padding: Number.POSITIVE_INFINITY,
      },
    );

    const [node] = model.nodes;
    expect(node).toBeDefined();
    expect(node?.size.width).toBe(160);
    expect(node?.size.height).toBe(1);
    expect(node?.position.x).toBe(48);
    expect(node?.position.y).toBe(48);
    expect(Number.isFinite(model.width)).toBe(true);
    expect(Number.isFinite(model.height)).toBe(true);
    expect(model.width).toBeGreaterThanOrEqual(0);
    expect(model.height).toBeGreaterThanOrEqual(0);
  });
});
