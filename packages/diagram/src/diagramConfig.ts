import type { DiagramPoint, DiagramSide } from "./types.js";
import {
  pruneProcedureManualRoutes,
  type ProcedureManualRoute,
  type SopDiagramConfig,
} from "./procedure.js";
import type { WorkflowGraph } from "./workflow.js";

/**
 * Remove manual route overrides for edges that no longer exist in the semantic
 * workflow graph. Renderer-only edge ids (for example paginated OPC segments)
 * are intentionally not part of the persisted config contract.
 */
export function pruneSopDiagramConfig(
  graph: WorkflowGraph,
  config: SopDiagramConfig,
): SopDiagramConfig {
  return pruneProcedureManualRoutes(
    config,
    new Set(graph.edges.map((edge) => edge.id)),
  );
}

/** Remove all manual routes while preserving non-route diagram preferences. */
export function resetDiagramRoutes(config: SopDiagramConfig): SopDiagramConfig {
  if (!config.routes) return config;

  const { routes: _removedRoutes, ...rest } = config;
  return rest;
}

/**
 * Semantic config equality. Missing routes and an empty route map are treated
 * as equal, and an omitted layout seed is equivalent to the default seed 0.
 */
export function diagramConfigEquals(
  left: SopDiagramConfig,
  right: SopDiagramConfig,
): boolean {
  if ((left.pathLayoutSeed ?? 0) !== (right.pathLayoutSeed ?? 0)) return false;

  const leftRoutes = left.routes ?? {};
  const rightRoutes = right.routes ?? {};
  const leftIds = Object.keys(leftRoutes).sort();
  const rightIds = Object.keys(rightRoutes).sort();

  if (leftIds.length !== rightIds.length) return false;

  for (let index = 0; index < leftIds.length; index += 1) {
    const leftId = leftIds[index];
    const rightId = rightIds[index];
    if (!leftId || leftId !== rightId) return false;

    const leftRoute = leftRoutes[leftId];
    const rightRoute = rightRoutes[leftId];
    if (!leftRoute || !rightRoute || !manualRouteEquals(leftRoute, rightRoute)) {
      return false;
    }
  }

  return true;
}

function manualRouteEquals(
  left: ProcedureManualRoute,
  right: ProcedureManualRoute,
): boolean {
  if (left.kind !== right.kind) return false;
  if (!pointEquals(left.labelPosition, right.labelPosition)) return false;
  if (!pointEquals(left.startPoint, right.startPoint)) return false;
  if (!pointEquals(left.endPoint, right.endPoint)) return false;
  if (!sideEquals(left.sSide, right.sSide)) return false;
  if (!sideEquals(left.eSide, right.eSide)) return false;

  if (left.kind === "trunk" && right.kind === "trunk") {
    return left.x === right.x;
  }

  if (left.kind === "orthogonal" && right.kind === "orthogonal") {
    if (left.bendPoints.length !== right.bendPoints.length) return false;

    return left.bendPoints.every((point, index) =>
      pointEquals(point, right.bendPoints[index]),
    );
  }

  return false;
}

function pointEquals(
  left: DiagramPoint | undefined,
  right: DiagramPoint | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.x === right.x && left.y === right.y;
}

function sideEquals(
  left: DiagramSide | undefined,
  right: DiagramSide | undefined,
): boolean {
  return left === right;
}
