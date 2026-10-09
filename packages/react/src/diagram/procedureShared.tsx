import type { StepId } from "@sopflow/core";
import styles from "./SopProcedureView.module.css";
import type {
  FormalFlowchartBounds,
  FormalFlowchartColumnBounds,
  FormalFlowchartGridLayout,
  FormalFlowchartRect,
  ProcedureModel,
  ProcedureRowModel,
} from "@sopflow/diagram";

export function ProcedureShape({ kind }: { kind: ProcedureRowModel["kind"] }) {
  if (kind === "decision") {
    return (
      <svg
        width={66}
        height={66}
        viewBox="-2 -2 64 64"
        className={styles.flowShape}
        data-kind={kind}
        aria-hidden="true"
      >
        <polygon points="30,1 59,30 30,59 1,30" />
      </svg>
    );
  }

  if (kind === "start" || kind === "end") {
    return (
      <svg
        width={86}
        height={42}
        viewBox="-2 -2 82 42"
        className={styles.flowShape}
        data-kind={kind}
        aria-hidden="true"
      >
        <rect width={76} height={36} x={0.8} y={0.8} rx={19.2} ry={19.2} />
      </svg>
    );
  }

  return (
    <svg
      width={82}
      height={42}
      viewBox="0 -2 82 42"
      className={styles.flowShape}
      data-kind={kind}
      aria-hidden="true"
    >
      <rect width={76} height={36} x={1} y={1} />
    </svg>
  );
}

export function toLocalRect(
  rect: DOMRect,
  rootRect: DOMRect,
): FormalFlowchartRect {
  return {
    left: Math.round(rect.left - rootRect.left),
    top: Math.round(rect.top - rootRect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

export function measurePelaksanaBounds(
  cells: readonly HTMLElement[],
  rootRect: DOMRect,
): FormalFlowchartBounds | null {
  if (cells.length === 0) return null;

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  for (const cell of cells) {
    const rect = cell.getBoundingClientRect();
    left = Math.min(left, rect.left - rootRect.left);
    top = Math.min(top, rect.top - rootRect.top);
    right = Math.max(right, rect.right - rootRect.left);
    bottom = Math.max(bottom, rect.bottom - rootRect.top);
  }

  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;

  return {
    left: Math.max(0, Math.round(left + 8)),
    top: Math.max(0, Math.round(top + 4)),
    right: Math.round(right - 8),
    bottom: Math.round(bottom + 8),
  };
}

export function measureActorColumns(
  cells: readonly HTMLElement[],
  rootRect: DOMRect,
): FormalFlowchartColumnBounds {
  const raw = new Map<
    string,
    { left: number; top: number; right: number; bottom: number }
  >();

  for (const cell of cells) {
    const actorId = cell.dataset.sopflowActorId;
    if (!actorId || actorId === "fallback") continue;

    const rect = cell.getBoundingClientRect();
    const next = {
      left: rect.left - rootRect.left,
      top: rect.top - rootRect.top,
      right: rect.right - rootRect.left,
      bottom: rect.bottom - rootRect.top,
    };
    const previous = raw.get(actorId);

    raw.set(
      actorId,
      previous
        ? {
            left: Math.min(previous.left, next.left),
            top: Math.min(previous.top, next.top),
            right: Math.max(previous.right, next.right),
            bottom: Math.max(previous.bottom, next.bottom),
          }
        : next,
    );
  }

  return Object.fromEntries(
    [...raw.entries()].map(([actorId, bounds]) => [
      actorId,
      {
        left: Math.max(0, Math.round(bounds.left + 6)),
        top: Math.max(0, Math.round(bounds.top + 4)),
        right: Math.round(bounds.right - 6),
        bottom: Math.round(bounds.bottom - 8),
      },
    ]),
  );
}

export function measureGridLayout(
  root: HTMLElement,
  rootRect: DOMRect,
): FormalFlowchartGridLayout | null {
  const rows = Array.from(
    root.querySelectorAll<HTMLElement>("[data-sopflow-procedure-step-id]"),
  );
  const rowBounds: Array<{ top: number; bottom: number }> = [];
  const horizontalLines: number[] = [];
  const verticalLines: number[] = [];

  for (const row of rows) {
    const cells = Array.from(
      row.querySelectorAll<HTMLElement>("[data-sopflow-actor-cell]"),
    );
    if (cells.length === 0) continue;

    const rects = cells.map((cell) => cell.getBoundingClientRect());
    const top = Math.min(...rects.map((rect) => rect.top - rootRect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom - rootRect.top));

    rowBounds.push({ top, bottom });
    horizontalLines.push(top, bottom);

    for (const rect of rects) {
      verticalLines.push(rect.left - rootRect.left, rect.right - rootRect.left);
    }
  }

  if (rowBounds.length === 0) return null;

  const rowGutters: number[] = [];
  for (let index = 0; index < rowBounds.length - 1; index += 1) {
    const above = rowBounds[index];
    const below = rowBounds[index + 1];
    if (!above || !below) continue;

    const gap = below.top - above.bottom;
    const middle = (above.bottom + below.top) / 2;
    const inset = Math.min(16, Math.max(6, Math.floor(gap / 3)));

    rowGutters.push(
      Math.round(
        Math.max(above.bottom + inset, Math.min(below.top - inset, middle)),
      ),
    );
  }

  const horizontal = uniqueRounded(horizontalLines);
  const vertical = uniqueRounded(verticalLines);

  return {
    horizontalLines: horizontal,
    verticalLines: vertical,
    rowGutters,
    minGridX: vertical[0] ?? 0,
    maxGridX: vertical.at(-1) ?? rootRect.width,
    minGridY: horizontal[0] ?? 0,
    maxGridY: horizontal.at(-1) ?? rootRect.height,
  };
}

export function uniqueRounded(values: readonly number[]): number[] {
  return [...new Set(values.map((value) => Math.round(value)))].sort(
    (a, b) => a - b,
  );
}

export function display(value: string | undefined): string {
  return value?.trim() || "—";
}

export function durationLabel(row: ProcedureRowModel): string {
  if (!row.duration) return "—";

  const unitLabels = {
    minute: "menit",
    hour: "jam",
    day: "hari",
    week: "minggu",
    month: "bulan",
    year: "tahun",
  } as const;

  return `${row.duration.value} ${unitLabels[row.duration.unit]}`;
}

export function decisionSummary(stepId: StepId, model: ProcedureModel): string {
  const orderById = new Map(
    model.rows.map((row) => [row.stepId, row.number] as const),
  );
  const branches = model.graph.edges.filter((edge) => edge.from === stepId);
  const yes = branches.find((edge) => edge.kind === "yes");
  const no = branches.find((edge) => edge.kind === "no");

  return `Ya → ${yes ? (orderById.get(yes.to) ?? "?") : "?"} · Tidak → ${no ? (orderById.get(no.to) ?? "?") : "?"}`;
}
