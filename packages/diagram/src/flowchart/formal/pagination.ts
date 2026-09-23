import type { ActorId, StepId } from "@sopflow/core";
import type { WorkflowEdge } from "../../workflow.js";
import type { FormalFlowchartColumnBounds } from "./types.js";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface FormalPageRow {
  readonly stepId: StepId;
  readonly number: number;
  readonly primaryActorId: ActorId | null;
}

export interface FormalPagedConnection {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: WorkflowEdge["kind"];
  readonly label?: string;
  readonly sourceType?:
    | "flowchart-terminator"
    | "flowchart-process"
    | "flowchart-decision"
    | "flowchart-opc";
  readonly targetType?:
    | "flowchart-terminator"
    | "flowchart-process"
    | "flowchart-decision"
    | "flowchart-opc";
  readonly fromActorId?: ActorId | null;
  readonly toActorId?: ActorId | null;
}

export interface FormalOpcPair {
  readonly letter: string;
  readonly fromStepId: StepId;
  readonly toStepId: StepId;
  readonly fromRowNumber: number;
  readonly toRowNumber: number;
  readonly fromPage: number;
  readonly toPage: number;
  readonly fromActorId: ActorId | null;
  readonly toActorId: ActorId | null;
  readonly originalEdge: WorkflowEdge;
  readonly opcOutId: string;
  readonly opcInId: string;
}

export type FormalOpcEndpointVariant = "in" | "out";

export interface FormalPositionedOpcEndpoint {
  readonly opc: FormalOpcPair;
  readonly variant: FormalOpcEndpointVariant;
}

export interface FormalPageConnections {
  readonly pages: readonly (readonly FormalPagedConnection[])[];
  readonly opcPairs: readonly FormalOpcPair[];
}

export interface FormalTableColumnPercents {
  readonly noColPercent: number;
  readonly kegiatanPercent: number;
  readonly pelaksanaColPercent: number;
}

export interface FormalOpcPlacement {
  readonly opc: FormalOpcPair;
  readonly elementId: string;
  readonly actorId: ActorId | null;
  readonly centerXPx: number | null;
  readonly centerPercent: number;
  readonly stackIndex: number;
}

export const FORMAL_OPC_CONNECTOR_WIDTH_PX = 50;
export const FORMAL_OPC_CONNECTOR_HEIGHT_PX = 60;
export const FORMAL_OPC_CONNECTOR_STACK_GAP_PX = 8;

export function splitFormalRowsIntoPages(
  rows: readonly FormalPageRow[],
  firstPageRows: number,
  nextPageRows: number,
): FormalPageRow[][] {
  if (rows.length === 0) return [];

  const first = positiveInteger(firstPageRows, 1);
  const next = positiveInteger(nextPageRows, first);
  const pages: FormalPageRow[][] = [rows.slice(0, first)];

  for (let index = first; index < rows.length; index += next) {
    pages.push(rows.slice(index, index + next));
  }

  return pages;
}

export function getFormalPageForRow(
  rowNumber: number,
  firstPageRows: number,
  nextPageRows: number,
): number {
  const first = positiveInteger(firstPageRows, 1);
  const next = positiveInteger(nextPageRows, first);

  if (rowNumber <= first) return 0;
  return Math.ceil((rowNumber - first) / next);
}

export function splitFormalCrossPageConnections(
  edges: readonly WorkflowEdge[],
  rows: readonly FormalPageRow[],
  firstPageRows: number,
  nextPageRows: number,
  opcIdPrefix = "",
): FormalPageConnections {
  const totalPages = splitFormalRowsIntoPages(
    rows,
    firstPageRows,
    nextPageRows,
  ).length;
  const pages: FormalPagedConnection[][] = Array.from(
    { length: totalPages },
    () => [],
  );
  const opcPairs: FormalOpcPair[] = [];
  const rowById = new Map(rows.map((row) => [row.stepId, row] as const));

  for (const edge of edges) {
    const source = rowById.get(edge.from);
    const target = rowById.get(edge.to);
    if (!source || !target || totalPages === 0) continue;

    const fromPage = getFormalPageForRow(
      source.number,
      firstPageRows,
      nextPageRows,
    );
    const toPage = getFormalPageForRow(
      target.number,
      firstPageRows,
      nextPageRows,
    );

    if (fromPage === toPage) {
      pages[fromPage]?.push(toPagedConnection(edge, source, target));
      continue;
    }

    const letter = LETTERS[opcPairs.length % LETTERS.length] ?? "A";
    const opcOutId = buildFormalOpcId(edge.id, "out", opcIdPrefix);
    const opcInId = buildFormalOpcId(edge.id, "in", opcIdPrefix);

    pages[fromPage]?.push({
      ...toPagedConnection(edge, source, target),
      id: `${edge.id}__out`,
      to: opcOutId,
      targetType: "flowchart-opc",
      toActorId: source.primaryActorId,
    });

    pages[toPage]?.push({
      ...toPagedConnection(edge, source, target),
      id: `${edge.id}__in`,
      from: opcInId,
      sourceType: "flowchart-opc",
      fromActorId: target.primaryActorId,
    });

    opcPairs.push({
      letter,
      fromStepId: edge.from,
      toStepId: edge.to,
      fromRowNumber: source.number,
      toRowNumber: target.number,
      fromPage,
      toPage,
      fromActorId: source.primaryActorId,
      toActorId: target.primaryActorId,
      originalEdge: edge,
      opcOutId,
      opcInId,
    });
  }

  return { pages, opcPairs };
}

