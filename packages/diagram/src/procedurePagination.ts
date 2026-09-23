import type { WorkflowEdge } from "./workflow.js";
import type { ProcedureModel, ProcedureRowModel } from "./procedure.js";
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
