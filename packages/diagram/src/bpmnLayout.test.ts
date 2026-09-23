import type { SOPDocument } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import { layoutBpmnGraph } from "./bpmnLayout.js";
import { projectWorkflow } from "./workflow.js";

function columns(document: SOPDocument): Record<string, number> {
  const graph = projectWorkflow(document);
  return Object.fromEntries(
    layoutBpmnGraph(document, graph).map((node) => [node.id, node.columnIndex]),
  );
}

describe("layoutBpmnGraph", () => {
  it("advances a simple same-lane chain", () => {
    const document: SOPDocument = {
      schemaVersion: "1",
      id: "linear",
      title: "Linear",
      actors: [{ id: "actor", name: "Actor" }],
      steps: [
        {
          id: "start",
          type: "start",
          name: "Start",
          actorIds: ["actor"],
          next: "task",
        },
        {
          id: "task",
          type: "task",
          name: "Task",
          actorIds: ["actor"],
          next: "end",
        },
        {
          id: "end",
          type: "end",
          name: "End",
          actorIds: ["actor"],
        },
      ],
    };

    expect(columns(document)).toEqual({ start: 0, task: 1, end: 2 });
  });

  it("keeps a simple one-to-one cross-lane handoff in the same column", () => {
    const document: SOPDocument = {
      schemaVersion: "1",
      id: "handoff",
      title: "Handoff",
      actors: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      steps: [
        {
          id: "start",
          type: "start",
          name: "Start",
          actorIds: ["a"],
          next: "handoff",
        },
        {
          id: "handoff",
          type: "task",
          name: "Handoff",
          actorIds: ["b"],
          next: "end",
        },
        {
          id: "end",
          type: "end",
          name: "End",
          actorIds: ["b"],
        },
      ],
    };

    const result = columns(document);
    expect(result.start).toBe(0);
    expect(result.handoff).toBe(0);
    expect(result.end).toBe(1);
  });

  it("moves decision branches forward and prevents lane-column collisions", () => {
    const document: SOPDocument = {
      schemaVersion: "1",
      id: "decision",
      title: "Decision",
      actors: [{ id: "actor", name: "Actor" }],
      steps: [
        {
          id: "start",
          type: "start",
          name: "Start",
          actorIds: ["actor"],
          next: "decision",
        },
        {
          id: "decision",
          type: "decision",
          name: "Decision",
          actorIds: ["actor"],
          yes: "yes-task",
          no: "no-task",
        },
        {
          id: "yes-task",
          type: "task",
          name: "Yes",
          actorIds: ["actor"],
          next: "end",
        },
        {
          id: "no-task",
          type: "task",
          name: "No",
          actorIds: ["actor"],
          next: "end",
        },
        {
          id: "end",
          type: "end",
          name: "End",
          actorIds: ["actor"],
        },
      ],
    };

    const result = columns(document);
    expect(result["yes-task"]).toBeGreaterThan(result.decision ?? -1);
    expect(result["no-task"]).toBeGreaterThan(result.decision ?? -1);
    expect(result["yes-task"]).not.toBe(result["no-task"]);
    expect(result.end).toBeGreaterThan(
      Math.max(result["yes-task"] ?? -1, result["no-task"] ?? -1),
    );
  });

  it("does not let a feedback edge push the forward graph to the right", () => {
    const document: SOPDocument = {
      schemaVersion: "1",
      id: "feedback",
      title: "Feedback",
      actors: [
        { id: "staff", name: "Staff" },
        { id: "manager", name: "Manager" },
      ],
      steps: [
        {
          id: "start",
          type: "start",
          name: "Start",
          actorIds: ["staff"],
          next: "review",
        },
        {
          id: "review",
          type: "decision",
          name: "Review",
          actorIds: ["manager"],
          yes: "end",
          no: "fix",
        },
        {
          id: "fix",
          type: "task",
          name: "Fix",
          actorIds: ["staff"],
          next: "review",
        },
        {
          id: "end",
          type: "end",
          name: "End",
          actorIds: ["manager"],
        },
      ],
    };

    const result = columns(document);
    expect(result.review).toBe(0);
    expect(result.fix).toBe(1);
    expect(result.end).toBe(1);
  });
});
