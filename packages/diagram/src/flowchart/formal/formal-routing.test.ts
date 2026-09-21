import type { StepId } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import type { WorkflowEdge } from "../../workflow.js";
import {
  buildFormalColumnTrunkPath,
  buildFormalCrossColumnPath,
  buildFormalLoopbackPath,
} from "./dedicated.js";
import {
  pickFormalColumnGutterBusX,
  pickFormalColumnPipeX,
  pointOnFormalDecisionVertex,
} from "./geometry.js";
import {
  findFormalRouteCrossingIds,
  sortFormalRoutesForPlanning,
} from "./order.js";
import { planFormalProcedureEdges } from "./planner.js";
import type {
  FormalFlowchartGeometry,
  FormalFlowchartGridLayout,
} from "./types.js";

const staff = { left: 230, top: 80, right: 330, bottom: 540 };
const manager = { left: 330, top: 80, right: 430, bottom: 540 };
const admin = { left: 430, top: 80, right: 530, bottom: 540 };
const pelaksana = { left: 230, top: 80, right: 530, bottom: 540 };

const grid: FormalFlowchartGridLayout = {
  horizontalLines: [80, 160, 240, 340, 420, 500],
  verticalLines: [230, 330, 430, 530],
  rowGutters: [166, 246, 346, 426],
  minGridX: 230,
  maxGridX: 530,
  minGridY: 80,
  maxGridY: 500,
};

