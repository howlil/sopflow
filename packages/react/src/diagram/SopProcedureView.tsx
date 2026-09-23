import type { SOPDocument, StepId, ValidationIssue } from "@sopflow/core";
import {
  buildFormalProcedurePages,
  buildProcedureModel,
  formalPathToSegments,
  pointsToPath,
  removeProcedureManualRoute,
  routeProcedureEdges,
  setProcedureManualRoute,
  updateProcedureManualTrunk,
  type FormalFlowchartBounds,
  type FormalFlowchartColumnBounds,
  type FormalFlowchartGeometry,
  type FormalFlowchartGridLayout,
  type FormalFlowchartRect,
  type FormalFlowchartShapeGeometry,
  type FormalRouteChange,
  type ProcedureGeometry,
  type ProcedureLaneGeometry,
  type ProcedureNodeGeometry,
  type ProcedureManualTrunks,
  type ProcedureModel,
  type ProcedureRowModel,
  type SopDiagramConfig,
} from "@sopflow/diagram";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { EditableFormalFlowchartPath } from "./EditableFormalFlowchartPath.js";
import { SopProcedurePage } from "./SopProcedurePage.js";
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
  firstPageRows?: number;
  nextPageRows?: number;
  pageHeightPx?: number;
  firstPageReservedHeightPx?: number;
  nextPageReservedHeightPx?: number;
  className?: string;
}

export function SopProcedureView(props: SopProcedureViewProps) {
  const model = useMemo(
    () => buildProcedureModel(props.document),
    [props.document],
  );
  const pages = useMemo(
    () =>
      buildFormalProcedurePages(model, {
        ...(props.firstPageRows !== undefined
          ? { firstPageRows: props.firstPageRows }
          : {}),
        ...(props.nextPageRows !== undefined
          ? { nextPageRows: props.nextPageRows }
          : {}),
        ...(props.pageHeightPx !== undefined
          ? { pageHeightPx: props.pageHeightPx }
          : {}),
        ...(props.firstPageReservedHeightPx !== undefined
          ? { firstPageReservedHeightPx: props.firstPageReservedHeightPx }
          : {}),
        ...(props.nextPageReservedHeightPx !== undefined
          ? { nextPageReservedHeightPx: props.nextPageReservedHeightPx }
          : {}),
      }),
    [
      model,
      props.firstPageReservedHeightPx,
      props.firstPageRows,
      props.nextPageReservedHeightPx,
      props.nextPageRows,
      props.pageHeightPx,
    ],
  );
  const [internalDiagramConfig, setInternalDiagramConfig] =
    useState<SopDiagramConfig>({});
  const usesLegacyManualPaths =
    props.diagramConfig === undefined &&
    (props.manualPathOffsets !== undefined ||
      props.onManualPathOffsetsChange !== undefined);
  const diagramConfig = props.diagramConfig ?? internalDiagramConfig;
  const updateDiagramConfig = useCallback(
    (next: SopDiagramConfig) => {
      if (props.diagramConfig === undefined) {
        setInternalDiagramConfig(next);
      }
      props.onDiagramConfigChange?.(next);
    },
    [props.diagramConfig, props.onDiagramConfigChange],
  );

  // Preserve the deprecated trunk-offset API without letting it constrain the
  // modern paginated renderer. Current editor consumers always use diagramConfig.
  if (usesLegacyManualPaths && pages.length <= 1) {
    return <LegacySinglePageSopProcedureView {...props} />;
  }

  return (
    <section
      className={[styles.paginatedRoot, props.className]
        .filter(Boolean)
        .join(" ")}
      data-sopflow-procedure-view
      data-sopflow-procedure-pages={pages.length}
      data-manual-editing={props.manualEditing || undefined}
      aria-label="Prosedur SOP"
    >
      {pages.map((page) => (
        <SopProcedurePage
          key={page.pageIndex}
          model={model}
          page={page}
          manualEditing={props.manualEditing ?? false}
          diagramConfig={diagramConfig}
          onDiagramConfigChange={updateDiagramConfig}
          {...(props.selectedStepId !== undefined
            ? { selectedStepId: props.selectedStepId }
            : {})}
          {...(props.onSelectedStepChange !== undefined
            ? { onSelectedStepChange: props.onSelectedStepChange }
            : {})}
          {...(props.issues !== undefined ? { issues: props.issues } : {})}
        />
      ))}
    </section>
  );
}

