import type { SOPDocument } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import { buildProcedureModel } from "./procedure.js";
import { buildFormalProcedurePages } from "./procedurePagination.js";

describe("buildFormalProcedurePages", () => {
  it("splits a long procedure and replaces cross-page edges with OPC endpoints", () => {
    const document = linearDocument(10);
    const model = buildProcedureModel(document);
    const pages = buildFormalProcedurePages(model, {
      firstPageRows: 4,
      nextPageRows: 4,
    });

    expect(pages.map((page) => page.rows.length)).toEqual([4, 4, 2]);
    expect(pages[0]?.bottomOpc).toHaveLength(1);
    expect(pages[1]?.topOpc).toHaveLength(1);

    const outgoing = pages[0]?.edges.find((edge) => edge.id.endsWith("__out"));
    const incoming = pages[1]?.edges.find((edge) => edge.id.endsWith("__in"));

    expect(outgoing).toMatchObject({
      semanticEdgeId: "step-4:next:step-5",
      segment: "source-to-opc",
    });
    expect(incoming).toMatchObject({
      semanticEdgeId: "step-4:next:step-5",
      segment: "opc-to-target",
    });
    expect(outgoing?.from).toBe("step-4");
    expect(outgoing?.to).toBe("opc-out-step-4:next:step-5");
    expect(incoming?.from).toBe("opc-in-step-4:next:step-5");
    expect(incoming?.to).toBe("step-5");

    expect(pages[0]?.routingRows.some((row) => row.kind === "opc")).toBe(true);
    expect(pages[1]?.routingRows.some((row) => row.kind === "opc")).toBe(true);
  });

  it("uses page-local row numbers for routing while preserving displayed numbers", () => {
    const model = buildProcedureModel(linearDocument(9));
    const pages = buildFormalProcedurePages(model, {
      firstPageRows: 3,
      nextPageRows: 3,
    });

    expect(pages[1]?.rows.map((row) => row.number)).toEqual([4, 5, 6]);
    expect(
      pages[1]?.routingRows
        .filter((row) => row.kind !== "opc")
        .map((row) => row.number),
    ).toEqual([1, 2, 3]);
  });
});

function linearDocument(stepCount: number): SOPDocument {
  const steps: SOPDocument["steps"] = Array.from(
    { length: stepCount },
    (_, index) => {
      const number = index + 1;
      const id = `step-${number}`;
      const next = `step-${number + 1}`;

      if (number === 1) {
        return {
          id,
          type: "start" as const,
          name: `Step ${number}`,
          actorIds: ["staff"],
          next,
        };
      }

      if (number === stepCount) {
        return {
          id,
          type: "end" as const,
          name: `Step ${number}`,
          actorIds: ["staff"],
        };
      }

      return {
        id,
        type: "task" as const,
        name: `Step ${number}`,
        actorIds: ["staff"],
        next,
      };
    },
  );

  return {
    schemaVersion: "1",
    id: "long-procedure",
    title: "Long procedure",
    actors: [{ id: "staff", name: "Staff" }],
    steps,
  };
}
