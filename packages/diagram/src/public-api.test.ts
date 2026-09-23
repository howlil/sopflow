import type { SOPDocument } from "@sopflow/core";
import { describe, expect, it } from "vitest";

import * as publicApi from "./index.js";
import { buildDiagram, type SvgRenderModel } from "./index.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "public-api",
  title: "Public API",
  actors: [],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: [],
      next: "end",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: [],
    },
  ],
};

describe("diagram public API", () => {
  it("keeps implementation helpers out of the runtime surface", () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      [
        "buildFormalProcedurePages",
        "buildFormalTableColumnPercents",
        "classifyFormalFlowchartRouteComplexity",
        "computeFormalActorColumnCenterPercent",
        "diagramConfigEquals",
        "estimateProcedureRowHeight",
        "formalOpcCenterXToLeftPx",
        "formalOpcStackTopPx",
        "formalRowSpan",
        "getFormalOpcEndpointsForPage",
        "getFormalPageForRow",
        "isSimpleSequentialFormalFlow",
        "layoutFormalOpcEndpoints",
        "placeFormalEdgeLabel",
        "splitFormalConnectionsByPage",
        "splitFormalCrossPageConnections",
        "splitFormalRowsIntoPages",
        "buildBpmnModel",
        "buildDiagram",
        "buildDiagramModel",
        "buildProcedureModel",
        "buildSopFlowchart",
        "buildSvgRenderModel",
        "buildWorkflowEdgeId",
        "distanceOnFormalShapeSide",
        "dragFormalRouteSegmentFromOrigin",
        "dragFormalRouteWaypointFromOrigin",
        "findNearestFormalRouteSegmentIndex",
        "getDiamondPoints",
        "formalRouteChangeFromPath",
        "insertFormalRouteWaypointAtSegmentMidpoint",
        "layoutDiagram",
        "planFormalProcedureEdges",
        "pointsToPath",
        "pointOnFormalShapeSide",
        "rebuildFormalPathForEndpoint",
        "removeFormalRouteWaypoint",
        "removeProcedureManualRoute",
        "removeProcedurePageManualRoute",
        "resolveNearestFormalShapeSide",
        "resolveProcedurePageRouteOverrides",
        "routeDiagramEdges",
        "routeProcedureEdges",
        "snapFormalEndpoint",
        "setProcedureManualRoute",
        "setProcedurePageManualRoute",
        "validateFormalManualRoute",
        "updateProcedureManualTrunk",
        "projectWorkflow",
        "pruneSopDiagramConfig",
        "resetDiagramRoutes",
      ].sort(),
    );
  });

  it("keeps the consumer build contract compileable", () => {
    const diagram: SvgRenderModel = buildDiagram(document);

    expect(diagram.nodes).toHaveLength(2);
    expect(diagram.edges).toHaveLength(1);
  });
});
