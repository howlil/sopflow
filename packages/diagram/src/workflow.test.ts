import type { SOPDocument } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import { projectWorkflow } from "./workflow.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "workflow",
  title: "Workflow",
  actors: [],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: [],
      next: "decision",
    },
    {
      id: "decision",
      type: "decision",
      name: "Valid?",
      actorIds: [],
      yes: "end",
      no: "retry",
    },
    {
      id: "retry",
      type: "task",
      name: "Perbaiki",
      actorIds: [],
      next: "decision",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: [],
    },
  ],
};

describe("projectWorkflow", () => {
  it("projects stable nodes and edges without changing authoring order", () => {
    const graph = projectWorkflow(document);

    expect(graph.nodes.map((node) => node.id)).toEqual([
      "start",
      "decision",
      "retry",
      "end",
    ]);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        {
          id: "start:next:decision",
          from: "start",
          to: "decision",
          kind: "next",
        },
        {
          id: "decision:yes:end",
          from: "decision",
          to: "end",
          kind: "yes",
          label: "Ya",
        },
        {
          id: "decision:no:retry",
          from: "decision",
          to: "retry",
          kind: "no",
          label: "Tidak",
        },
        {
          id: "retry:next:decision",
          from: "retry",
          to: "decision",
          kind: "next",
        },
      ]),
    );
    expect(graph.connections).toHaveLength(4);
  });

  it("reports a missing target once at the projection boundary", () => {
    const graph = projectWorkflow({
      ...document,
      steps: [
        {
          id: "start",
          type: "start",
          name: "Mulai",
          actorIds: [],
          next: "missing",
        },
      ],
    });

    expect(graph.edges).toEqual([]);
    expect(graph.connections).toEqual([
      {
        id: "start:next:missing",
        from: "start",
        to: "missing",
        kind: "next",
      },
    ]);
    expect(graph.diagnostics).toEqual([
      {
        code: "MISSING_EDGE_TARGET",
        edgeId: "start:next:missing",
        from: "start",
        to: "missing",
      },
    ]);
  });

  it("keeps projection stable when document step storage order changes", () => {
    const original = projectWorkflow(document);
    const shuffled = projectWorkflow({
      ...document,
      steps: [...document.steps].reverse(),
    });

    expect(shuffled).toEqual(original);
  });
});
