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
  const validEdgeIds = new Set(graph.edges.map((edge) => edge.id));
  const routesPruned = pruneProcedureManualRoutes(config, validEdgeIds);

  if (!routesPruned.pagedRoutes) return routesPruned;

  const pagedRoutes = Object.fromEntries(
    Object.entries(routesPruned.pagedRoutes).filter(([edgeId]) =>
      validEdgeIds.has(edgeId),
    ),
  );
  if (
    Object.keys(pagedRoutes).length ===
    Object.keys(routesPruned.pagedRoutes).length
  ) {
    return routesPruned;
  }

  const { pagedRoutes: _removedPagedRoutes, ...rest } = routesPruned;
  return Object.keys(pagedRoutes).length > 0 ? { ...rest, pagedRoutes } : rest;
}

/** Remove all manual routes while preserving non-route diagram preferences. */
export function resetDiagramRoutes(config: SopDiagramConfig): SopDiagramConfig {
  if (!config.routes && !config.pagedRoutes) return config;

  const {
    routes: _removedRoutes,
    pagedRoutes: _removedPagedRoutes,
    ...rest
  } = config;
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
  if (!pagedRoutesEqual(left, right)) return false;

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
    if (
      !leftRoute ||
      !rightRoute ||
      !manualRouteEquals(leftRoute, rightRoute)
    ) {
      return false;
    }
  }

  return true;
}

function pagedRoutesEqual(
  left: SopDiagramConfig,
  right: SopDiagramConfig,
): boolean {
  const leftRoutes = left.pagedRoutes ?? {};
  const rightRoutes = right.pagedRoutes ?? {};
  const leftIds = Object.keys(leftRoutes).sort();
  const rightIds = Object.keys(rightRoutes).sort();

  if (leftIds.length !== rightIds.length) return false;

  for (let index = 0; index < leftIds.length; index += 1) {
    const edgeId = leftIds[index];
    if (!edgeId || edgeId !== rightIds[index]) return false;

    const leftEntry = leftRoutes[edgeId];
    const rightEntry = rightRoutes[edgeId];
    if (!leftEntry || !rightEntry) return false;

    if (!optionalManualRouteEquals(leftEntry.source, rightEntry.source)) {
      return false;
    }
    if (!optionalManualRouteEquals(leftEntry.target, rightEntry.target)) {
      return false;
    }
  }

  return true;
}

function optionalManualRouteEquals(
  left: ProcedureManualRoute | undefined,
  right: ProcedureManualRoute | undefined,
): boolean {
  if (!left || !right) return left === right;
  return manualRouteEquals(left, right);
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
