import type { SOPDocument } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import { buildBpmnModel } from "./bpmn.js";
import { pruneSopDiagramConfig } from "./diagramConfig.js";
import { buildSopFlowchart } from "./flowchart/buildSopFlowchart.js";
import { buildFormalProcedurePages } from "./procedurePagination.js";
import { buildProcedureModel, type SopDiagramConfig } from "./procedure.js";
import { projectWorkflow } from "./workflow.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "system-contract",
  title: "System contract",
  actors: [
    { id: "staff", name: "Staff" },
    { id: "manager", name: "Manager" },
  ],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Start",
      actorIds: ["staff"],
      next: "review",
    },
    {
      id: "review",
      type: "task",
      name: "Review",
      actorIds: ["manager"],
      next: "archive",
    },
    {
      id: "archive",
      type: "task",
      name: "Archive",
      actorIds: ["manager"],
      next: "end",
    },
    {
      id: "end",
      type: "end",
      name: "End",
      actorIds: ["manager"],
    },
  ],
};

describe("diagram system contract", () => {
  it("keeps semantic workflow edge ids across every diagram projection", () => {
    const graph = projectWorkflow(document);
    const semanticIds = graph.edges.map((edge) => edge.id);

    expect(
      buildProcedureModel(document).graph.edges.map((edge) => edge.id),
    ).toEqual(semanticIds);
    expect(buildSopFlowchart(document).edges.map((edge) => edge.id)).toEqual(
      semanticIds,
    );
    expect(buildBpmnModel(document).edges.map((edge) => edge.id)).toEqual(
      semanticIds,
    );
  });

  it("keeps paginated OPC ids renderer-local and prunes them from persisted config", () => {
    const model = buildProcedureModel(document);
    const pages = buildFormalProcedurePages(model, {
      firstPageRows: 2,
      nextPageRows: 2,
    });
    const semanticEdgeId = "review:next:archive";
    const splitIds = pages.flatMap((page) =>
      page.edges
        .map((edge) => edge.id)
        .filter((edgeId) => edgeId.startsWith(semanticEdgeId)),
    );

    expect(pages).toHaveLength(2);
    expect(splitIds).toEqual([
      `${semanticEdgeId}__out`,
      `${semanticEdgeId}__in`,
    ]);

    const config: SopDiagramConfig = {
      routes: {
        [semanticEdgeId]: { kind: "trunk", x: 320 },
        [`${semanticEdgeId}__out`]: { kind: "trunk", x: 400 },
        stale: { kind: "trunk", x: 500 },
      },
    };

    expect(pruneSopDiagramConfig(model.graph, config)).toEqual({
      routes: {
        [semanticEdgeId]: { kind: "trunk", x: 320 },
      },
    });
  });
});
