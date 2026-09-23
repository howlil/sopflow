import type { SOPDocument } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import {
  buildProcedureModel,
  removeProcedureManualRoute,
  pruneProcedureManualRoutes,
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

  it("creates an explicit fallback lane for unassigned rows", () => {
    const model = buildProcedureModel({
      ...document,
      steps: document.steps.map((step) =>
        step.id === "review" ? { ...step, actorIds: [] } : step,
      ),
    });

    expect(model.actorColumns.at(-1)).toEqual({
      actorId: null,
      label: "Pelaksana",
    });
    expect(
      model.rows.find((row) => row.stepId === "review")?.primaryActorId,
    ).toBe(null);
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

  it("routes a self-loop around the measured anchor", () => {
    const selfLoopDocument: SOPDocument = {
      ...document,
      id: "self-loop",
      steps: [
        document.steps[0] as SOPDocument["steps"][number],
        {
          id: "review",
          type: "decision",
          name: "Valid?",
          actorIds: ["staff"],
          yes: "review",
          no: "end",
        },
        document.steps[2] as SOPDocument["steps"][number],
      ],
    };
    const model = buildProcedureModel(selfLoopDocument);
    const edge = routeProcedureEdges(model, geometry()).find(
      (candidate) => candidate.id === "review:yes:review",
    );

    expect(edge).toBeDefined();
    if (!edge) return;
    expect(edge.points.length).toBeGreaterThan(2);
    expect(
      new Set(edge.points.map((point) => `${point.x}:${point.y}`)).size,
    ).toBeGreaterThan(2);
    expect(edge.handlePosition).not.toEqual({ x: 350, y: 200 });
  });

  it("keeps converging decision branches on separate route channels", () => {
    const sharedTarget: SOPDocument = {
      ...document,
      id: "shared-target",
      steps: document.steps.map((step) =>
        step.id === "review" ? { ...step, yes: "end", no: "end" } : step,
      ),
    };
    const model = buildProcedureModel(sharedTarget);
    const branches = routeProcedureEdges(model, geometry()).filter(
      (edge) => edge.from === "review" && edge.to === "end",
    );

    expect(branches).toHaveLength(2);
    expect(branches[0]?.points).not.toEqual(branches[1]?.points);
  });

  it("keeps edges when a row anchor is not measured yet", () => {
    const model = buildProcedureModel(document);
    const incompleteGeometry: ProcedureGeometry = {
      ...geometry(),
      anchors: new Map([["start", { x: 250, y: 100 }]]),
    };

    const edges = routeProcedureEdges(model, incompleteGeometry);

    expect(edges.map((edge) => edge.id)).toEqual([
      "start:next:review",
      "review:yes:end",
      "review:no:start",
    ]);
    expect(edges.every((edge) => edge.points.length > 1)).toBe(true);
    expect(edges[1]?.routeDiagnostics).toContainEqual(
      expect.objectContaining({ code: "MISSING_ANCHOR" }),
    );
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

  it("supports semantic manual route endpoints and prunes stale overrides", () => {
    const config = setProcedureManualRoute({}, "start:next:review", {
      kind: "trunk",
      x: 300,
      sSide: "bottom",
      eSide: "top",
      startPoint: { x: 250, y: 100 },
      endPoint: { x: 350, y: 200 },
    });

    expect(config.routes?.["start:next:review"]).toMatchObject({
      sSide: "bottom",
      eSide: "top",
    });
    expect(
      pruneProcedureManualRoutes(
        { routes: { ...config.routes, stale: { kind: "trunk", x: 200 } } },
        new Set(["start:next:review"]),
      ),
    ).toEqual(config);
  });

  it("falls back to automatic routing for an invalid manual trunk", () => {
    const model = buildProcedureModel(document);
    const edges = routeProcedureEdges(model, geometry(), {
      routes: {
        "review:no:start": { kind: "trunk", x: Number.NaN },
      },
    });

    expect(edges.find((edge) => edge.id === "review:no:start")?.trunkX).toBe(
      490,
    );
  });

  it("reports a manual trunk outside the measured lane", () => {
    const model = buildProcedureModel(document);
    const edges = routeProcedureEdges(model, geometry(), {
      routes: {
        "start:next:review": { kind: "trunk", x: 900 },
      },
    });

    expect(edges[0]?.routeKind).toBe("fallback");
    expect(edges[0]?.routeDiagnostics).toContainEqual(
      expect.objectContaining({ code: "INVALID_MANUAL_ROUTE" }),
    );
  });

  it("rejects a diagonal manual path and reports the fallback", () => {
    const model = buildProcedureModel(document);
    const edges = routeProcedureEdges(model, geometry(), {
      routes: {
        "start:next:review": {
          kind: "orthogonal",
          bendPoints: [{ x: 300, y: 170 }],
        },
      },
    });

    const edge = edges.find(
      (candidate) => candidate.id === "start:next:review",
    );
    expect(edge?.routeKind).toBe("fallback");
    expect(edge?.routeDiagnostics).toContainEqual(
      expect.objectContaining({ code: "INVALID_MANUAL_ROUTE" }),
    );
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