function LegacySinglePageSopProcedureView({
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

  const routeSegmentsById = useMemo(
    () =>
      new Map(
        routedEdges.map((edge) => [
          edge.id,
          formalPathToSegments(edge.points),
        ] as const),
      ),
    [routedEdges],
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

  const actorWidth = Math.max(10, 70 / model.actorColumns.length);
  const totalColumns = model.actorColumns.length + 6;

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const rootRect = root.getBoundingClientRect();
    const rowById = new Map(
      model.rows.map((row) => [row.stepId, row] as const),
    );
    const anchors = new Map<StepId, { x: number; y: number }>();
    const shapes = new Map<StepId, FormalFlowchartShapeGeometry>();
    const nodeGeometry = new Map<StepId, ProcedureNodeGeometry>();
    const obstacles: ProcedureNodeGeometry["rect"][] = [];
    const rowElements = Array.from(
      root.querySelectorAll<HTMLElement>("[data-sopflow-procedure-step-id]"),
    );
    const rowByStepId = new Map(
      rowElements.flatMap((element) => {
        const stepId = element.dataset.sopflowProcedureStepId;
        return stepId ? [[stepId, element] as const] : [];
      }),
    );

    for (const [stepId, element] of shapeRefs.current) {
      const rect = toLocalRect(element.getBoundingClientRect(), rootRect);
      const row = rowById.get(stepId);
      if (!row) continue;

      anchors.set(stepId, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      shapes.set(stepId, {
        stepId,
        actorId: row.primaryActorId,
        row: row.number - 1,
        kind: row.kind,
        rect,
      });
      const rowElement = rowByStepId.get(stepId);
      const localRect = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
      nodeGeometry.set(stepId, {
        stepId,
        rect: localRect,
        laneId: rowElement?.dataset.sopflowPrimaryActorId || null,
      });
      obstacles.push(localRect);
    }

    const actorCells = Array.from(
      root.querySelectorAll<HTMLElement>("[data-sopflow-actor-cell]"),
    );
    const actorHeaders = Array.from(
      root.querySelectorAll<HTMLElement>("[data-sopflow-actor-header]"),
    );
    const firstActorHeader = actorHeaders[0]?.getBoundingClientRect();
    const lastActorHeader = actorHeaders.at(-1)?.getBoundingClientRect();
    const actorLeft = firstActorHeader
      ? firstActorHeader.left - rootRect.left
      : 0;
    const actorRight = lastActorHeader
      ? lastActorHeader.right - rootRect.left
      : rootRect.width;
    const fallbackX = actorLeft + (actorRight - actorLeft) / 2;
    const actorLanes = new Map<string | null, ProcedureLaneGeometry>();
    actorHeaders.forEach((header, index) => {
      const rect = header.getBoundingClientRect();
      const actor = model.actorColumns[index];
      actorLanes.set(actor?.actorId ?? null, {
        actorId: actor?.actorId ?? null,
        left: rect.left - rootRect.left,
        right: rect.right - rootRect.left,
        top: rect.top - rootRect.top,
        bottom: rect.bottom - rootRect.top,
      });
    });

    for (const rowElement of rowElements) {
      const stepId = rowElement.dataset.sopflowProcedureStepId;
      if (!stepId || anchors.has(stepId)) continue;

      const rowRect = rowElement.getBoundingClientRect();
      anchors.set(stepId, {
        x: fallbackX,
        y: rowRect.top - rootRect.top + rowRect.height / 2,
      });
      const row = model.rows.find((candidate) => candidate.stepId === stepId);
      nodeGeometry.set(stepId, {
        stepId,
        rect: {
          left: actorLeft,
          top: rowRect.top - rootRect.top,
          width: Math.max(0, actorRight - actorLeft),
          height: rowRect.height,
        },
        laneId: row?.primaryActorId ?? null,
      });
    }
    const pelaksanaBounds = measurePelaksanaBounds(actorCells, rootRect);
    const columns = measureActorColumns(actorCells, rootRect);
    const gridLayout = measureGridLayout(root, rootRect);

    const formalGeometry =
      pelaksanaBounds &&
      pelaksanaBounds.right > pelaksanaBounds.left &&
      shapes.size === model.rows.length &&
      [...shapes.values()].every(
        (shape) => shape.rect.width > 0 && shape.rect.height > 0,
      )
        ? ({
            width: root.scrollWidth,
            height: root.scrollHeight,
            pelaksanaBounds,
            columns,
            gridLayout,
            shapes,
          } satisfies FormalFlowchartGeometry)
        : null;

    setGeometry({
      width: root.scrollWidth,
      height: root.scrollHeight,
      anchors,
      actorLeft,
      actorRight,
      actorLanes,
      nodes: nodeGeometry,
      obstacles,
      routingBounds: {
        left: 0,
        top: 0,
        width: root.scrollWidth || rootRect.width,
        height: root.scrollHeight || rootRect.height,
      },
      ...(formalGeometry ? { formal: formalGeometry } : {}),
    });
  }, [model]);

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

  const updateManualPath = useCallback(
    (connectionId: string, route: FormalRouteChange) => {
      if (usesLegacyManualPaths) return;

      const currentRoute = diagramConfig.routes?.[connectionId];
      updateDiagramConfig(
        setProcedureManualRoute(diagramConfig, connectionId, {
          kind: "orthogonal",
          bendPoints: route.bendPoints.map((point) => ({ ...point })),
          sSide: route.sourceSide,
          eSide: route.targetSide,
          ...(route.sourceDistance !== undefined
            ? { sourceDistance: route.sourceDistance }
            : {}),
          ...(route.targetDistance !== undefined
            ? { targetDistance: route.targetDistance }
            : {}),
          startPoint: { ...route.startPoint },
          endPoint: { ...route.endPoint },
          ...(currentRoute?.labelPosition
            ? { labelPosition: currentRoute.labelPosition }
            : {}),
        }),
      );
    },
    [diagramConfig, updateDiagramConfig, usesLegacyManualPaths],
  );

  const resetManualPath = useCallback(
    (connectionId: string) => {
      if (usesLegacyManualPaths) return;

      updateDiagramConfig(
        removeProcedureManualRoute(diagramConfig, connectionId),
      );
    },
    [diagramConfig, updateDiagramConfig, usesLegacyManualPaths],
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
          <col style={{ width: "25%" }} />
          {model.actorColumns.map((actor, index) => (
            <col
              key={actor.actorId ?? `fallback-${index}`}
              style={{ width: `${actorWidth}%` }}
            />
          ))}
          <col style={{ width: "15%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "15%" }} />
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
                data-sopflow-actor-id={actor.actorId ?? ""}
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
                  data-sopflow-primary-actor-id={row.primaryActorId ?? ""}
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
                        data-sopflow-actor-id={actor.actorId ?? "fallback"}
                      >
                        {primary ? (
                          <div className={styles.shapeSlot}>
                            <span
                              ref={(element) =>
                                setShapeRef(row.stepId, element)
                              }
                              className={styles.shapeAnchor}
                              data-sopflow-primary-shape={row.stepId}
                            >
                              <ProcedureShape kind={row.kind} />
                            </span>
                          </div>
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
          aria-label={
            manualEditing && !usesLegacyManualPaths
              ? "Editor jalur flowchart SOP"
              : undefined
          }
          aria-hidden={
            manualEditing && !usesLegacyManualPaths ? undefined : true
          }
          onPointerMove={handleOverlayPointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
        >
          <defs>
            <marker
              id="sopflow-procedure-arrow"
              markerWidth="10"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L8,4 L0,8 L2,4 Z" className={styles.arrowHead} />
            </marker>
          </defs>

          {routedEdges.map((edge) => {
            const selected = selectedConnectionId === edge.id;

            return (
              <g key={edge.id}>
                {manualEditing && !usesLegacyManualPaths
                  ? (() => {
                      const sourceShape = geometry.formal?.shapes.get(
                        edge.from,
                      );
                      const targetShape = geometry.formal?.shapes.get(edge.to);
                      const obstacles = geometry.formal
                        ? [...geometry.formal.shapes.values()]
                            .filter(
                              (shape) =>
                                shape.stepId !== edge.from &&
                                shape.stepId !== edge.to,
                            )
                            .map((shape) => shape.rect)
                        : [];
                      const occupiedSegments = [...routeSegmentsById.entries()]
                        .filter(([edgeId]) => edgeId !== edge.id)
                        .flatMap(([, segments]) => segments);
                      const pelaksanaBounds = geometry.formal?.pelaksanaBounds;
                      const formalBounds = pelaksanaBounds
                        ? {
                            left: pelaksanaBounds.left,
                            top: pelaksanaBounds.top,
                            width: pelaksanaBounds.right - pelaksanaBounds.left,
                            height:
                              pelaksanaBounds.bottom - pelaksanaBounds.top,
                          }
                        : null;

                      return (
                        <EditableFormalFlowchartPath
                          path={edge.points}
                          connectionId={edge.id}
                          selected={selected}
                          sourceSide={edge.sourceSide ?? "bottom"}
                          targetSide={edge.targetSide ?? "top"}
                          {...(sourceShape
                            ? { sourceRect: sourceShape.rect }
                            : {})}
                          {...(targetShape
                            ? { targetRect: targetShape.rect }
                            : {})}
                          sourceIsDiamond={sourceShape?.kind === "decision"}
                          targetIsDiamond={targetShape?.kind === "decision"}
                          obstacles={obstacles}
                          occupiedSegments={occupiedSegments}
                          routingBounds={formalBounds}
                          onSelect={setSelectedConnectionId}
                          onChange={(route) => updateManualPath(edge.id, route)}
                          onReset={() => resetManualPath(edge.id)}
                        />
                      );
                    })()
                  : null}

                <path
                  d={pointsToPath(edge.points)}
                  className={styles.edge}
                  data-selected={selected || undefined}
                  data-editable={
                    manualEditing && usesLegacyManualPaths ? true : undefined
                  }
                  markerEnd="url(#sopflow-procedure-arrow)"
                  onPointerDown={
                    manualEditing && usesLegacyManualPaths
                      ? (event) => {
                          event.stopPropagation();
                          setSelectedConnectionId(edge.id);
                        }
                      : undefined
                  }
                />
                {edge.label && edge.labelPosition ? (
                  <text
                    x={edge.labelPosition.x}
                    y={edge.labelPosition.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={styles.edgeLabel}
                  >
                    {edge.label}
                  </text>
                ) : null}
                {manualEditing &&
                selected &&
                (usesLegacyManualPaths || edge.points.length < 4) ? (
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

function toLocalRect(rect: DOMRect, rootRect: DOMRect): FormalFlowchartRect {
  return {
    left: Math.round(rect.left - rootRect.left),
    top: Math.round(rect.top - rootRect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function measurePelaksanaBounds(
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

function measureActorColumns(
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

function measureGridLayout(
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

function uniqueRounded(values: readonly number[]): number[] {
  return [...new Set(values.map((value) => Math.round(value)))].sort(
    (a, b) => a - b,
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
