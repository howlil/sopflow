import type { StepId } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import { routeFlowchartConnections } from "./routeFlowchart.js";
import { selectSidePairs } from "./selectSidePairs.js";
import type {
  FlowchartRouteConnection,
  FlowchartRoutingGeometry,
} from "./types.js";

function connection(
  overrides: Partial<FlowchartRouteConnection> = {},
): FlowchartRouteConnection {
  return {
    id: "c1",
    from: "source" as StepId,
    to: "target" as StepId,
    kind: "next",
    sourceType: "flowchart-process",
    targetType: "flowchart-process",
    fromActorId: "staff",
    toActorId: "staff",
    fromRow: 0,
    toRow: 1,
    ...overrides,
  };
}

function elem(
  left: number,
  top: number,
  width: number,
  height: number,
) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

describe("sop-ta flowchart side selection", () => {
  it("prefers bottom-to-top for same-column flow below", () => {
    const candidates = selectSidePairs(
      connection(),
      elem(100, 100, 82, 42),
      elem(100, 240, 82, 42),
      {},
      undefined,
      "target",
      "c1",
    );

    expect(candidates[0]).toMatchObject({
      sSide: "bottom",
      eSide: "top",
      preferSimple: true,
    });
  });

  it("uses a lateral exit for Tidak below and for upward loopback", () => {
    const below = selectSidePairs(
      connection({
        sourceType: "flowchart-decision",
        label: "Tidak",
        kind: "no",
      }),
      elem(100, 100, 66, 66),
      elem(100, 260, 82, 42),
      {},
      undefined,
      "target",
      "c1",
    );
    const loopback = selectSidePairs(
      connection({
        sourceType: "flowchart-decision",
        label: "Tidak",
        kind: "no",
        fromActorId: "manager",
        toActorId: "staff",
        fromRow: 3,
        toRow: 1,
      }),
      elem(300, 300, 66, 66),
      elem(100, 100, 82, 42),
      {},
      undefined,
      "target",
      "c1",
    );

    expect(below[0]).toMatchObject({
      sSide: "right",
      eSide: "top",
    });
    expect(loopback[0]).toMatchObject({
      sSide: "left",
      eSide: "left",
    });
  });

  it("keeps Ya below on the bottom tail", () => {
    const candidates = selectSidePairs(
      connection({
        sourceType: "flowchart-decision",
        label: "Ya",
        kind: "yes",
      }),
      elem(100, 100, 66, 66),
      elem(100, 260, 82, 42),
      {},
      undefined,
      "target",
      "c1",
    );

    expect(candidates[0]).toMatchObject({
      sSide: "bottom",
      eSide: "top",
    });
  });
});

describe("routeFlowchartConnections", () => {
  it("routes the SOP-AP matrix with exact decision semantics and arbitrary ids", () => {
    const connections: FlowchartRouteConnection[] = [
      connection({
        id: "start:next:submit",
        from: "begin" as StepId,
        to: "submit-form" as StepId,
        sourceType: "flowchart-terminator",
        fromRow: 0,
        toRow: 1,
      }),
      connection({
        id: "submit:next:decision",
        from: "submit-form" as StepId,
        to: "is-valid" as StepId,
        toActorId: "manager",
        targetType: "flowchart-decision",
        fromRow: 1,
        toRow: 2,
      }),
      connection({
        id: "decision:yes:end",
        from: "is-valid" as StepId,
        to: "finish" as StepId,
        kind: "yes",
        label: "Ya",
        sourceType: "flowchart-decision",
        targetType: "flowchart-terminator",
        fromActorId: "manager",
        toActorId: "manager",
        fromRow: 2,
        toRow: 4,
      }),
      connection({
        id: "decision:no:submit",
        from: "is-valid" as StepId,
        to: "submit-form" as StepId,
        kind: "no",
        label: "Tidak",
        sourceType: "flowchart-decision",
        fromActorId: "manager",
        toActorId: "staff",
        fromRow: 2,
        toRow: 1,
      }),
    ];

    const geometry: FlowchartRoutingGeometry = {
      width: 760,
      height: 560,
      pelaksanaBounds: {
        left: 220,
        top: 50,
        right: 430,
        bottom: 530,
      },
      columns: new Map([
        ["staff", { left: 226, top: 54, right: 290, bottom: 522 }],
        ["manager", { left: 296, top: 54, right: 360, bottom: 522 }],
        ["admin", { left: 366, top: 54, right: 424, bottom: 522 }],
      ]),
      grid: {
        horizontalLines: [60, 140, 220, 320, 400, 500],
        verticalLines: [220, 290, 360, 430],
        rowGutters: [180, 270, 360, 450],
        minGridX: 220,
        maxGridX: 430,
        minGridY: 60,
        maxGridY: 500,
      },
      shapes: new Map([
        [
          "begin" as StepId,
          {
            stepId: "begin" as StepId,
            row: 0,
            kind: "start",
            actorId: "staff",
            rect: { left: 230, top: 78, width: 86, height: 42 },
          },
        ],
        [
          "submit-form" as StepId,
          {
            stepId: "submit-form" as StepId,
            row: 1,
            kind: "task",
            actorId: "staff",
            rect: { left: 232, top: 158, width: 82, height: 42 },
          },
        ],
        [
          "is-valid" as StepId,
          {
            stepId: "is-valid" as StepId,
            row: 2,
            kind: "decision",
            actorId: "manager",
            rect: { left: 297, top: 237, width: 66, height: 66 },
          },
        ],
        [
          "finish" as StepId,
          {
            stepId: "finish" as StepId,
            row: 4,
            kind: "end",
            actorId: "manager",
            rect: { left: 287, top: 458, width: 86, height: 42 },
          },
        ],
      ]),
    };

    const routed = routeFlowchartConnections(connections, geometry);
    const start = routed.find((edge) => edge.id === "start:next:submit");
    const yes = routed.find((edge) => edge.id === "decision:yes:end");
    const no = routed.find((edge) => edge.id === "decision:no:submit");

    expect(start).toMatchObject({
      sourceSide: "bottom",
      targetSide: "top",
    });
    expect(yes?.sourceSide).toBe("bottom");
    expect(no).toMatchObject({
      sourceSide: "left",
      targetSide: "left",
    });
    expect(no?.points.length).toBeGreaterThanOrEqual(4);

    for (const edge of routed) {
      for (let index = 0; index < edge.points.length - 1; index += 1) {
        const a = edge.points[index];
        const b = edge.points[index + 1];
        expect(a?.x === b?.x || a?.y === b?.y).toBe(true);
      }

      expect(
        edge.points.every(
          (point) => point.x >= 244 && point.x <= 394,
        ),
      ).toBe(true);
    }
  });
});
