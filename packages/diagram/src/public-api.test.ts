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
        "buildBpmnModel",
        "buildFormalEdgeAnchorId",
        "buildFormalVisualConnectorAnchors",
        "buildDiagram",
        "buildDiagramModel",
        "buildProcedureModel",
        "buildSopFlowchart",
        "buildSvgRenderModel",
        "dragFormalRouteSegmentFromOrigin",
        "dragFormalRouteWaypointFromOrigin",
        "findNearestFormalAnchor",
        "findNearestFormalRouteSegmentIndex",
        "finalizeFormalManualOrthogonalPath",
        "formalChannelAnchorDistance",
        "formalDistanceOnShapeEdge",
        "formalPathCrossesShapeBodies",
        "formalPointOnShapeEdge",
        "formalSideLengthPx",
        "formalSnapDistanceToCenter",
        "getDiamondPoints",
        "getFormalAutoRouteAnchorSlot",
        "insertFormalRouteWaypointAtSegmentMidpoint",
        "layoutDiagram",
        "parseFormalLockedSideFromAnchorId",
        "pickFormalDiamondSideFromPointer",
        "pickFormalSnapSideForPointer",
        "planFormalProcedureEdges",
        "preferFormalCenterAnchorDistance",
        "projectPointerToFormalShapeEdge",
        "pointsToPath",
        "removeFormalRouteWaypoint",
        "rebuildFormalPathForAnchorSides",
        "removeProcedureManualRoute",
        "repairFormalPathAroundShapes",
        "resolveFormalAnchorSnap",
        "resolveFormalConstrainedEdgeSnap",
        "resolveFormalMagneticAnchorSnap",
        "resolveFormalPreferredEndpointSnap",
        "routeDiagramEdges",
        "routeProcedureEdges",
        "scoreFormalAnchorOffCenter",
        "setProcedureManualEndpoint",
        "setProcedureManualRoute",
        "updateProcedureManualTrunk",
        "isFormalPathBlockingShapes",
        "projectWorkflow",
      ].sort(),
    );
  });

  it("keeps the consumer build contract compileable", () => {
    const diagram: SvgRenderModel = buildDiagram(document);

    expect(diagram.nodes).toHaveLength(2);
    expect(diagram.edges).toHaveLength(1);
  });
});
