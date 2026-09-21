import type { SOPDocument } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import { buildBpmnModel } from "./bpmn.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "bpmn",
  title: "BPMN",
  actors: [
    { id: "staff", name: "Staff" },
    { id: "manager", name: "Manager" },
  ],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: ["staff"],
      next: "review",
    },
    {
      id: "review",
      type: "decision",
      name: "Valid?",
      actorIds: ["manager"],
      yes: "end",
      no: "fix",
    },
    {
      id: "fix",
      type: "task",
      name: "Perbaiki",
      actorIds: ["staff"],
      next: "review",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["manager"],
    },
  ],
};

describe("buildBpmnModel", () => {
  it("lays out actor lanes and nodes from the shared workflow graph", () => {
    const model = buildBpmnModel(document);

    expect(model.lanes.map((lane) => lane.label)).toEqual(["Staff", "Manager"]);
    expect(model.nodes.find((node) => node.id === "review")).toMatchObject({
      kind: "decision",
      laneIndex: 1,
    });
    expect(model.edges.map((edge) => edge.id)).toEqual([
      "start:next:review",
      "review:yes:end",
      "review:no:fix",
      "fix:next:review",
    ]);
  });

  it("routes every renderable edge without rebuilding topology", () => {
    const model = buildBpmnModel(document);

    expect(model.edges).toHaveLength(4);
    expect(model.edges.every((edge) => edge.points.length >= 2)).toBe(true);
    expect(model.edges.find((edge) => edge.kind === "yes")?.label).toBe("Ya");
    expect(model.edges.find((edge) => edge.kind === "no")?.label).toBe("Tidak");
  });
});
