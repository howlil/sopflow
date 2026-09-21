import type { SOPDocument, StepId, ValidationIssue } from "@sopflow/core";
import {
  buildProcedureModel,
  pointsToPath,
  routeProcedureEdges,
  type ProcedureGeometry,
  type ProcedureManualTrunks,
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
  manualPathOffsets?: SopManualPathOffsets;
  onManualPathOffsetsChange?: (offsets: SopManualPathOffsets) => void;
  className?: string;
}

export function SopProcedureView({
  document,
  selectedStepId = null,
  onSelectedStepChange,
  issues = [],
  manualEditing = false,
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
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const draggingConnectionId = useRef<string | null>(null);

  const model = useMemo(() => buildProcedureModel(document), [document]);
  const pathOffsets = manualPathOffsets ?? internalOffsets;
  const routedEdges = useMemo(
    () =>
      geometry
        ? routeProcedureEdges(model, geometry, pathOffsets)
        : [],
    [geometry, model, pathOffsets],
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

  const actorWidth = 24 / model.actorColumns.length;
  const totalColumns = model.actorColumns.length + 6;

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const rootRect = root.getBoundingClientRect();
    const anchors = new Map<StepId, { x: number; y: number }>();

    for (const [stepId, element] of shapeRefs.current) {
      const rect = element.getBoundingClientRect();
      anchors.set(stepId, {
        x: rect.left - rootRect.left + rect.width / 2,
        y: rect.top - rootRect.top + rect.height / 2,
      });
    }

    const actorHeaders = Array.from(
      root.querySelectorAll<HTMLElement>("[data-sopflow-actor-header]"),
    );
    const firstActorHeader = actorHeaders[0]?.getBoundingClientRect();
    const lastActorHeader = actorHeaders.at(-1)?.getBoundingClientRect();

    setGeometry({
      width: root.scrollWidth,
      height: root.scrollHeight,
      anchors,
      actorLeft: firstActorHeader ? firstActorHeader.left - rootRect.left : 0,
      actorRight: lastActorHeader
        ? lastActorHeader.right - rootRect.left
        : rootRect.width,
    });
  }, []);

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
      const padding = 8;
      const x = Math.max(
        geometry.actorLeft + padding,
        Math.min(geometry.actorRight - padding, localX),
      );

      updatePathOffsets({
        ...pathOffsets,
        [connectionId]: x,
      });
    },
    [geometry, pathOffsets, updatePathOffsets],
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
                    const assigned =
                      actor.actorId === null
                        ? model.actorColumns.length === 1 &&
                          model.actorColumns[0]?.actorId === null
                        : row.actorIds.includes(actor.actorId);
                    const primary =
                      assigned && actor.actorId === row.primaryActorId;

                    return (
                      <td
                        key={actor.actorId ?? `fallback-${actorIndex}`}
                        className={styles.actorCell}
                        data-sopflow-actor-id={actor.actorId ?? undefined}
                      >
                        {assigned ? (
                          <span
                            ref={(element) => {
                              if (primary) setShapeRef(row.stepId, element);
                            }}
                            className={styles.shapeAnchor}
                            data-sopflow-primary-shape={
                              primary ? row.stepId : undefined
                            }
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
  return (
    <svg
      className={styles.flowShape}
      data-kind={kind}
      viewBox="0 0 36 28"
      aria-hidden="true"
    >
      {kind === "decision" ? (
        <polygon points="18,2 34,14 18,26 2,14" />
      ) : kind === "start" || kind === "end" ? (
        <rect x="2" y="5" width="32" height="18" rx="9" />
      ) : (
        <rect x="2" y="5" width="32" height="18" />
      )}
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

  return `Ya → ${yes ? orderById.get(yes.to) ?? "?" : "?"} · Tidak → ${no ? orderById.get(no.to) ?? "?" : "?"}`;
}
