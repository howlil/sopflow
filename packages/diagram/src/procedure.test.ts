import type { SOPDocument } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import {
  buildProcedureModel,
  removeProcedureManualRoute,
  routeProcedureEdges,
  setProcedureManualRoute,
  updateProcedureManualTrunk,
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

function geometry(): ProcedureGeometry {
  return {
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
}

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
    const edges = routeProcedureEdges(model, geometry());
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

  it("keeps legacy manual trunks working by stable edge id", () => {
    const model = buildProcedureModel(document);
    const edges = routeProcedureEdges(model, geometry(), {
      "review:no:start": 420,
    });

    expect(edges.find((edge) => edge.id === "review:no:start")?.trunkX).toBe(
      420,
    );
  });

  it("stores trunk edits as controlled diagram config", () => {
    const model = buildProcedureModel(document);
    const config = updateProcedureManualTrunk(
      model,
      geometry(),
      {},
      "review:no:start",
      420,
    );

    expect(config).toEqual({
      routes: {
        "review:no:start": {
          kind: "trunk",
          x: 420,
        },
      },
    });

    const edge = routeProcedureEdges(model, geometry(), config).find(
      (candidate) => candidate.id === "review:no:start",
    );
    expect(edge?.trunkX).toBe(420);
    expect(edge?.handlePosition).toEqual({ x: 420, y: 150 });
  });

  it("keeps adaptive trunk routes attached when row geometry changes", () => {
    const model = buildProcedureModel(document);
    const config = updateProcedureManualTrunk(
      model,
      geometry(),
      {},
      "review:no:start",
      420,
    );
    const moved: ProcedureGeometry = {
      ...geometry(),
      anchors: new Map([
        ["start", { x: 250, y: 80 }],
        ["review", { x: 350, y: 260 }],
        ["end", { x: 450, y: 360 }],
      ]),
    };

    const edge = routeProcedureEdges(model, moved, config).find(
      (candidate) => candidate.id === "review:no:start",
    );

    expect(edge?.points[0]).toEqual({ x: 350, y: 260 });
    expect(edge?.points.at(-1)).toEqual({ x: 250, y: 80 });
    expect(edge?.handlePosition).toEqual({ x: 420, y: 170 });
  });

  it("supports explicit orthogonal manual bend points", () => {
    const model = buildProcedureModel(document);
    const config = setProcedureManualRoute({}, "start:next:review", {
      kind: "orthogonal",
      bendPoints: [
        { x: 280, y: 100 },
        { x: 280, y: 170 },
        { x: 350, y: 170 },
      ],
    });

    const edge = routeProcedureEdges(model, geometry(), config).find(
      (candidate) => candidate.id === "start:next:review",
    );

    expect(edge?.points).toEqual([
      { x: 250, y: 100 },
      { x: 280, y: 100 },
      { x: 280, y: 170 },
      { x: 350, y: 170 },
      { x: 350, y: 200 },
    ]);
  });

  it("removes a controlled manual route without mutating the rest", () => {
    const config = setProcedureManualRoute(
      { routes: { keep: { kind: "trunk", x: 300 } } },
      "remove",
      { kind: "trunk", x: 420 },
    );

    expect(removeProcedureManualRoute(config, "remove")).toEqual({
      routes: {
        keep: { kind: "trunk", x: 300 },
      },
    });
  });
});
