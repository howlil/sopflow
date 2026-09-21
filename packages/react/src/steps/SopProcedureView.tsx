import type { SOPDocument, Step, StepId, ValidationIssue } from "@sopflow/core";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import styles from "./SopProcedureView.module.css";

export type SopManualPathOffsets = Readonly<Record<string, number>>;

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

interface Anchor {
  x: number;
  y: number;
}

interface Geometry {
  width: number;
  height: number;
  anchors: Map<StepId, Anchor>;
  actorLeft: number;
  actorRight: number;
}

interface Connection {
  id: string;
  from: StepId;
  to: StepId;
  label?: string;
  backIndex: number;
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
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [internalOffsets, setInternalOffsets] = useState<SopManualPathOffsets>(
    {},
  );
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const draggingConnectionId = useRef<string | null>(null);

  const pathOffsets = manualPathOffsets ?? internalOffsets;

  const updatePathOffsets = useCallback(
    (next: SopManualPathOffsets) => {
      if (manualPathOffsets === undefined) {
        setInternalOffsets(next);
      }
      onManualPathOffsetsChange?.(next);
    },
    [manualPathOffsets, onManualPathOffsetsChange],
  );

  const actorColumns =
    document.actors.length > 0
      ? document.actors.map((actor) => ({
          id: actor.id as string | null,
          name: actor.name,
        }))
      : [{ id: null, name: "Pelaksana" }];
  const actorWidth = 24 / actorColumns.length;
  const totalColumns = actorColumns.length + 6;

