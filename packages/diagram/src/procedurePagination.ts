import type { WorkflowEdge } from "./workflow.js";
import {
  removeProcedureManualRoute,
  setProcedureManualRoute,
  type ProcedureManualRoute,
  type ProcedureManualRoutes,
  type ProcedureModel,
  type ProcedureRowModel,
  type SopDiagramConfig,
} from "./procedure.js";
import {
  getFormalOpcEndpointsForPage,
  splitFormalCrossPageConnections,
  splitFormalRowsIntoPages,
  type FormalPagedConnectionSegment,
  type FormalPositionedOpcEndpoint,
} from "./flowchart/formal/pagination.js";
import type { FormalProcedureRowLike } from "./flowchart/formal/planner.js";

export interface FormalProcedurePaginationOptions {
  readonly firstPageRows?: number;
  readonly nextPageRows?: number;
}

export interface FormalProcedurePageEdge extends WorkflowEdge {
  /** Canonical workflow edge identity independent of pagination. */
  readonly semanticEdgeId: string;
  readonly segment: FormalPagedConnectionSegment;
}

export interface FormalProcedurePageModel {
  readonly pageIndex: number;
  readonly rows: readonly ProcedureRowModel[];
  readonly routingRows: readonly FormalProcedureRowLike[];
  readonly edges: readonly FormalProcedurePageEdge[];
  readonly topOpc: readonly FormalPositionedOpcEndpoint[];
  readonly bottomOpc: readonly FormalPositionedOpcEndpoint[];
}

export function resolveProcedurePageRouteOverrides(
  edges: readonly FormalProcedurePageEdge[],
  config: SopDiagramConfig,
): ProcedureManualRoutes {
  const routes: Record<string, ProcedureManualRoute> = {};

  for (const edge of edges) {
    const route =
      edge.segment === "local"
        ? config.routes?.[edge.semanticEdgeId]
        : edge.segment === "source-to-opc"
          ? config.pagedRoutes?.[edge.semanticEdgeId]?.source
          : config.pagedRoutes?.[edge.semanticEdgeId]?.target;

    if (route) routes[edge.id] = route;
  }

  return routes;
}

export function setProcedurePageManualRoute(
  config: SopDiagramConfig,
  edge: FormalProcedurePageEdge,
  route: ProcedureManualRoute,
): SopDiagramConfig {
  if (edge.segment === "local") {
    return setProcedureManualRoute(config, edge.semanticEdgeId, route);
  }

  const current = config.pagedRoutes?.[edge.semanticEdgeId] ?? {};
  const segmentKey = edge.segment === "source-to-opc" ? "source" : "target";

  return {
    ...config,
    pagedRoutes: {
      ...config.pagedRoutes,
      [edge.semanticEdgeId]: {
        ...current,
        [segmentKey]: cloneManualRoute(route),
      },
    },
  };
}

export function removeProcedurePageManualRoute(
  config: SopDiagramConfig,
  edge: FormalProcedurePageEdge,
): SopDiagramConfig {
  if (edge.segment === "local") {
    return removeProcedureManualRoute(config, edge.semanticEdgeId);
  }

  const current = config.pagedRoutes?.[edge.semanticEdgeId];
  if (!current) return config;

  const nextEntry = { ...current };
  if (edge.segment === "source-to-opc") delete nextEntry.source;
  else delete nextEntry.target;

  const pagedRoutes = { ...config.pagedRoutes };
  if (nextEntry.source || nextEntry.target) {
    pagedRoutes[edge.semanticEdgeId] = nextEntry;
  } else {
    delete pagedRoutes[edge.semanticEdgeId];
  }

  const { pagedRoutes: _removedPagedRoutes, ...rest } = config;
  return Object.keys(pagedRoutes).length > 0 ? { ...rest, pagedRoutes } : rest;
}

