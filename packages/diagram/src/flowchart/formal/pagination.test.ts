import type { ActorId, StepId } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import type { WorkflowEdge } from "../../workflow.js";
import {
  buildFormalTableColumnPercents,
  formalOpcLabel,
  getFormalOpcEndpointsForPage,
  getFormalPageForRow,
  layoutFormalOpcEndpoints,
  splitFormalConnectionsByPage,
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
  it("keeps OPC labels unique after Z", () => {
    expect(formalOpcLabel(0)).toBe("A");
    expect(formalOpcLabel(25)).toBe("Z");
    expect(formalOpcLabel(26)).toBe("AA");
    expect(formalOpcLabel(27)).toBe("AB");
    expect(formalOpcLabel(51)).toBe("AZ");
    expect(formalOpcLabel(52)).toBe("BA");
  });

  it("splits the first page and following pages deterministically", () => {
    expect(
      splitFormalRowsIntoPages(rows, 2, 2).map((page) => page.length),
    ).toEqual([2, 2, 1]);

    expect(getFormalPageForRow(1, 2, 2)).toBe(0);
    expect(getFormalPageForRow(2, 2, 2)).toBe(0);
    expect(getFormalPageForRow(3, 2, 2)).toBe(1);
    expect(getFormalPageForRow(5, 2, 2)).toBe(2);
  });

  it("marks same-page connections as local semantic edges", () => {
    const edge: WorkflowEdge = {
      id: "s1:next:s2",
      from: "s1",
      to: "s2",
      kind: "next",
    };

    const result = splitFormalCrossPageConnections([edge], rows, 2, 2);

    expect(result.pages[0]?.[0]).toMatchObject({
      id: edge.id,
      semanticEdgeId: edge.id,
      segment: "local",
    });
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
      semanticEdgeId: "s2:next:s4",
      segment: "source-to-opc",
      targetType: "flowchart-opc",
      toActorId: "staff",
    });
    expect(result.pages[1]?.[0]).toMatchObject({
      id: "s2:next:s4__in",
      semanticEdgeId: "s2:next:s4",
      segment: "opc-to-target",
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

  it("keeps OPC endpoint ids unique when decision branches share a target", () => {
    const branchRows: FormalPageRow[] = [
      row("decision", 1, "staff"),
      row("filler", 2, "staff"),
      row("target", 3, "manager"),
    ];
    const edges: WorkflowEdge[] = [
      {
        id: "decision:yes:target",
        from: "decision",
        to: "target",
        kind: "yes",
        label: "Ya",
      },
      {
        id: "decision:no:target",
        from: "decision",
        to: "target",
        kind: "no",
        label: "Tidak",
      },
    ];

    const result = splitFormalCrossPageConnections(edges, branchRows, 2, 2);
    const endpointIds = result.opcPairs.flatMap((pair) => [
      pair.opcOutId,
      pair.opcInId,
    ]);

    expect(result.opcPairs).toHaveLength(2);
    expect(new Set(endpointIds).size).toBe(endpointIds.length);
    expect(endpointIds).toEqual([
      "opc-out-decision:yes:target",
      "opc-in-decision:yes:target",
      "opc-out-decision:no:target",
      "opc-in-decision:no:target",
    ]);
  });

  it("routes OPCs from explicit page assignment instead of row-count math", () => {
    const edge: WorkflowEdge = {
      id: "s2:next:s5",
      from: "s2",
      to: "s5",
      kind: "next",
    };
    const pageByStepId = new Map<StepId, number>([
      ["s1", 0],
      ["s2", 0],
      ["s3", 1],
      ["s4", 1],
      ["s5", 2],
    ]);

    const result = splitFormalConnectionsByPage([edge], rows, pageByStepId, 3);

    expect(result.pages[0]?.[0]).toMatchObject({
      id: "s2:next:s5__out",
      segment: "source-to-opc",
    });
    expect(result.pages[2]?.[0]).toMatchObject({
      id: "s2:next:s5__in",
      segment: "opc-to-target",
    });
    expect(result.pages[1]).toEqual([]);
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
  it("anchors one connector pair to distinct source and target actor columns", () => {
    const actorRows: FormalPageRow[] = [
      row("admin-step", 1, "admin"),
      row("student-step", 2, "student"),
    ];
    const edge: WorkflowEdge = {
      id: "admin-step:next:student-step",
      from: "admin-step",
      to: "student-step",
      kind: "next",
    };
    const result = splitFormalCrossPageConnections([edge], actorRows, 1, 1);
    const actors = [{ id: "admin" }, { id: "student" }];
    const columnBounds = {
      admin: { left: 200, top: 0, right: 300, bottom: 400 },
      student: { left: 300, top: 0, right: 420, bottom: 400 },
    };
    const options = {
      actors,
      columnBounds,
      tableColumns: buildFormalTableColumnPercents(25, 20),
    };
    const out = layoutFormalOpcEndpoints(
      getFormalOpcEndpointsForPage(0, result.opcPairs).bottom, options,
    );
    const incoming = layoutFormalOpcEndpoints(
      getFormalOpcEndpointsForPage(1, result.opcPairs).top, options,
    );
    expect(out).toMatchObject([{ actorId: "admin", centerXPx: 250 }]);
    expect(incoming).toMatchObject([{ actorId: "student", centerXPx: 360 }]);
    expect(out[0]?.opc.letter).toBe(incoming[0]?.opc.letter);
  });

  it("never silently assigns unknown OPC actor to the first actor column", () => {
    const actorRows: FormalPageRow[] = [row("first", 1, "missing"), row("second", 2, "student")];
    const edge: WorkflowEdge = { id: "first:next:second", from: "first", to: "second", kind: "next" };
    const result = splitFormalCrossPageConnections([edge], actorRows, 1, 1);
    const out = layoutFormalOpcEndpoints(
      getFormalOpcEndpointsForPage(0, result.opcPairs).bottom,
      { actors: [{ id: "admin" }, { id: "student" }], tableColumns: buildFormalTableColumnPercents(25, 20) },
    );
    expect(out).toEqual([]);
  });

});

function row(stepId: StepId, number: number, actorId: ActorId): FormalPageRow {
  return {
    stepId,
    number,
    primaryActorId: actorId,
  };
}
