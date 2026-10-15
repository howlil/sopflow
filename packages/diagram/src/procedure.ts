/** Compatibility module; canonical ownership is under procedure/ and config/. */
export { buildProcedureModel } from "./procedure/model.js";
export type {
  ProcedureActorColumn, ProcedureRowModel, ProcedureModel,
  ProcedureNodeGeometry, ProcedureLaneGeometry, ProcedureGeometry,
} from "./procedure/model.js";
export {
  routeProcedureEdges, updateProcedureManualTrunk,
} from "./procedure/routing.js";
export type { ProcedureRoutedEdge } from "./procedure/routing.js";
export {
  setProcedureManualRoute, pruneProcedureManualRoutes,
  removeProcedureManualRoute,
} from "./config/manualRoutes.js";
export type {
  ProcedureManualRoute, ProcedureManualRoutes,
  ProcedurePagedRouteOverride, ProcedurePagedRouteOverrides,
  ProcedureManualTrunks, ProcedureRoutingOverrides, SopDiagramConfig,
} from "./config/types.js";