function cloneManualRoute(route: ProcedureManualRoute): ProcedureManualRoute {
  if (route.kind === "trunk") {
    return {
      ...route,
      ...(route.labelPosition
        ? { labelPosition: { ...route.labelPosition } }
        : {}),
      ...(route.startPoint ? { startPoint: { ...route.startPoint } } : {}),
      ...(route.endPoint ? { endPoint: { ...route.endPoint } } : {}),
    };
  }

  return {
    ...route,
    bendPoints: route.bendPoints.map((point) => ({ ...point })),
    ...(route.labelPosition
      ? { labelPosition: { ...route.labelPosition } }
      : {}),
    ...(route.startPoint ? { startPoint: { ...route.startPoint } } : {}),
    ...(route.endPoint ? { endPoint: { ...route.endPoint } } : {}),
  };
}

const DEFAULT_FIRST_PAGE_ROWS = 7;
const DEFAULT_NEXT_PAGE_ROWS = 8;

export function buildFormalProcedurePages(
  model: ProcedureModel,
  options: FormalProcedurePaginationOptions = {},
): FormalProcedurePageModel[] {
  const firstPageRows = positiveInteger(
    options.firstPageRows,
    DEFAULT_FIRST_PAGE_ROWS,
  );
  const nextPageRows = positiveInteger(
    options.nextPageRows,
    DEFAULT_NEXT_PAGE_ROWS,
  );
  const paginationRows = model.rows.map((row) => ({
    stepId: row.stepId,
    number: row.number,
    primaryActorId: row.primaryActorId,
  }));
  const rowPages = splitFormalRowsIntoPages(
    paginationRows,
    firstPageRows,
    nextPageRows,
  );
  const connections = splitFormalCrossPageConnections(
    model.graph.edges,
    paginationRows,
    firstPageRows,
    nextPageRows,
  );
  const procedureRowById = new Map(
    model.rows.map((row) => [row.stepId, row] as const),
  );

  if (rowPages.length === 0) {
    return [
      {
        pageIndex: 0,
        rows: [],
        routingRows: [],
        edges: [],
        topOpc: [],
        bottomOpc: [],
      },
    ];
  }

  return rowPages.map((pageRows, pageIndex) => {
    const rows = pageRows.flatMap((row) => {
      const procedureRow = procedureRowById.get(row.stepId);
      return procedureRow ? [procedureRow] : [];
    });
    const opc = getFormalOpcEndpointsForPage(pageIndex, connections.opcPairs);
    const routingRows: FormalProcedureRowLike[] = [
      ...opc.top.map((endpoint) => opcRoutingRow(endpoint, 0)),
      ...rows.map((row, index) => ({
        stepId: row.stepId,
        number: index + 1,
        kind: row.kind,
        primaryActorId: row.primaryActorId,
      })),
      ...opc.bottom.map((endpoint) => opcRoutingRow(endpoint, rows.length + 1)),
    ];
    const edges = (
      connections.pages[pageIndex] ?? []
    ).map<FormalProcedurePageEdge>((edge) => ({
      id: edge.id,
      semanticEdgeId: edge.semanticEdgeId,
      segment: edge.segment,
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      ...(edge.label ? { label: edge.label } : {}),
    }));

    return {
      pageIndex,
      rows,
      routingRows,
      edges,
      topOpc: opc.top,
      bottomOpc: opc.bottom,
    };
  });
}

function opcRoutingRow(
  endpoint: FormalPositionedOpcEndpoint,
  number: number,
): FormalProcedureRowLike {
  const stepId =
    endpoint.variant === "in" ? endpoint.opc.opcInId : endpoint.opc.opcOutId;
  const primaryActorId =
    endpoint.variant === "in"
      ? endpoint.opc.toActorId
      : endpoint.opc.fromActorId;

  return {
    stepId,
    number,
    kind: "opc",
    primaryActorId,
  };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0
    ? Math.floor(value as number)
    : fallback;
}
