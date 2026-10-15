import type { ProcedureManualRoute, SopDiagramConfig } from "./types.js";

export function setProcedureManualRoute(
  config: SopDiagramConfig,
  edgeId: string,
  route: ProcedureManualRoute,
): SopDiagramConfig {
  return {
    ...config,
    routes: {
      ...config.routes,
      [edgeId]:
        route.kind === "trunk"
          ? {
              kind: "trunk",
              x: route.x,
              ...(route.labelPosition
                ? { labelPosition: { ...route.labelPosition } }
                : {}),
              ...(route.sSide ? { sSide: route.sSide } : {}),
              ...(route.eSide ? { eSide: route.eSide } : {}),
              ...(route.sourceDistance !== undefined
                ? { sourceDistance: route.sourceDistance }
                : {}),
              ...(route.targetDistance !== undefined
                ? { targetDistance: route.targetDistance }
                : {}),
              ...(route.startPoint
                ? { startPoint: { ...route.startPoint } }
                : {}),
              ...(route.endPoint ? { endPoint: { ...route.endPoint } } : {}),
            }
          : {
              kind: "orthogonal",
              bendPoints: route.bendPoints.map((point) => ({ ...point })),
              ...(route.labelPosition
                ? { labelPosition: { ...route.labelPosition } }
                : {}),
              ...(route.sSide ? { sSide: route.sSide } : {}),
              ...(route.eSide ? { eSide: route.eSide } : {}),
              ...(route.sourceDistance !== undefined
                ? { sourceDistance: route.sourceDistance }
                : {}),
              ...(route.targetDistance !== undefined
                ? { targetDistance: route.targetDistance }
                : {}),
              ...(route.startPoint
                ? { startPoint: { ...route.startPoint } }
                : {}),
              ...(route.endPoint ? { endPoint: { ...route.endPoint } } : {}),
            },
    },
  };
}

export function pruneProcedureManualRoutes(
  config: SopDiagramConfig,
  validEdgeIds: ReadonlySet<string>,
): SopDiagramConfig {
  if (!config.routes) return config;

  const routes = Object.fromEntries(
    Object.entries(config.routes).filter(([edgeId]) =>
      validEdgeIds.has(edgeId),
    ),
  );
  if (Object.keys(routes).length === Object.keys(config.routes).length) {
    return config;
  }

  const { routes: _removedRoutes, ...rest } = config;
  return Object.keys(routes).length > 0 ? { ...rest, routes } : rest;
}

export function removeProcedureManualRoute(
  config: SopDiagramConfig,
  edgeId: string,
): SopDiagramConfig {
  if (!config.routes?.[edgeId]) return config;

  const routes = { ...config.routes };
  delete routes[edgeId];

  const { routes: _removedRoutes, ...rest } = config;

  return Object.keys(routes).length > 0 ? { ...rest, routes } : rest;
}

