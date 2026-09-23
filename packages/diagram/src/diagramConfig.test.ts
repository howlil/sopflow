import type { SOPDocument } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import {
  diagramConfigEquals,
  pruneSopDiagramConfig,
  resetDiagramRoutes,
} from "./diagramConfig.js";
import { projectWorkflow } from "./workflow.js";
import type { SopDiagramConfig } from "./procedure.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "diagram-config",
  title: "Diagram config",
  actors: [],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Start",
      actorIds: [],
      next: "end",
    },
    {
      id: "end",
      type: "end",
      name: "End",
      actorIds: [],
    },
  ],
};

describe("diagram config", () => {
  it("prunes route overrides that are no longer semantic workflow edges", () => {
    const graph = projectWorkflow(document);
    const config: SopDiagramConfig = {
      pathLayoutSeed: 3,
      routes: {
        "start:next:end": { kind: "trunk", x: 320 },
        "start:next:end__out": { kind: "trunk", x: 400 },
        stale: { kind: "trunk", x: 500 },
      },
      pagedRoutes: {
        "start:next:end": {
          source: { kind: "trunk", x: 360 },
        },
        stale: {
          target: { kind: "trunk", x: 520 },
        },
      },
    };

    expect(pruneSopDiagramConfig(graph, config)).toEqual({
      pathLayoutSeed: 3,
      routes: {
        "start:next:end": { kind: "trunk", x: 320 },
      },
      pagedRoutes: {
        "start:next:end": {
          source: { kind: "trunk", x: 360 },
        },
      },
    });
  });

  it("resets routes while preserving the layout seed", () => {
    expect(
      resetDiagramRoutes({
        pathLayoutSeed: 7,
        routes: {
          "start:next:end": { kind: "trunk", x: 320 },
        },
        pagedRoutes: {
          "start:next:end": {
            source: { kind: "trunk", x: 360 },
          },
        },
      }),
    ).toEqual({ pathLayoutSeed: 7 });
  });

  it("compares configs by semantic route content instead of object order", () => {
    const first: SopDiagramConfig = {
      routes: {
        "start:next:end": {
          kind: "orthogonal",
          sSide: "right",
          eSide: "left",
          startPoint: { x: 10, y: 20 },
          endPoint: { x: 90, y: 20 },
          bendPoints: [
            { x: 40, y: 20 },
            { x: 40, y: 60 },
          ],
        },
        second: { kind: "trunk", x: 500 },
      },
    };
    const second: SopDiagramConfig = {
      pathLayoutSeed: 0,
      routes: {
        second: { kind: "trunk", x: 500 },
        "start:next:end": {
          kind: "orthogonal",
          sSide: "right",
          eSide: "left",
          startPoint: { x: 10, y: 20 },
          endPoint: { x: 90, y: 20 },
          bendPoints: [
            { x: 40, y: 20 },
            { x: 40, y: 60 },
          ],
        },
      },
    };

    expect(diagramConfigEquals(first, second)).toBe(true);
    expect(
      diagramConfigEquals(
        {
          ...first,
          pagedRoutes: {
            "start:next:end": {
              source: { kind: "trunk", x: 360 },
            },
          },
        },
        {
          ...second,
          pagedRoutes: {
            "start:next:end": {
              source: { kind: "trunk", x: 360 },
            },
          },
        },
      ),
    ).toBe(true);
    expect(diagramConfigEquals({}, { routes: {} })).toBe(true);
    expect(
      diagramConfigEquals(first, {
        ...second,
        routes: {
          ...second.routes,
          second: { kind: "trunk", x: 501 },
        },
      }),
    ).toBe(false);
  });
});
