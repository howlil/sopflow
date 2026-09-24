import type { SOPDocument } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import { buildProcedureModel, type SopDiagramConfig } from "./procedure.js";
import {
  buildFormalProcedurePages,
  estimateProcedureRowHeight,
  pruneProcedurePagedRoutes,
  removeProcedurePageManualRoute,
  resolveProcedurePageRouteOverrides,
  setProcedurePageManualRoute,
} from "./procedurePagination.js";

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

  it("drops paged route overrides when an edge becomes local", () => {
    const model = buildProcedureModel(linearDocument(4));
    const crossPages = buildFormalProcedurePages(model, {
      firstPageRows: 2,
      nextPageRows: 2,
    });
    const crossEdge = crossPages
      .flatMap((page) => page.edges)
      .find((edge) => edge.segment === "source-to-opc");
    if (!crossEdge) throw new Error("cross-page edge not found");

    const configured: SopDiagramConfig = {
      pagedRoutes: {
        [crossEdge.semanticEdgeId]: {
          source: { kind: "trunk", x: 320 },
        },
      },
    };
    expect(pruneProcedurePagedRoutes(crossPages, configured)).toEqual(
      configured,
    );

    const localPages = buildFormalProcedurePages(model, {
      firstPageRows: 4,
      nextPageRows: 4,
    });
    expect(pruneProcedurePagedRoutes(localPages, configured)).toEqual({});
  });

  it("maps cross-page manual routes through semantic edge ids", () => {
    const model = buildProcedureModel(linearDocument(6));
    const pages = buildFormalProcedurePages(model, {
      firstPageRows: 2,
      nextPageRows: 2,
    });
    const edge = pages[0]?.edges.find(
      (candidate) => candidate.segment === "source-to-opc",
    );
    if (!edge) throw new Error("cross-page source segment not found");

    const route = {
      kind: "orthogonal" as const,
      bendPoints: [{ x: 100, y: 120 }],
      sSide: "right" as const,
      eSide: "top" as const,
      startPoint: { x: 80, y: 100 },
      endPoint: { x: 100, y: 160 },
    };
    const configured = setProcedurePageManualRoute({}, edge, route);

    expect(configured).toEqual({
      pagedRoutes: {
        [edge.semanticEdgeId]: {
          source: route,
        },
      },
    });
    expect(resolveProcedurePageRouteOverrides([edge], configured)).toEqual({
      [edge.id]: route,
    });
    expect(removeProcedurePageManualRoute(configured, edge)).toEqual({});
  });

  it("keeps local page routes on the canonical routes map", () => {
    const model = buildProcedureModel(linearDocument(4));
    const page = buildFormalProcedurePages(model, {
      firstPageRows: 4,
      nextPageRows: 4,
    })[0];
    const edge = page?.edges.find((candidate) => candidate.segment === "local");
    if (!edge) throw new Error("local edge not found");

    const config: SopDiagramConfig = setProcedurePageManualRoute({}, edge, {
      kind: "trunk",
      x: 320,
    });

    expect(config).toEqual({
      routes: {
        [edge.semanticEdgeId]: { kind: "trunk", x: 320 },
      },
    });
    expect(resolveProcedurePageRouteOverrides([edge], config)).toEqual({
      [edge.id]: { kind: "trunk", x: 320 },
    });
  });

  it("packs rows by estimated height when a page height budget is provided", () => {
    const baseDocument = linearDocument(5);
    const longNote = "Catatan panjang ".repeat(28);
    const document: SOPDocument = {
      ...baseDocument,
      steps: baseDocument.steps.map((step) =>
        step.id === "step-2" ? { ...step, note: longNote } : step,
      ),
    };
    const model = buildProcedureModel(document);
    const longRow = model.rows.find((row) => row.stepId === "step-2");
    const shortRow = model.rows.find((row) => row.stepId === "step-3");

    if (!longRow || !shortRow) throw new Error("test rows not found");

    expect(
      estimateProcedureRowHeight(longRow, {
        minimumRowHeightPx: 80,
        lineHeightPx: 12,
      }),
    ).toBeGreaterThan(
      estimateProcedureRowHeight(shortRow, {
        minimumRowHeightPx: 80,
        lineHeightPx: 12,
      }),
    );

    const pages = buildFormalProcedurePages(model, {
      pageHeightPx: 210,
      minimumRowHeightPx: 80,
      lineHeightPx: 12,
    });

    expect(pages.map((page) => page.rows.map((row) => row.stepId))).toEqual([
      ["step-1"],
      ["step-2"],
      ["step-3", "step-4"],
      ["step-5"],
    ]);
    expect(pages[0]?.bottomOpc).toHaveLength(1);
    expect(pages[1]?.topOpc).toHaveLength(1);
  });

  it("supports separate first-page and following-page height reserves", () => {
    const model = buildProcedureModel(linearDocument(5));
    const pages = buildFormalProcedurePages(model, {
      pageHeightPx: 260,
      firstPageReservedHeightPx: 140,
      nextPageReservedHeightPx: 20,
      minimumRowHeightPx: 100,
    });

    expect(pages.map((page) => page.rows.length)).toEqual([1, 2, 2]);
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
