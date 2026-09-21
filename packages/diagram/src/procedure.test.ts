import type { SOPDocument } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import {
  buildProcedureModel,
  routeProcedureEdges,
  type ProcedureGeometry,
} from "./procedure.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "procedure",
  title: "Procedure",
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
      actorIds: ["staff", "manager"],
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

describe("procedure model", () => {
  it("keeps authoring rows separate from workflow topology", () => {
    const model = buildProcedureModel(document);

    expect(model.rows.map((row) => row.stepId)).toEqual([
      "start",
      "review",
      "end",
    ]);
    expect(model.rows[1]?.primaryActorId).toBe("staff");
    expect(model.actorColumns.map((column) => column.actorId)).toEqual([
      "staff",
      "manager",
    ]);
    expect(model.graph.edges.map((edge) => edge.id)).toEqual([
      "start:next:review",
      "review:yes:end",
      "review:no:start",
    ]);
  });

  it("routes forward and loopback edges from measured geometry", () => {
    const model = buildProcedureModel(document);
    const geometry: ProcedureGeometry = {
      width: 600,
      height: 400,
      actorLeft: 200,
      actorRight: 500,
      anchors: new Map([
        ["start", { x: 250, y: 100 }],
        ["review", { x: 350, y: 200 }],
        ["end", { x: 450, y: 300 }],
      ]),
    };

    const edges = routeProcedureEdges(model, geometry);
    const forward = edges.find((edge) => edge.id === "start:next:review");
    const loopback = edges.find((edge) => edge.id === "review:no:start");

    expect(forward?.trunkX).toBe(300);
    expect(loopback?.trunkX).toBe(490);
    expect(loopback?.handlePosition).toEqual({ x: 490, y: 150 });
    expect(loopback?.points).toEqual([
      { x: 350, y: 200 },
      { x: 490, y: 200 },
      { x: 490, y: 100 },
      { x: 250, y: 100 },
    ]);
  });

  it("applies manual trunks by stable edge id", () => {
    const model = buildProcedureModel(document);
    const geometry: ProcedureGeometry = {
      width: 600,
      height: 400,
      actorLeft: 200,
      actorRight: 500,
      anchors: new Map([
        ["start", { x: 250, y: 100 }],
        ["review", { x: 350, y: 200 }],
        ["end", { x: 450, y: 300 }],
      ]),
    };

    const edges = routeProcedureEdges(model, geometry, {
      "review:no:start": 420,
    });

    expect(edges.find((edge) => edge.id === "review:no:start")?.trunkX).toBe(
      420,
    );
  });
});
