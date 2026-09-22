import type { ActorId, StepId } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import type { WorkflowEdge } from "../../workflow.js";
import {
  buildFormalTableColumnPercents,
  getFormalOpcEndpointsForPage,
  getFormalPageForRow,
  layoutFormalOpcEndpoints,
  splitFormalCrossPageConnections,
  splitFormalRowsIntoPages,
  type FormalPageRow,
} from "./pagination.js";

const rows: FormalPageRow[] = [
  row("s1", 1, "staff"),
  row("s2", 2, "staff"),
  row("s3", 3, "manager"),
  row("s4", 4, "manager"),
  row("s5", 5, "staff"),
];

describe("formal flowchart pagination parity", () => {
  it("splits the first page and following pages deterministically", () => {
    expect(
      splitFormalRowsIntoPages(rows, 2, 2).map((page) => page.length),
    ).toEqual([2, 2, 1]);

    expect(getFormalPageForRow(1, 2, 2)).toBe(0);
    expect(getFormalPageForRow(2, 2, 2)).toBe(0);
    expect(getFormalPageForRow(3, 2, 2)).toBe(1);
    expect(getFormalPageForRow(5, 2, 2)).toBe(2);
  });

  it("splits forward cross-page edges into OPC out and in endpoints", () => {
    const edge: WorkflowEdge = {
      id: "s2:next:s4",
      from: "s2",
      to: "s4",
      kind: "next",
    };

    const result = splitFormalCrossPageConnections([edge], rows, 2, 2);

    expect(result.opcPairs).toHaveLength(1);
    expect(result.pages[0]?.[0]).toMatchObject({
      id: "s2:next:s4__out",
      targetType: "flowchart-opc",
      toActorId: "staff",
    });
    expect(result.pages[1]?.[0]).toMatchObject({
      id: "s2:next:s4__in",
      sourceType: "flowchart-opc",
      fromActorId: "manager",
    });

    expect(getFormalOpcEndpointsForPage(0, result.opcPairs)).toMatchObject({
      top: [],
      bottom: [{ variant: "out" }],
    });
    expect(getFormalOpcEndpointsForPage(1, result.opcPairs)).toMatchObject({
      top: [{ variant: "in" }],
      bottom: [],
    });
  });

  it("places loopback OPC endpoints on the opposite page edges", () => {
    const edge: WorkflowEdge = {
      id: "s5:no:s2",
      from: "s5",
      to: "s2",
      kind: "no",
      label: "Tidak",
    };

    const result = splitFormalCrossPageConnections([edge], rows, 2, 2);

    expect(getFormalOpcEndpointsForPage(2, result.opcPairs)).toMatchObject({
      top: [{ variant: "out" }],
      bottom: [],
    });
    expect(getFormalOpcEndpointsForPage(0, result.opcPairs)).toMatchObject({
      top: [],
      bottom: [{ variant: "in" }],
    });
  });

  it("centers OPCs on actor columns and stacks duplicates", () => {
    const edges: WorkflowEdge[] = [
      {
        id: "s2:next:s4",
        from: "s2",
        to: "s4",
        kind: "next",
      },
      {
        id: "s1:next:s5",
        from: "s1",
        to: "s5",
        kind: "next",
      },
    ];
    const result = splitFormalCrossPageConnections(edges, rows, 2, 2);
    const endpoints = getFormalOpcEndpointsForPage(0, result.opcPairs).bottom;
    const placements = layoutFormalOpcEndpoints(endpoints, {
      actors: [{ id: "staff" as ActorId }, { id: "manager" as ActorId }],
      columnBounds: {
        staff: { left: 200, top: 0, right: 300, bottom: 500 },
        manager: { left: 300, top: 0, right: 400, bottom: 500 },
      },
      tableColumns: buildFormalTableColumnPercents(25, 20),
    });

    expect(placements).toHaveLength(2);
    expect(placements[0]?.centerXPx).toBe(250);
    expect(placements[0]?.stackIndex).toBe(0);
    expect(placements[1]?.stackIndex).toBe(1);
  });
});

function row(stepId: StepId, number: number, actorId: ActorId): FormalPageRow {
  return {
    stepId,
    number,
    primaryActorId: actorId,
  };
}
