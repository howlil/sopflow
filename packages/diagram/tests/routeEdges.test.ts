import { describe, expect, it } from "vitest";
import { buildDiagramModel } from "../src/buildDiagramModel.js";
import { layoutDiagram } from "../src/layout.js";
import { routeDiagramEdges } from "../src/routeEdges.js";
import type { DiagramModel, DiagramPoint } from "../src/types.js";
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

function routed(document: SOPDocument) {
  return routeDiagramEdges(layoutDiagram(buildDiagramModel(document)));
}

function isOrthogonal(points: DiagramPoint[]) {
  return points.every((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return (
      previous !== undefined &&
      (previous.x === point.x || previous.y === point.y)
    );
  });
}

describe("routeDiagramEdges", () => {
  it("routes a vertical forward edge", () => {
    const model = routed(linearDocument);
    const edge = model.routedEdges.find(
      (candidate) => candidate.from === "start" && candidate.to === "task",
    );

    expect(edge).toBeDefined();
    if (!edge) return;
    expect(edge.points.length).toBe(2);
    const start = edge.points[0];
    const end = edge.points[1];
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    if (!start || !end) return;
    expect(start.y).toBeLessThan(end.y);
  });

  it("routes decision branches orthogonally", () => {
    const model = routed(decisionDocument);
    const branches = model.routedEdges.filter(
      (edge) => edge.kind === "yes" || edge.kind === "no",
    );

    expect(branches).toHaveLength(2);
    expect(branches.every((edge) => isOrthogonal(edge.points))).toBe(true);
    expect(branches.map((edge) => edge.label)).toEqual(["Ya", "Tidak"]);
  });

  it("routes merge edges orthogonally", () => {
    const model = routed(decisionDocument);
    const mergeEdges = model.routedEdges.filter((edge) => edge.to === "end");

    expect(mergeEdges).toHaveLength(2);
    expect(mergeEdges.every((edge) => isOrthogonal(edge.points))).toBe(true);
  });

  it("routes back edges outside the node right bounds", () => {
    const model = routed(cyclicDocument);
    const backEdge = model.routedEdges.find((edge) => {
      const from = model.nodes.find((node) => node.id === edge.from);
      const to = model.nodes.find((node) => node.id === edge.to);
      return from && to && to.position.y <= from.position.y;
    });

    expect(backEdge).toBeDefined();
    if (!backEdge) return;
    expect(backEdge.points.length).toBeGreaterThan(2);
    const routeX = Math.max(...backEdge.points.map((point) => point.x));
    const nodeRight = Math.max(
      ...model.nodes
        .filter(
          (node) => node.id === backEdge?.from || node.id === backEdge?.to,
        )
        .map((node) => node.position.x + node.size.width),
    );
    expect(routeX).toBeGreaterThan(nodeRight);
    expect(isOrthogonal(backEdge.points)).toBe(true);
  });

  it("returns empty points for a missing endpoint", () => {
    const model: DiagramModel = {
      nodes: [
        {
          id: "from",
          kind: "task",
          label: "From",
          position: { x: 0, y: 0 },
          size: { width: 100, height: 50 },
        },
      ],
      edges: [{ id: "dangling", from: "from", to: "missing", kind: "next" }],
      routedEdges: [],
      width: 100,
      height: 50,
    };

    const routedEdge = routeDiagramEdges(model).routedEdges[0];
    expect(routedEdge).toBeDefined();
    expect(routedEdge?.points).toEqual([]);
  });

  it("routes the same model deterministically", () => {
    const first = routed(cyclicDocument);
    const second = routed(cyclicDocument);

    expect(second.routedEdges).toEqual(first.routedEdges);
  });
});
