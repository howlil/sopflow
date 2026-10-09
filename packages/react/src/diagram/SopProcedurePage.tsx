import type { StepId, ValidationIssue } from "@sopflow/core";
import {
  formalPathToSegments,
  planFormalProcedureEdges,
  pointsToPath,
  removeProcedurePageManualRoute,
  resolveProcedurePageRouteOverrides,
  setProcedurePageManualRoute,
  type FormalFlowchartGeometry,
  type FormalFlowchartShapeGeometry,
  type FormalProcedurePageModel,
  type FormalRouteChange,
  type ProcedureModel,
  type SopDiagramConfig,
} from "@sopflow/diagram";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  ProcedureShape,
  toLocalRect,
  measurePelaksanaBounds,
  measureActorColumns,
  measureGridLayout,
  display,
  durationLabel,
  decisionSummary,
} from "./procedureShared.js";
import { EditableFormalFlowchartPath } from "./EditableFormalFlowchartPath.js";
import styles from "./SopProcedureView.module.css";

export interface SopProcedurePageProps {
  model: ProcedureModel;
  page: FormalProcedurePageModel;
  selectedStepId?: StepId | null;
  onSelectedStepChange?: (stepId: StepId | null) => void;
  issues?: readonly ValidationIssue[];
  manualEditing?: boolean;
  diagramConfig?: SopDiagramConfig;
  onDiagramConfigChange?: (config: SopDiagramConfig) => void;
}

