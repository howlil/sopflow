import type { SOPDocument, StepId, ValidationIssue } from "@sopflow/core";
import {
  buildProcedureModel,
  pointsToPath,
  routeProcedureEdges,
  updateProcedureManualTrunk,
  type FlowchartBounds,
  type FlowchartGridLayout,
  type FlowchartShapeGeometry,
  type ProcedureGeometry,
  type ProcedureManualTrunks,
  type SopDiagramConfig,
  type ProcedureModel,
  type ProcedureRowModel,
} from "@sopflow/diagram";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import styles from "./SopProcedureView.module.css";

export type SopManualPathOffsets = ProcedureManualTrunks;

export interface SopProcedureViewProps {
  document: SOPDocument;
  selectedStepId?: StepId | null;
  onSelectedStepChange?: (stepId: StepId | null) => void;
  issues?: readonly ValidationIssue[];
  manualEditing?: boolean;
  diagramConfig?: SopDiagramConfig;
  onDiagramConfigChange?: (config: SopDiagramConfig) => void;
  /** @deprecated Use diagramConfig. */
  manualPathOffsets?: SopManualPathOffsets;
  /** @deprecated Use onDiagramConfigChange. */
  onManualPathOffsetsChange?: (offsets: SopManualPathOffsets) => void;
  className?: string;
}