  const connections = useMemo(() => buildConnections(document), [document]);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const rootRect = root.getBoundingClientRect();
    const anchors = new Map<StepId, Anchor>();

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
          {actorColumns.map((actor, index) => (
            <col
              key={actor.id ?? `fallback-${index}`}
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
            <th colSpan={actorColumns.length}>Pelaksana</th>
            <th colSpan={3}>Mutu Baku</th>
            <th rowSpan={2}>Ket</th>
          </tr>
          <tr>
            {actorColumns.map((actor, index) => (
              <th
                key={actor.id ?? `fallback-${index}`}
                className={styles.actorHeader}
                data-sopflow-actor-header
              >
                {actor.name}
              </th>
            ))}
            <th>Kelengkapan</th>
            <th>Waktu</th>
            <th>Output</th>
          </tr>
        </thead>

        <tbody>
          {document.steps.length === 0 ? (
            <tr>
              <td colSpan={totalColumns} className={styles.empty}>
                Belum ada langkah SOP.
              </td>
            </tr>
          ) : (
            document.steps.map((step, index) => {
              const selected = selectedStepId === step.id;
              const issueCount = issues.filter(
                (issue) => issue.stepId === step.id,
              ).length;
              const primaryActorId =
                step.actorIds[0] ?? actorColumns[0]?.id ?? null;

              return (
                <tr
                  key={step.id}
                  className={styles.row}
                  data-sopflow-procedure-step-id={step.id}
                  data-selected={selected || undefined}
                  data-error={issueCount > 0 || undefined}
                  tabIndex={onSelectedStepChange ? 0 : undefined}
                  aria-selected={selected || undefined}
                  onClick={() => onSelectedStepChange?.(step.id)}
                  onKeyDown={(event) => {
                    if (
                      onSelectedStepChange &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      onSelectedStepChange(step.id);
                    }
                  }}
                >
                  <td className={styles.number}>{index + 1}</td>
                  <td className={styles.activity}>
                    <div className={styles.activityName}>
                      {step.name.trim() || "—"}
                    </div>
                    {step.type === "decision" || issueCount > 0 ? (
                      <div className={styles.activityMeta}>
                        {step.type === "decision" ? (
                          <span>{decisionSummary(step, document)}</span>
                        ) : null}
                        {issueCount > 0 ? (
                          <span className={styles.issue}>
                            {issueCount} masalah
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </td>

                  {actorColumns.map((actor, actorIndex) => {
                    const assigned =
                      actor.id === null
                        ? document.actors.length === 0
                        : step.actorIds.includes(actor.id);
                    const primary = assigned && actor.id === primaryActorId;

                    return (
                      <td
                        key={actor.id ?? `fallback-${actorIndex}`}
                        className={styles.actorCell}
                        data-sopflow-actor-id={actor.id ?? undefined}
                      >
                        {assigned ? (
                          <span
                            ref={(element) => {
                              if (primary) setShapeRef(step.id, element);
                            }}
                            className={styles.shapeAnchor}
                            data-sopflow-primary-shape={
                              primary ? step.id : undefined
                            }
                          >
                            <ProcedureShape step={step} />
                          </span>
                        ) : null}
                      </td>
                    );
                  })}

                  <td>{display(step.input)}</td>
                  <td>{durationLabel(step)}</td>
                  <td>{display(step.output)}</td>
                  <td>{display(step.note)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {geometry && connections.length > 0 ? (
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

          {connections.map((connection) => {
            const from = geometry.anchors.get(connection.from);
            const to = geometry.anchors.get(connection.to);
            if (!from || !to) return null;

            const routed = routeConnection(
              connection,
              from,
              to,
              geometry,
              pathOffsets[connection.id],
            );
            const selected = selectedConnectionId === connection.id;

            return (
              <g key={connection.id}>
                <path
                  d={routed.path}
                  className={styles.edge}
                  data-selected={selected || undefined}
                  data-editable={manualEditing || undefined}
                  markerEnd="url(#sopflow-procedure-arrow)"
                  onPointerDown={(event) => {
                    if (!manualEditing) return;
                    event.stopPropagation();
                    setSelectedConnectionId(connection.id);
                  }}
                />
                {connection.label ? (
                  <text
                    x={routed.trunkX + 3}
                    y={(from.y + to.y) / 2 - 4}
                    className={styles.edgeLabel}
                  >
                    {connection.label}
                  </text>
                ) : null}
                {manualEditing && selected ? (
                  <circle
                    cx={routed.trunkX}
                    cy={(from.y + to.y) / 2}
                    r={5}
                    className={styles.pathHandle}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      draggingConnectionId.current = connection.id;
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

function ProcedureShape({ step }: { step: Step }) {
  return (
    <svg
      className={styles.flowShape}
      data-kind={step.type}
      viewBox="0 0 36 28"
      aria-hidden="true"
    >
      {step.type === "decision" ? (
        <polygon points="18,2 34,14 18,26 2,14" />
      ) : step.type === "start" || step.type === "end" ? (
        <rect x="2" y="5" width="32" height="18" rx="9" />
      ) : (
        <rect x="2" y="5" width="32" height="18" />
      )}
    </svg>
  );
}

function buildConnections(document: SOPDocument): Connection[] {
  let backIndex = 0;
  const order = new Map(
    document.steps.map((step, index) => [step.id, index] as const),
  );

  return document.steps.flatMap((step) => {
    const candidates =
      step.type === "end"
        ? []
        : step.type === "decision"
          ? [
              { id: `${step.id}:yes:${step.yes}`, to: step.yes, label: "Ya" },
              { id: `${step.id}:no:${step.no}`, to: step.no, label: "Tidak" },
            ]
          : [{ id: `${step.id}:next:${step.next}`, to: step.next }];

    return candidates
      .filter((candidate) => order.has(candidate.to))
      .map((candidate) => {
        const isBack =
          (order.get(candidate.to) ?? 0) <= (order.get(step.id) ?? 0);

        return {
          ...candidate,
          from: step.id,
          backIndex: isBack ? backIndex++ : -1,
        };
      });
  });
}

function routeConnection(
  connection: Connection,
  from: Anchor,
  to: Anchor,
  geometry: Geometry,
  manualTrunkX: number | undefined,
): { path: string; trunkX: number } {
  const isBack = connection.backIndex >= 0;
  const autoTrunkX = isBack
    ? geometry.actorRight - 10 - connection.backIndex * 10
    : from.x + (to.x - from.x) / 2;
  const trunkX = manualTrunkX ?? autoTrunkX;

  return {
    trunkX,
    path: `M ${from.x} ${from.y} L ${trunkX} ${from.y} L ${trunkX} ${to.y} L ${to.x} ${to.y}`,
  };
}

function display(value: string | undefined): string {
  return value?.trim() || "—";
}

function durationLabel(step: Step): string {
  if (!step.duration) return "—";

  const unitLabels = {
    minute: "menit",
    hour: "jam",
    day: "hari",
    week: "minggu",
    month: "bulan",
    year: "tahun",
  } as const;

  return `${step.duration.value} ${unitLabels[step.duration.unit]}`;
}

function decisionSummary(
  step: Extract<Step, { type: "decision" }>,
  document: SOPDocument,
): string {
  const orderById = new Map(
    document.steps.map((candidate, index) => [candidate.id, index + 1]),
  );

  return `Ya → ${orderById.get(step.yes) ?? "?"} · Tidak → ${orderById.get(step.no) ?? "?"}`;
}