describe("formal SOP-AP flowchart routing parity", () => {
  it("uses the same deterministic column channels as sop-ta", () => {
    expect(pickFormalColumnPipeX("left", manager, 0, 18)).toBe(340);
    expect(pickFormalColumnPipeX("left", manager, 1, 18)).toBe(358);
    expect(pickFormalColumnPipeX("right", manager, 0, 10)).toBe(420);
    expect(pickFormalColumnGutterBusX(staff, manager, 0)).toBe(330);
  });

  it("anchors decision connectors on the actual diamond vertices", () => {
    const decision = { left: 347, top: 257, width: 66, height: 66 };

    const top = pointOnFormalDecisionVertex(decision, "top");
    const right = pointOnFormalDecisionVertex(decision, "right");
    const bottom = pointOnFormalDecisionVertex(decision, "bottom");
    const left = pointOnFormalDecisionVertex(decision, "left");

    expect(top.y).toBeLessThan(bottom.y);
    expect(left.x).toBeLessThan(right.x);
    expect(top.x).toBeCloseTo(bottom.x, 0);
    expect(left.y).toBeCloseTo(right.y, 0);
  });

  it("builds same-column trunks, cross-column buses, and loopback corridors", () => {
    const source = { left: 249, top: 170, width: 82, height: 42 };
    const target = { left: 249, top: 370, width: 82, height: 42 };

    const trunk = buildFormalColumnTrunkPath({
      source,
      target,
      sourceDecision: false,
      targetDecision: false,
      column: staff,
      slot: 0,
      sourceJetty: 12,
      targetJetty: 12,
    });
    expect(
      trunk.some(
        (point) =>
          point.x === pickFormalColumnPipeX("left", staff, 0, 10),
      ),
    ).toBe(true);

    const cross = buildFormalCrossColumnPath({
      source,
      target: { left: 347, top: 370, width: 66, height: 66 },
      sourceDecision: false,
      targetDecision: true,
      sourceSide: "bottom",
      targetSide: "top",
      sourceJetty: 12,
      targetJetty: 12,
      columns: { staff, manager, admin },
      pelaksana,
      gridLayout: grid,
      slot: 0,
      fromRow: 1,
      toRow: 3,
    });
    expect(cross).not.toBeNull();
    expect(
      cross?.some(
        (point) =>
          point.x === pickFormalColumnGutterBusX(staff, manager, 0),
      ),
    ).toBe(true);

    const loopback = buildFormalLoopbackPath({
      source: { left: 347, top: 290, width: 66, height: 66 },
      target: { left: 249, top: 170, width: 82, height: 42 },
      sourceDecision: true,
      targetDecision: false,
      side: "left",
      sourceJetty: 16,
      targetJetty: 16,
      corridor: {
        left: staff.left,
        top: staff.top,
        right: manager.right,
        bottom: manager.bottom,
      },
      gridLayout: grid,
      slot: 0,
      fromRow: 2,
      toRow: 1,
    });
    expect(
      loopback.some(
        (point) =>
          point.x ===
          pickFormalColumnPipeX(
            "left",
            {
              left: staff.left,
              top: staff.top,
              right: manager.right,
              bottom: manager.bottom,
            },
            0,
            18,
          ),
      ),
    ).toBe(true);
  });

  it("plans the screenshot-like decision loopback inside PELAKSANA bounds", () => {
    const rows = [
      row("start", 1, "start", "staff"),
      row("submit", 2, "task", "staff"),
      row("decision", 3, "decision", "manager"),
      row("fix", 4, "task", "staff"),
      row("end", 5, "end", "manager"),
    ] as const;
    const edges: WorkflowEdge[] = [
      edge("start:next:submit", "start", "submit", "next"),
      edge("submit:next:decision", "submit", "decision", "next"),
      edge("decision:yes:fix", "decision", "fix", "yes", "Ya"),
      edge("decision:no:submit", "decision", "submit", "no", "Tidak"),
      edge("fix:next:end", "fix", "end", "next"),
    ];
    const geometry: FormalFlowchartGeometry = {
      width: 800,
      height: 560,
      pelaksanaBounds: pelaksana,
      columns: { staff, manager, admin },
      gridLayout: grid,
      shapes: new Map([
        [
          "start",
          shape("start", "staff", 0, "start", {
            left: 237,
            top: 98,
            width: 86,
            height: 42,
          }),
        ],
        [
          "submit",
          shape("submit", "staff", 1, "task", {
            left: 239,
            top: 178,
            width: 82,
            height: 42,
          }),
        ],
        [
          "decision",
          shape("decision", "manager", 2, "decision", {
            left: 347,
            top: 257,
            width: 66,
            height: 66,
          }),
        ],
        [
          "fix",
          shape("fix", "staff", 3, "task", {
            left: 239,
            top: 368,
            width: 82,
            height: 42,
          }),
        ],
        [
          "end",
          shape("end", "manager", 4, "end", {
            left: 337,
            top: 448,
            width: 86,
            height: 42,
          }),
        ],
      ]),
    };

    const planned = planFormalProcedureEdges(
      { rows, edges },
      geometry,
      {},
      { pathLayoutSeed: 0, maxReconcilePasses: 4 },
    );

    expect(planned).toHaveLength(edges.length);

    const no = planned.find((item) => item.id === "decision:no:submit");
    expect(no?.label).toBe("Tidak");
    expect(no?.sourceSide).toBe(no?.targetSide);
    expect(["left", "right"]).toContain(no?.sourceSide);

    for (const routed of planned) {
      for (const point of routed.points) {
        expect(point.x).toBeGreaterThanOrEqual(pelaksana.left - 1);
        expect(point.x).toBeLessThanOrEqual(pelaksana.right + 1);
      }
    }

    const yes = planned.find((item) => item.id === "decision:yes:fix");
    expect(yes?.labelPosition).toBeDefined();
    expect(no?.labelPosition).toBeDefined();
  });

  it("orders long and Tidak routes before simpler connections", () => {
    const ordered = sortFormalRoutesForPlanning([
      meta("near", 0, 1, null),
      meta("long", 0, 4, null),
      meta("yes", 2, 3, "Ya"),
      meta("no", 3, 1, "Tidak"),
    ]);

    expect(ordered[0]?.id).toBe("long");
    expect(ordered.indexOf(ordered.find((item) => item.id === "no")!)).toBeLessThan(
      ordered.indexOf(ordered.find((item) => item.id === "yes")!),
    );
  });

  it("detects connector crossings for reconciliation", () => {
    const violators = findFormalRouteCrossingIds(
      new Map([
        ["horizontal", [{ x1: 100, y1: 200, x2: 300, y2: 200 }]],
        ["vertical", [{ x1: 200, y1: 100, x2: 200, y2: 300 }]],
        ["clear", [{ x1: 400, y1: 100, x2: 400, y2: 300 }]],
      ]),
    );

    expect(violators.sort()).toEqual(["horizontal", "vertical"]);
  });
});

function row(
  stepId: StepId,
  number: number,
  kind: "start" | "task" | "decision" | "end",
  primaryActorId: string | null,
) {
  return { stepId, number, kind, primaryActorId };
}

function edge(
  id: string,
  from: StepId,
  to: StepId,
  kind: "next" | "yes" | "no",
  label?: string,
): WorkflowEdge {
  return { id, from, to, kind, ...(label ? { label } : {}) };
}

function shape(
  stepId: StepId,
  actorId: string | null,
  rowIndex: number,
  kind: "start" | "task" | "decision" | "end",
  rect: { left: number; top: number; width: number; height: number },
) {
  return { stepId, actorId, row: rowIndex, kind, rect };
}

function meta(
  id: string,
  fromRow: number,
  toRow: number,
  label: string | null,
) {
  return {
    id,
    fromRow,
    toRow,
    fromActorId: "staff",
    toActorId: "staff",
    sourceType: "flowchart-process" as const,
    targetType: "flowchart-process" as const,
    ...(label ? { label } : {}),
  };
}