export function SopProcedureView({
  document,
  selectedStepId = null,
  onSelectedStepChange,
  issues = [],
  manualEditing = false,
  diagramConfig: controlledDiagramConfig,
  onDiagramConfigChange,
  manualPathOffsets,
  onManualPathOffsetsChange,
  className,
}: SopProcedureViewProps) {
  const rootRef = useRef<HTMLElement>(null);
  const shapeRefs = useRef(new Map<StepId, HTMLSpanElement>());
  const [geometry, setGeometry] = useState<ProcedureGeometry | null>(null);
  const [internalOffsets, setInternalOffsets] = useState<SopManualPathOffsets>(
    {},
  );
  const [internalDiagramConfig, setInternalDiagramConfig] =
    useState<SopDiagramConfig>({});
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const draggingConnectionId = useRef<string | null>(null);

  const model = useMemo(() => buildProcedureModel(document), [document]);
  const pathOffsets = manualPathOffsets ?? internalOffsets;
  const usesLegacyManualPaths =
    controlledDiagramConfig === undefined &&
    (manualPathOffsets !== undefined ||
      onManualPathOffsetsChange !== undefined);
  const diagramConfig = controlledDiagramConfig ?? internalDiagramConfig;
  const routeOverrides = usesLegacyManualPaths ? pathOffsets : diagramConfig;
  const routedEdges = useMemo(
    () =>
      geometry ? routeProcedureEdges(model, geometry, routeOverrides) : [],
    [geometry, model, routeOverrides],
  );

  const updatePathOffsets = useCallback(
    (next: SopManualPathOffsets) => {
      if (manualPathOffsets === undefined) {
        setInternalOffsets(next);
      }
      onManualPathOffsetsChange?.(next);
    },
    [manualPathOffsets, onManualPathOffsetsChange],
  );

  const updateDiagramConfig = useCallback(
    (next: SopDiagramConfig) => {
      if (controlledDiagramConfig === undefined) {
        setInternalDiagramConfig(next);
      }
      onDiagramConfigChange?.(next);
    },
    [controlledDiagramConfig, onDiagramConfigChange],
  );

  const actorWidth = 24 / model.actorColumns.length;
  const totalColumns = model.actorColumns.length + 6;

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const rootRect = root.getBoundingClientRect();
    const rowById = new Map(
      model.rows.map((row, index) => [row.stepId, { row, index }] as const),
    );
    const anchors = new Map<StepId, { x: number; y: number }>();
    const shapes = new Map<StepId, FlowchartShapeGeometry>();

    for (const [stepId, element] of shapeRefs.current) {
      const rect = element.getBoundingClientRect();
      const left = rect.left - rootRect.left;
      const top = rect.top - rootRect.top;
      const rowEntry = rowById.get(stepId);
      if (!rowEntry) continue;

      anchors.set(stepId, {
        x: left + rect.width / 2,
        y: top + rect.height / 2,
      });
      shapes.set(stepId, {
        stepId,
        row: rowEntry.index,
        kind: rowEntry.row.kind,
        actorId: rowEntry.row.primaryActorId,
        rect: {
          left,
          top,
          width: rect.width,
          height: rect.height,
        },
      });
    }

    const actorCells = Array.from(
      root.querySelectorAll<HTMLElement>("[data-sopflow-actor-cell]"),
    );
    const rawColumns = new Map<string, FlowchartBounds>();
    let actorLeft = Number.POSITIVE_INFINITY;
    let actorRight = Number.NEGATIVE_INFINITY;
    let actorTop = Number.POSITIVE_INFINITY;
    let actorBottom = Number.NEGATIVE_INFINITY;
    const rowBounds = new Map<
      HTMLElement,
      { top: number; bottom: number; left: number; right: number }
    >();

    for (const cell of actorCells) {
      const rect = cell.getBoundingClientRect();
      const left = rect.left - rootRect.left;
      const right = rect.right - rootRect.left;
      const top = rect.top - rootRect.top;
      const bottom = rect.bottom - rootRect.top;
      actorLeft = Math.min(actorLeft, left);
      actorRight = Math.max(actorRight, right);
      actorTop = Math.min(actorTop, top);
      actorBottom = Math.max(actorBottom, bottom);

      const actorId = cell.dataset.sopflowActorId;
      if (actorId) {
        const previous = rawColumns.get(actorId);
        rawColumns.set(
          actorId,
          previous
            ? {
                left: Math.min(previous.left, left),
                top: Math.min(previous.top, top),
                right: Math.max(previous.right, right),
                bottom: Math.max(previous.bottom, bottom),
              }
            : { left, top, right, bottom },
        );
      }

      const tableRow = cell.closest("tr");
      if (tableRow instanceof HTMLElement) {
        const previous = rowBounds.get(tableRow);
        rowBounds.set(
          tableRow,
          previous
            ? {
                left: Math.min(previous.left, left),
                top: Math.min(previous.top, top),
                right: Math.max(previous.right, right),
                bottom: Math.max(previous.bottom, bottom),
              }
            : { left, top, right, bottom },
        );
      }
    }

    const fallbackLeft = 0;
    const fallbackRight = rootRect.width;
    const fallbackTop = 0;
    const fallbackBottom = rootRect.height;
    const resolvedLeft = Number.isFinite(actorLeft) ? actorLeft : fallbackLeft;
    const resolvedRight = Number.isFinite(actorRight)
      ? actorRight
      : fallbackRight;
    const resolvedTop = Number.isFinite(actorTop) ? actorTop : fallbackTop;
    const resolvedBottom = Number.isFinite(actorBottom)
      ? actorBottom
      : fallbackBottom;
    const columns = new Map<string, FlowchartBounds>();

    for (const [actorId, bounds] of rawColumns) {
      columns.set(actorId, {
        left: Math.max(0, bounds.left + 6),
        top: Math.max(0, bounds.top + 4),
        right: bounds.right - 6,
        bottom: bounds.bottom - 8,
      });
    }

    const sortedRows = [...rowBounds.values()].sort(
      (left, right) => left.top - right.top,
    );
    const horizontalLines = [
      ...new Set(
        sortedRows.flatMap((row) => [
          Math.round(row.top),
          Math.round(row.bottom),
        ]),
      ),
    ].sort((left, right) => left - right);
    const verticalLines = [
      ...new Set(
        [...rawColumns.values()].flatMap((column) => [
          Math.round(column.left),
          Math.round(column.right),
        ]),
      ),
    ].sort((left, right) => left - right);
    const rowGutters = sortedRows.slice(0, -1).map((row, index) => {
      const next = sortedRows[index + 1];
      return Math.round((row.bottom + (next?.top ?? row.bottom)) / 2);
    });
    const grid: FlowchartGridLayout | null =
      sortedRows.length > 0 && verticalLines.length > 0
        ? {
            horizontalLines,
            verticalLines,
            rowGutters,
            minGridX: verticalLines[0] ?? resolvedLeft,
            maxGridX: verticalLines.at(-1) ?? resolvedRight,
            minGridY: horizontalLines[0] ?? resolvedTop,
            maxGridY: horizontalLines.at(-1) ?? resolvedBottom,
          }
        : null;

    setGeometry({
      width: root.scrollWidth,
      height: root.scrollHeight,
      anchors,
      actorLeft: resolvedLeft,
      actorRight: resolvedRight,
      flowchart: {
        width: root.scrollWidth,
        height: root.scrollHeight,
        shapes,
        columns,
        pelaksanaBounds: {
          left: Math.max(0, resolvedLeft + 8),
          top: Math.max(0, resolvedTop + 4),
          right: resolvedRight - 8,
          bottom: resolvedBottom + 8,
        },
        grid,
      },
    });
  }, [model.rows]);

  useLayoutEffect(() => {
    measure();

    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(root);

    return () => observer.disconnect();
  }, [measure]);

  const setShapeRef = useCallback(
    (stepId: StepId, element: HTMLSpanElement | null) => {
      if (element) {
        shapeRefs.current.set(stepId, element);
      } else {
        shapeRefs.current.delete(stepId);
      }
    },
    [],
  );

  const updateManualTrunk = useCallback(
    (connectionId: string, clientX: number) => {
      const root = rootRef.current;
      if (!root || !geometry) return;

      const rect = root.getBoundingClientRect();
      const localX = clientX - rect.left;

      if (usesLegacyManualPaths) {
        const nextConfig = updateProcedureManualTrunk(
          model,
          geometry,
          {},
          connectionId,
          localX,
        );
        const nextRoute = nextConfig.routes?.[connectionId];
        if (nextRoute?.kind !== "trunk") return;

        updatePathOffsets({
          ...pathOffsets,
          [connectionId]: nextRoute.x,
        });
        return;
      }

      updateDiagramConfig(
        updateProcedureManualTrunk(
          model,
          geometry,
          diagramConfig,
          connectionId,
          localX,
        ),
      );
    },
    [
      diagramConfig,
      geometry,
      model,
      pathOffsets,
      updateDiagramConfig,
      updatePathOffsets,
      usesLegacyManualPaths,
    ],
  );

  const handleOverlayPointerMove = (
    event: ReactPointerEvent<SVGSVGElement>,
  ) => {
    const connectionId = draggingConnectionId.current;
    if (!connectionId) return;

    event.preventDefault();
    updateManualTrunk(connectionId, event.clientX);
  };

  const stopDragging = () => {
    draggingConnectionId.current = null;
  };

  return (
    <section
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-sopflow-procedure-view
      data-manual-editing={manualEditing || undefined}
      aria-label="Prosedur SOP"
    >
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: "5%" }} />
          <col style={{ width: "24%" }} />
          {model.actorColumns.map((actor, index) => (
            <col
              key={actor.actorId ?? `fallback-${index}`}
              style={{ width: `${actorWidth}%` }}
            />
          ))}
          <col style={{ width: "14%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "12%" }} />
        </colgroup>

        <thead>
          <tr>
            <th rowSpan={2}>No</th>
            <th rowSpan={2}>Kegiatan</th>
            <th colSpan={model.actorColumns.length}>Pelaksana</th>
            <th colSpan={3}>Mutu Baku</th>
            <th rowSpan={2}>Ket</th>
          </tr>
          <tr>
            {model.actorColumns.map((actor, index) => (
              <th
                key={actor.actorId ?? `fallback-${index}`}
                className={styles.actorHeader}
                data-sopflow-actor-header
              >
                {actor.label}
              </th>
            ))}
            <th>Kelengkapan</th>
            <th>Waktu</th>
            <th>Output</th>
          </tr>
        </thead>

        <tbody>
          {model.rows.length === 0 ? (
            <tr>
              <td colSpan={totalColumns} className={styles.empty}>
                Belum ada langkah SOP.
              </td>
            </tr>
          ) : (
            model.rows.map((row) => {
              const selected = selectedStepId === row.stepId;
              const issueCount = issues.filter(
                (issue) => issue.stepId === row.stepId,
              ).length;

              return (
                <tr
                  key={row.stepId}
                  className={styles.row}
                  data-sopflow-procedure-step-id={row.stepId}
                  data-selected={selected || undefined}
                  data-error={issueCount > 0 || undefined}
                  tabIndex={onSelectedStepChange ? 0 : undefined}
                  aria-selected={selected || undefined}
                  onClick={() => onSelectedStepChange?.(row.stepId)}
                  onKeyDown={(event) => {
                    if (
                      onSelectedStepChange &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      onSelectedStepChange(row.stepId);
                    }
                  }}
                >
                  <td className={styles.number}>{row.number}</td>
                  <td className={styles.activity}>
                    <div className={styles.activityName}>
                      {row.activity.trim() || "—"}
                    </div>
                    {row.kind === "decision" || issueCount > 0 ? (
                      <div className={styles.activityMeta}>
                        {row.kind === "decision" ? (
                          <span>{decisionSummary(row.stepId, model)}</span>
                        ) : null}
                        {issueCount > 0 ? (
                          <span className={styles.issue}>
                            {issueCount} masalah
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </td>

                  {model.actorColumns.map((actor, actorIndex) => {
                    const primary =
                      actor.actorId === row.primaryActorId ||
                      (actor.actorId === null &&
                        row.primaryActorId === null &&
                        model.actorColumns.length === 1);

                    return (
                      <td
                        key={actor.actorId ?? `fallback-${actorIndex}`}
                        className={styles.actorCell}
                        data-sopflow-actor-cell
                        data-sopflow-actor-id={
                          actor.actorId ?? "__fallback__"
                        }
                      >
                        {primary ? (
                          <span
                            ref={(element) => setShapeRef(row.stepId, element)}
                            className={styles.shapeAnchor}
                            data-sopflow-primary-shape={row.stepId}
                          >
                            <ProcedureShape kind={row.kind} />
                          </span>
                        ) : null}
                      </td>
                    );
                  })}

                  <td>{display(row.input)}</td>
                  <td>{durationLabel(row)}</td>
                  <td>{display(row.output)}</td>
                  <td>{display(row.note)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {geometry && routedEdges.length > 0 ? (
        <svg
          className={styles.overlay}
          data-editing={manualEditing || undefined}
          width={geometry.width}
          height={geometry.height}
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          aria-hidden="true"
          onPointerMove={handleOverlayPointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
        >
          <defs>
            <marker
              id="sopflow-procedure-arrow"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 7 3.5 L 0 7 Z" className={styles.arrowHead} />
            </marker>
          </defs>

          {routedEdges.map((edge) => {
            const selected = selectedConnectionId === edge.id;

            return (
              <g key={edge.id}>
                <path
                  d={pointsToPath(edge.points)}
                  className={styles.edge}
                  data-selected={selected || undefined}
                  data-editable={manualEditing || undefined}
                  markerEnd="url(#sopflow-procedure-arrow)"
                  onPointerDown={(event) => {
                    if (!manualEditing) return;
                    event.stopPropagation();
                    setSelectedConnectionId(edge.id);
                  }}
                />
                {edge.label && edge.labelPosition ? (
                  <text
                    x={edge.labelPosition.x}
                    y={edge.labelPosition.y}
                    className={styles.edgeLabel}
                  >
                    {edge.label}
                  </text>
                ) : null}
                {manualEditing && selected ? (
                  <circle
                    cx={edge.handlePosition.x}
                    cy={edge.handlePosition.y}
                    r={5}
                    className={styles.pathHandle}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      draggingConnectionId.current = edge.id;
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}
    </section>
  );
}

function ProcedureShape({ kind }: { kind: ProcedureRowModel["kind"] }) {
  if (kind === "decision") {
    return (
      <svg
        className={styles.flowShape}
        data-kind={kind}
        width={66}
        height={66}
        viewBox="-2 -2 64 64"
        aria-hidden="true"
      >
        <polygon points="30,1 59,30 30,59 1,30" />
      </svg>
    );
  }

  if (kind === "start" || kind === "end") {
    return (
      <svg
        className={styles.flowShape}
        data-kind={kind}
        width={86}
        height={42}
        viewBox="-2 -2 82 42"
        aria-hidden="true"
      >
        <rect width={76} height={36} x={0.8} y={0.8} rx={19.2} ry={19.2} />
      </svg>
    );
  }

  return (
    <svg
      className={styles.flowShape}
      data-kind={kind}
      width={82}
      height={42}
      viewBox="0 -2 82 42"
      aria-hidden="true"
    >
      <rect width={76} height={36} x={1} y={1} />
    </svg>
  );
}

function display(value: string | undefined): string {
  return value?.trim() || "—";
}

function durationLabel(row: ProcedureRowModel): string {
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

function decisionSummary(stepId: StepId, model: ProcedureModel): string {
  const orderById = new Map(
    model.rows.map((row) => [row.stepId, row.number] as const),
  );
  const branches = model.graph.edges.filter((edge) => edge.from === stepId);
  const yes = branches.find((edge) => edge.kind === "yes");
  const no = branches.find((edge) => edge.kind === "no");

  return `Ya → ${yes ? (orderById.get(yes.to) ?? "?") : "?"} · Tidak → ${no ? (orderById.get(no.to) ?? "?") : "?"}`;
}