export function SopProcedurePage({
  model,
  page,
  selectedStepId = null,
  onSelectedStepChange,
  issues = [],
  manualEditing = false,
  diagramConfig = {},
  onDiagramConfigChange,
}: SopProcedurePageProps) {
  const rootRef = useRef<HTMLElement>(null);
  const shapeRefs = useRef(new Map<string, HTMLSpanElement>());
  const [geometry, setGeometry] = useState<FormalFlowchartGeometry | null>(
    null,
  );
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const actorWidth = Math.max(10, 70 / model.actorColumns.length);
  const totalColumns = model.actorColumns.length + 6;
  const routingRowById = useMemo(
    () => new Map(page.routingRows.map((row) => [row.stepId, row] as const)),
    [page.routingRows],
  );

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const rootRect = root.getBoundingClientRect();
    const shapes = new Map<string, FormalFlowchartShapeGeometry>();

    for (const [shapeId, element] of shapeRefs.current) {
      const routeRow = routingRowById.get(shapeId);
      if (!routeRow) continue;
      const rect = toLocalRect(element.getBoundingClientRect(), rootRect);
      if (rect.width <= 0 || rect.height <= 0) continue;

      shapes.set(shapeId, {
        stepId: shapeId,
        actorId: routeRow.primaryActorId,
        row: routeRow.number - 1,
        kind: routeRow.kind,
        rect,
      });
    }

    const actorCells = Array.from(
      root.querySelectorAll<HTMLElement>("[data-sopflow-actor-cell]"),
    );
    const pelaksanaBounds = measurePelaksanaBounds(actorCells, rootRect);
    const columns = measureActorColumns(actorCells, rootRect);
    const gridLayout = measureGridLayout(root, rootRect);

    if (
      !pelaksanaBounds ||
      pelaksanaBounds.right <= pelaksanaBounds.left ||
      shapes.size !== page.routingRows.length
    ) {
      setGeometry(null);
      return;
    }

    setGeometry({
      width: root.scrollWidth,
      height: root.scrollHeight,
      pelaksanaBounds,
      columns,
      gridLayout,
      shapes,
    });
  }, [page.routingRows.length, routingRowById]);

  useLayoutEffect(() => {
    measure();

    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [measure]);

  const manualRoutes = useMemo(
    () => resolveProcedurePageRouteOverrides(page.edges, diagramConfig),
    [diagramConfig, page.edges],
  );
  const routedEdges = useMemo(
    () =>
      geometry
        ? planFormalProcedureEdges(
            { rows: page.routingRows, edges: page.edges },
            geometry,
            manualRoutes,
            { pathLayoutSeed: diagramConfig.pathLayoutSeed ?? 0 },
          )
        : [],
    [
      diagramConfig.pathLayoutSeed,
      geometry,
      manualRoutes,
      page.edges,
      page.routingRows,
    ],
  );
  const routeSegmentsById = useMemo(
    () =>
      new Map(
        routedEdges.map(
          (edge) => [edge.id, formalPathToSegments(edge.points)] as const,
        ),
      ),
    [routedEdges],
  );

  const pageEdgeById = useMemo(
    () => new Map(page.edges.map((edge) => [edge.id, edge] as const)),
    [page.edges],
  );

  const updateManualPath = useCallback(
    (connectionId: string, route: FormalRouteChange) => {
      if (!onDiagramConfigChange) return;

      const edge = pageEdgeById.get(connectionId);
      if (!edge) return;

      const currentRoute = manualRoutes[connectionId];
      onDiagramConfigChange(
        setProcedurePageManualRoute(diagramConfig, edge, {
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
    [diagramConfig, manualRoutes, onDiagramConfigChange, pageEdgeById],
  );

  const resetManualPath = useCallback(
    (connectionId: string) => {
      if (!onDiagramConfigChange) return;

      const edge = pageEdgeById.get(connectionId);
      if (!edge) return;

      onDiagramConfigChange(
        removeProcedurePageManualRoute(diagramConfig, edge),
      );
    },
    [diagramConfig, onDiagramConfigChange, pageEdgeById],
  );

  const editingEnabled = manualEditing && onDiagramConfigChange !== undefined;

  const setShapeRef = useCallback(
    (shapeId: string, element: HTMLSpanElement | null) => {
      if (element) shapeRefs.current.set(shapeId, element);
      else shapeRefs.current.delete(shapeId);
    },
    [],
  );

  return (
    <section
      ref={rootRef}
      className={styles.page}
      data-sopflow-procedure-page={page.pageIndex}
      data-manual-editing={editingEnabled || undefined}
      aria-label={`Prosedur SOP halaman ${page.pageIndex + 1}`}
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
          <OpcTableRow
            endpoints={page.topOpc}
            position="top"
            model={model}
            totalColumns={totalColumns}
            setShapeRef={setShapeRef}
          />

          {page.rows.length === 0 ? (
            <tr>
              <td colSpan={totalColumns} className={styles.empty}>
                Belum ada langkah SOP.
              </td>
            </tr>
          ) : (
            page.rows.map((row) => {
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

          <OpcTableRow
            endpoints={page.bottomOpc}
            position="bottom"
            model={model}
            totalColumns={totalColumns}
            setShapeRef={setShapeRef}
          />
        </tbody>
      </table>

      {geometry && routedEdges.length > 0 ? (
        <svg
          className={styles.overlay}
          data-editing={editingEnabled || undefined}
          width={geometry.width}
          height={geometry.height}
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          aria-label={editingEnabled ? "Editor jalur flowchart SOP" : undefined}
          aria-hidden={editingEnabled ? undefined : true}
        >
          <defs>
            <marker
              id={`sopflow-procedure-arrow-${page.pageIndex}`}
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
            const sourceShape = geometry.shapes.get(edge.from);
            const targetShape = geometry.shapes.get(edge.to);
            const obstacles = [...geometry.shapes.values()]
              .filter(
                (shape) =>
                  shape.stepId !== edge.from && shape.stepId !== edge.to,
              )
              .map((shape) => shape.rect);
            const occupiedSegments = [...routeSegmentsById.entries()]
              .filter(([edgeId]) => edgeId !== edge.id)
              .flatMap(([, segments]) => segments);
            const pelaksanaBounds = geometry.pelaksanaBounds;
            const formalBounds = pelaksanaBounds
              ? {
                  left: pelaksanaBounds.left,
                  top: pelaksanaBounds.top,
                  width: pelaksanaBounds.right - pelaksanaBounds.left,
                  height: pelaksanaBounds.bottom - pelaksanaBounds.top,
                }
              : null;

            return (
              <g key={edge.id}>
                {editingEnabled ? (
                  <EditableFormalFlowchartPath
                    path={edge.points}
                    connectionId={edge.id}
                    selected={selected}
                    sourceSide={edge.sourceSide}
                    targetSide={edge.targetSide}
                    {...(sourceShape ? { sourceRect: sourceShape.rect } : {})}
                    {...(targetShape ? { targetRect: targetShape.rect } : {})}
                    sourceIsDiamond={sourceShape?.kind === "decision"}
                    targetIsDiamond={targetShape?.kind === "decision"}
                    obstacles={obstacles}
                    occupiedSegments={occupiedSegments}
                    routingBounds={formalBounds}
                    onSelect={setSelectedConnectionId}
                    onChange={(route) => updateManualPath(edge.id, route)}
                    onReset={() => resetManualPath(edge.id)}
                  />
                ) : null}

                <path
                  d={pointsToPath(edge.points)}
                  className={styles.edge}
                  data-selected={selected || undefined}
                  markerEnd={`url(#sopflow-procedure-arrow-${page.pageIndex})`}
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
              </g>
            );
          })}
        </svg>
      ) : null}
    </section>
  );
}

function OpcTableRow({
  endpoints,
  position,
  model,
  totalColumns,
  setShapeRef,
}: {
  endpoints: FormalProcedurePageModel["topOpc"];
  position: "top" | "bottom";
  model: ProcedureModel;
  totalColumns: number;
  setShapeRef: (shapeId: string, element: HTMLSpanElement | null) => void;
}) {
  if (endpoints.length === 0) return null;

  const byActor = new Map<string | null, typeof endpoints>();
  for (const endpoint of endpoints) {
    const actorId =
      endpoint.variant === "in"
        ? endpoint.opc.toActorId
        : endpoint.opc.fromActorId;
    const group = byActor.get(actorId) ?? [];
    byActor.set(actorId, [...group, endpoint]);
  }

  return (
    <tr className={styles.opcRow} data-sopflow-opc-row={position}>
      <td colSpan={2} />
      {model.actorColumns.map((actor, index) => {
        const endpointsForActor = byActor.get(actor.actorId) ?? [];
        return (
          <td
            key={actor.actorId ?? `fallback-${index}`}
            className={styles.actorCell}
            data-sopflow-actor-cell
            data-sopflow-actor-id={actor.actorId ?? "fallback"}
          >
            <div className={styles.opcStack}>
              {endpointsForActor.map((endpoint) => {
                const id =
                  endpoint.variant === "in"
                    ? endpoint.opc.opcInId
                    : endpoint.opc.opcOutId;
                return (
                  <span
                    key={id}
                    ref={(element) => setShapeRef(id, element)}
                    className={styles.opcAnchor}
                    data-sopflow-opc={id}
                    data-variant={endpoint.variant}
                    role="img"
                    aria-label={`Off-page connector ${endpoint.opc.letter}`}
                  >
                    <svg
                      width="50"
                      height="40"
                      viewBox="0 0 50 40"
                      aria-hidden="true"
                    >
                      <polygon points="2,2 48,2 48,27 25,38 2,27" />
                      <text x="25" y="20" textAnchor="middle">
                        {endpoint.opc.letter}
                      </text>
                    </svg>
                  </span>
                );
              })}
            </div>
          </td>
        );
      })}
      <td colSpan={Math.max(0, totalColumns - model.actorColumns.length - 2)} />
    </tr>
  );
}
