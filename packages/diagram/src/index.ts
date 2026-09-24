export {
  classifyFormalFlowchartRouteComplexity,
  formalRowSpan,
  isSimpleSequentialFormalFlow,
} from "./flowchart/formal/complexity.js";
export type {
  FormalFlowchartRouteComplexity,
  FormalRouteComplexityInput,
} from "./flowchart/formal/complexity.js";

export { placeFormalEdgeLabel } from "./flowchart/formal/labels.js";
export type { FormalEdgeLabelPlacementInput } from "./flowchart/formal/labels.js";

export {
  buildFormalTableColumnPercents,
  computeFormalActorColumnCenterPercent,
  formalOpcCenterXToLeftPx,
  formalOpcLabel,
  formalOpcStackTopPx,
  getFormalOpcEndpointsForPage,
  getFormalPageForRow,
  layoutFormalOpcEndpoints,
  splitFormalConnectionsByPage,
  splitFormalCrossPageConnections,
  splitFormalRowsIntoPages,
} from "./flowchart/formal/pagination.js";
export type {
  FormalOpcEndpointVariant,
  FormalOpcPair,
  FormalOpcPlacement,
  FormalPageConnections,
  FormalPagedConnection,
  FormalPagedConnectionSegment,
  FormalPageRow,
  FormalPositionedOpcEndpoint,
  FormalTableColumnPercents,
} from "./flowchart/formal/pagination.js";

export {
  distanceOnFormalShapeSide,
  dragFormalRouteSegmentFromOrigin,
  dragFormalRouteWaypointFromOrigin,
  findNearestFormalRouteSegmentIndex,
  formalRouteChangeFromPath,
  insertFormalRouteWaypointAtSegmentMidpoint,
  pointOnFormalShapeSide,
  rebuildFormalPathForEndpoint,
  repairFormalManualRoute,
  removeFormalRouteWaypoint,
  resolveNearestFormalShapeSide,
  snapFormalEndpoint,
  validateFormalManualRoute,
  type FormalManualRouteValidation,
  type FormalRouteChange,
  type FormalRouteEndpoint,
} from "./flowchart/formal/edit.js";

export { formalPathToSegments } from "./flowchart/formal/orthogonal.js";

export { planFormalProcedureEdges } from "./flowchart/formal/planner.js";
export type {
  FormalFlowchartBounds,
  FormalFlowchartColumnBounds,
  FormalFlowchartGeometry,
  FormalFlowchartGridLayout,
  FormalFlowchartOccupiedSegment,
  FormalFlowchartRect,
  FormalFlowchartShapeGeometry,
  FormalFlowchartSide,
} from "./flowchart/formal/types.js";

export {
  diagramConfigEquals,
  diagramConfigsEqual,
  pruneSopDiagramConfig,
  pruneSopDiagramConfigs,
  resetDiagramRoutes,
} from "./diagramConfig.js";

export type { SopDiagramConfigs } from "./diagramConfig.js";

export { buildBpmnModel } from "./bpmn.js";
export type {
  BpmnLane,
  BpmnLayoutOptions,
  BpmnModel,
  BpmnNode,
  BpmnRoutedEdge,
} from "./bpmn.js";

export {
  buildProcedureModel,
  removeProcedureManualRoute,
  routeProcedureEdges,
  setProcedureManualRoute,
  updateProcedureManualTrunk,
} from "./procedure.js";
export type {
  ProcedureActorColumn,
  ProcedureGeometry,
  ProcedureLaneGeometry,
  ProcedureManualRoute,
  ProcedureManualRoutes,
  ProcedureManualTrunks,
  ProcedurePagedRouteOverride,
  ProcedurePagedRouteOverrides,
  ProcedureNodeGeometry,
  ProcedureModel,
  ProcedureRoutingOverrides,
  SopDiagramConfig,
  ProcedureRoutedEdge,
  ProcedureRowModel,
} from "./procedure.js";

export { buildWorkflowEdgeId, projectWorkflow } from "./workflow.js";
export type {
  WorkflowConnection,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
} from "./workflow.js";

export { buildDiagramModel } from "./buildDiagramModel.js";
export { buildDiagram } from "./buildDiagram.js";
export type { BuildDiagramOptions } from "./buildDiagram.js";

export { buildSopFlowchart } from "./flowchart/buildSopFlowchart.js";
export type { BuildSopFlowchartOptions } from "./flowchart/buildSopFlowchart.js";
export type {
  SopFlowchartEdge,
  SopFlowchartLane,
  SopFlowchartModel,
  SopFlowchartNode,
  SopFlowchartNodePlacement,
} from "./flowchart/types.js";

export { layoutDiagram } from "./layout.js";
export type { DiagramLayoutOptions } from "./layout.js";

export { routeDiagramEdges } from "./routeEdges.js";
export type { EdgeRoutingOptions } from "./routeEdges.js";

export { buildSvgRenderModel } from "./svg/buildSvgRenderModel.js";
export { getDiamondPoints } from "./svg/getDiamondPoints.js";
export { pointsToPath } from "./svg/pointsToPath.js";
export type {
  SvgEdgeModel,
  SvgNodeModel,
  SvgRenderModel,
} from "./svg/types.js";

export type {
  DiagramEdge,
  DiagramEdgeKind,
  DiagramDiagnostic,
  DiagramModel,
  DiagramNode,
  DiagramNodeKind,
  DiagramPoint,
  DiagramRoutedEdge,
  DiagramRouteKind,
  DiagramRouteQuality,
  DiagramSide,
  DiagramSize,
  DiagramTextLayout,
} from "./types.js";

export type { DiagramRect, RouteSegment } from "./routeGeometry.js";

export {
  buildFormalProcedurePages,
  estimateProcedureRowHeight,
  pruneProcedurePagedRoutes,
  removeProcedurePageManualRoute,
  resolveProcedurePageRouteOverrides,
  setProcedurePageManualRoute,
  type FormalProcedurePageEdge,
  type FormalProcedurePageModel,
  type FormalProcedurePaginationOptions,
} from "./procedurePagination.js";
