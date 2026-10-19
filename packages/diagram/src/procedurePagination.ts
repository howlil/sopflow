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
  splitFormalConnectionsByPage,
  splitFormalRowsIntoPages,
  type FormalPagedConnectionSegment,
  type FormalPositionedOpcEndpoint,
} from "./flowchart/formal/pagination.js";
import type { FormalProcedureRowLike } from "./flowchart/formal/planner.js";

export interface FormalProcedurePaginationOptions {
  /** Legacy deterministic row-count pagination. */
  readonly firstPageRows?: number;
  /** Legacy deterministic row-count pagination. */
  readonly nextPageRows?: number;
  /**
   * Enables height-aware pagination when provided. The budget is for the
   * procedure region only; callers that compose a document header should pass
   * the measured reserved height separately.
   */
  readonly pageHeightPx?: number;
  readonly firstPageReservedHeightPx?: number;
  readonly nextPageReservedHeightPx?: number;
  /** Browser-measured height of the repeated procedure table header. */
  readonly tableHeaderHeightPx?: number;
  readonly minimumRowHeightPx?: number;
  readonly lineHeightPx?: number;
  /**
   * Optional browser-measured row heights used to correct the pure estimator.
   * Unknown rows continue to use estimateProcedureRowHeight().
   */
  readonly measuredRowHeights?: Readonly<Record<string, number>>;
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

export function pruneProcedurePagedRoutes(
  pages: readonly FormalProcedurePageModel[],
  config: SopDiagramConfig,
): SopDiagramConfig {
  if (!config.pagedRoutes) return config;

  // Prune only deleted semantic edges. Page breaks can change after a resize,
  // so a temporarily local edge must retain its saved cross-page override.
  const semanticEdgeIds = new Set(
    pages.flatMap((page) => page.edges.map((edge) => edge.semanticEdgeId)),
  );
  const pagedRoutes = Object.fromEntries(
    Object.entries(config.pagedRoutes).filter(([edgeId]) =>
      semanticEdgeIds.has(edgeId),
    ),
  );

  if (
    Object.keys(pagedRoutes).length === Object.keys(config.pagedRoutes).length
  ) {
    return config;
  }

  const { pagedRoutes: _removedPagedRoutes, ...rest } = config;
  return Object.keys(pagedRoutes).length > 0 ? { ...rest, pagedRoutes } : rest;
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
const DEFAULT_MINIMUM_ROW_HEIGHT_PX = 110;
const DEFAULT_LINE_HEIGHT_PX = 12;
const ESTIMATED_TEXT_VERTICAL_PADDING_PX = 8;
const ESTIMATED_ACTIVITY_CHARS_PER_LINE = 42;
const ESTIMATED_MUTU_CHARS_PER_LINE = 24;

export function buildFormalProcedurePages(
  model: ProcedureModel,
  options: FormalProcedurePaginationOptions = {},
): FormalProcedurePageModel[] {
  const paginationRows = model.rows.map((row) => ({
    stepId: row.stepId,
    number: row.number,
    primaryActorId: row.primaryActorId,
  }));
  const procedureRowById = new Map(
    model.rows.map((row) => [row.stepId, row] as const),
  );
  const rowPages = buildProcedureRowPages(model.rows, paginationRows, model.graph.edges, options);

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

  const pageByStepId = new Map<string, number>();
  rowPages.forEach((pageRows, pageIndex) => {
    for (const row of pageRows) {
      pageByStepId.set(row.stepId, pageIndex);
    }
  });
  const connections = splitFormalConnectionsByPage(
    model.graph.edges,
    paginationRows,
    pageByStepId,
    rowPages.length,
  );

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

export function estimateProcedureRowHeight(
  row: ProcedureRowModel,
  options: Pick<
    FormalProcedurePaginationOptions,
    "minimumRowHeightPx" | "lineHeightPx"
  > = {},
): number {
  const minimumRowHeight = positiveNumber(
    options.minimumRowHeightPx,
    DEFAULT_MINIMUM_ROW_HEIGHT_PX,
  );
  const lineHeight = positiveNumber(
    options.lineHeightPx,
    DEFAULT_LINE_HEIGHT_PX,
  );
  const activityLines =
    estimateWrappedLines(row.activity, ESTIMATED_ACTIVITY_CHARS_PER_LINE) +
    (row.kind === "decision" ? 1 : 0);
  const maxTextLines = Math.max(
    activityLines,
    estimateWrappedLines(row.input, ESTIMATED_MUTU_CHARS_PER_LINE),
    estimateWrappedLines(row.output, ESTIMATED_MUTU_CHARS_PER_LINE),
    estimateWrappedLines(row.note, ESTIMATED_MUTU_CHARS_PER_LINE),
    1,
  );

  return Math.ceil(
    Math.max(
      minimumRowHeight,
      maxTextLines * lineHeight + ESTIMATED_TEXT_VERTICAL_PADDING_PX,
    ),
  );
}

function buildProcedureRowPages(
  rows: readonly ProcedureRowModel[],
  paginationRows: readonly {
    readonly stepId: string;
    readonly number: number;
    readonly primaryActorId: string | null;
  }[],
  edges: readonly WorkflowEdge[],
  options: FormalProcedurePaginationOptions,
): Array<readonly { readonly stepId: string }[]> {
  const pageHeightPx = positiveOptionalNumber(options.pageHeightPx);

  if (pageHeightPx !== null) {
    return splitProcedureRowsByMeasuredPageBudget(rows, edges, pageHeightPx, options);
  }

  // Keep explicit row-count pagination as a backwards-compatible API for
  // standalone consumers that have not supplied physical page dimensions.
  const firstPageRows = positiveInteger(
    options.firstPageRows,
    DEFAULT_FIRST_PAGE_ROWS,
  );
  const nextPageRows = positiveInteger(
    options.nextPageRows,
    DEFAULT_NEXT_PAGE_ROWS,
  );

  return splitFormalRowsIntoPages(paginationRows, firstPageRows, nextPageRows);
}

/**
 * Reserve a connector strip only for edges actually crossing the candidate
 * page's row boundaries. This solves the cyclic dependency of OPC height and
 * page breaks without fixed-point oscillation: each candidate page segment is
 * evaluated with its own exact set of external endpoints.
 */
function estimateCandidateOpcHeights(
  rows: readonly ProcedureRowModel[],
  edges: readonly WorkflowEdge[],
  indexByStep: ReadonlyMap<string, number>,
  start: number,
  endExclusive: number,
): { top: number; bottom: number } {
  const top = new Map<string, number>();
  const bottom = new Map<string, number>();
  const increment = (group: Map<string, number>, actor: string | null) => {
    const id = actor ?? "__fallback__";
    group.set(id, (group.get(id) ?? 0) + 1);
  };

  for (const edge of edges) {
    const sourceIndex = indexByStep.get(edge.from);
    const targetIndex = indexByStep.get(edge.to);
    if (sourceIndex === undefined || targetIndex === undefined) continue;
    const sourceInside = sourceIndex >= start && sourceIndex < endExclusive;
    const targetInside = targetIndex >= start && targetIndex < endExclusive;
    if (sourceInside === targetInside) continue;
    if (sourceInside) {
      increment(
        targetIndex < start ? top : bottom,
        rows[sourceIndex]?.primaryActorId ?? null,
      );
    } else {
      increment(
        sourceIndex < start ? top : bottom,
        rows[targetIndex]?.primaryActorId ?? null,
      );
    }
  }

  const stripHeight = (byActor: Map<string, number>) => {
    const maximumStack = Math.max(0, ...byActor.values());
    return maximumStack === 0
      ? 0
      : maximumStack * 60 + (maximumStack - 1) * 8 + 16;
  };
  return { top: stripHeight(top), bottom: stripHeight(bottom) };
}

function splitProcedureRowsByMeasuredPageBudget(
  rows: readonly ProcedureRowModel[],
  edges: readonly WorkflowEdge[],
  pageHeightPx: number,
  options: FormalProcedurePaginationOptions,
): ProcedureRowModel[][] {
  if (rows.length === 0) return [];

  const heights = rows.map((row) =>
    positiveOptionalNumber(options.measuredRowHeights?.[row.stepId]) ??
    estimateProcedureRowHeight(row, options),
  );
  const pageHeader = Math.max(0, options.tableHeaderHeightPx ?? 0);
  const indexByStep = new Map(rows.map((row, index) => [row.stepId, index] as const));
  const pages: ProcedureRowModel[][] = [];
  let start = 0;

  while (start < rows.length) {
    const pageIndex = pages.length;
    const reserved =
      positiveOptionalNumber(
        pageIndex === 0
          ? options.firstPageReservedHeightPx
          : options.nextPageReservedHeightPx,
      ) ?? 0;
    const available = Math.max(1, pageHeightPx - reserved - pageHeader);
    let usedHeight = 0;
    let bestEnd = start + 1; // Oversized rows must remain whole and visible.

    for (let end = start + 1; end <= rows.length; end++) {
      usedHeight += heights[end - 1] ?? 0;
      if (usedHeight > available && end > start + 1) break;
      const opc = estimateCandidateOpcHeights(rows, edges, indexByStep, start, end);
      if (usedHeight + opc.top + opc.bottom <= available) {
        bestEnd = end;
      }
    }

    pages.push(rows.slice(start, bestEnd));
    start = bestEnd;
  }

  return pages;
}

function estimateWrappedLines(
  value: string | undefined,
  charsPerLine: number,
): number {
  if (!value?.trim()) return 0;

  return value
    .split(/\r?\n/)
    .map((line) => Math.max(1, Math.ceil(line.trim().length / charsPerLine)))
    .reduce((total, lines) => total + lines, 0);
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

function positiveNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0
    ? (value as number)
    : fallback;
}

function positiveOptionalNumber(value: number | undefined): number | null {
  return Number.isFinite(value) && (value ?? 0) > 0 ? (value as number) : null;
}