export function getFormalOpcEndpointsForPage(
  pageIndex: number,
  opcPairs: readonly FormalOpcPair[],
): {
  readonly top: FormalPositionedOpcEndpoint[];
  readonly bottom: FormalPositionedOpcEndpoint[];
} {
  const top: FormalPositionedOpcEndpoint[] = [];
  const bottom: FormalPositionedOpcEndpoint[] = [];

  for (const opc of opcPairs) {
    const forward = opc.fromPage < opc.toPage;
    const loopback = opc.fromPage > opc.toPage;

    if (opc.fromPage === pageIndex) {
      if (forward) bottom.push({ opc, variant: "out" });
      if (loopback) top.push({ opc, variant: "out" });
    }

    if (opc.toPage === pageIndex) {
      if (forward) top.push({ opc, variant: "in" });
      if (loopback) bottom.push({ opc, variant: "in" });
    }
  }

  const byRow = (
    a: FormalPositionedOpcEndpoint,
    b: FormalPositionedOpcEndpoint,
  ) =>
    a.opc.fromRowNumber !== b.opc.fromRowNumber
      ? a.opc.fromRowNumber - b.opc.fromRowNumber
      : a.opc.toRowNumber - b.opc.toRowNumber;

  top.sort(byRow);
  bottom.sort(byRow);

  return { top, bottom };
}

export function buildFormalTableColumnPercents(
  kegiatanPercent: number,
  pelaksanaColPercent: number,
): FormalTableColumnPercents {
  return {
    noColPercent: 5,
    kegiatanPercent,
    pelaksanaColPercent,
  };
}

export function computeFormalActorColumnCenterPercent(
  actorIndex: number,
  columns: FormalTableColumnPercents,
): number {
  return (
    columns.noColPercent +
    columns.kegiatanPercent +
    columns.pelaksanaColPercent * (actorIndex + 0.5)
  );
}

export function layoutFormalOpcEndpoints(
  endpoints: readonly FormalPositionedOpcEndpoint[],
  options: {
    readonly actors: readonly { readonly id: ActorId }[];
    readonly columnBounds?: FormalFlowchartColumnBounds | null;
    readonly tableColumns: FormalTableColumnPercents;
  },
): FormalOpcPlacement[] {
  const byColumn = new Map<string, FormalPositionedOpcEndpoint[]>();

  for (const endpoint of endpoints) {
    const actorId =
      endpoint.variant === "in"
        ? endpoint.opc.toActorId
        : endpoint.opc.fromActorId;
    const key = actorId ?? "__default__";
    const list = byColumn.get(key) ?? [];
    list.push(endpoint);
    byColumn.set(key, list);
  }

  const placements: FormalOpcPlacement[] = [];

  for (const [columnKey, group] of byColumn) {
    const actorId = columnKey === "__default__" ? null : (columnKey as ActorId);
    const actorIndex = resolveActorIndex(actorId, options.actors);
    const centerPercent = computeFormalActorColumnCenterPercent(
      actorIndex,
      options.tableColumns,
    );
    const bounds = actorId ? options.columnBounds?.[actorId] : undefined;
    const centerXPx =
      bounds && bounds.right > bounds.left
        ? (bounds.left + bounds.right) / 2
        : null;

    group
      .slice()
      .sort((a, b) =>
        a.opc.fromRowNumber !== b.opc.fromRowNumber
          ? a.opc.fromRowNumber - b.opc.fromRowNumber
          : a.opc.toRowNumber - b.opc.toRowNumber,
      )
      .forEach((endpoint, stackIndex) => {
        placements.push({
          opc: endpoint.opc,
          elementId:
            endpoint.variant === "in"
              ? endpoint.opc.opcInId
              : endpoint.opc.opcOutId,
          actorId,
          centerXPx,
          centerPercent,
          stackIndex,
        });
      });
  }

  placements.sort((a, b) => {
    const aPosition = a.centerXPx ?? a.centerPercent;
    const bPosition = b.centerXPx ?? b.centerPercent;

    return aPosition !== bPosition
      ? aPosition - bPosition
      : a.stackIndex - b.stackIndex;
  });

  return placements;
}

export function formalOpcCenterXToLeftPx(
  centerX: number,
  connectorWidth = FORMAL_OPC_CONNECTOR_WIDTH_PX,
): number {
  return centerX - connectorWidth / 2;
}

export function formalOpcStackTopPx(stackIndex: number): number {
  return (
    stackIndex *
    (FORMAL_OPC_CONNECTOR_HEIGHT_PX + FORMAL_OPC_CONNECTOR_STACK_GAP_PX)
  );
}

function buildFormalOpcId(
  edgeId: string,
  variant: FormalOpcEndpointVariant,
  prefix: string,
): string {
  return `${prefix}opc-${variant}-${edgeId}`;
}

function toPagedConnection(
  edge: WorkflowEdge,
  source: FormalPageRow,
  target: FormalPageRow,
): FormalPagedConnection {
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    ...(edge.label ? { label: edge.label } : {}),
    fromActorId: source.primaryActorId,
    toActorId: target.primaryActorId,
  };
}

function resolveActorIndex(
  actorId: ActorId | null,
  actors: readonly { readonly id: ActorId }[],
): number {
  if (!actorId) return 0;

  const index = actors.findIndex((actor) => actor.id === actorId);
  return index >= 0 ? index : 0;
}

function positiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0
    ? Math.max(1, Math.floor(value))
    : fallback;
}
