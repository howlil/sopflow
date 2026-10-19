import type { StepId, ValidationIssue } from "@sopflow/core";
import {
  formalPathToSegments,
  formalOpcStackTopPx,
  layoutFormalOpcEndpoints,
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
import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ProcedureShape,
  toLocalRect,
  measurePelaksanaBounds,
  measureActorColumns,
  measureGridLayout,
  display,
  durationLabel,
  buildProcedureAnnotations,
  procedureColumnWidths,
} from "./procedureShared.js";
import { EditableFormalFlowchartPath } from "../EditableFormalFlowchartPath.js";
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
  const [actorCenters, setActorCenters] = useState<
    Readonly<Record<string, number>>
  >({});
  const [geometry, setGeometry] = useState<FormalFlowchartGeometry | null>(
    null,
  );
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const columnWidths = procedureColumnWidths(model.actorColumns.length);
  const markerId = `sopflow-procedure-arrow-${useId().replace(/:/g, "")}`;
  const totalColumns = model.actorColumns.length + 6;
  const annotations = useMemo(
    () => buildProcedureAnnotations(model, issues),
    [model, issues],
  );
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

    // Table headers are the source of truth for actor-column X coordinates.
    // The outside-table OPC strips share the page coordinate space, but cannot
    // contribute fake <td> elements to those measurements.
    const nextCenters: Record<string, number> = {};
    for (const header of root.querySelectorAll<HTMLElement>(
      "[data-sopflow-actor-header]",
    )) {
      const id = header.dataset.sopflowActorId;
      if (!id) continue;
      const bounds = header.getBoundingClientRect();
      nextCenters[id] = Math.round(
        (bounds.left + bounds.right) / 2 - rootRect.left,
      );
    }
    setActorCenters((current) =>
      Object.keys(nextCenters).length === Object.keys(current).length &&
      Object.entries(nextCenters).every(
        ([id, x]) => Math.abs((current[id] ?? -9999) - x) <= 1,
      )
        ? current
        : nextCenters,
    );

    if (
      !pelaksanaBounds ||
      pelaksanaBounds.right <= pelaksanaBounds.left ||
      shapes.size !== page.routingRows.length
    ) {
      setGeometry(null);
      return;
    }

    const opcRects = [...shapes.values()]
      .filter((shape) => shape.kind === "opc")
      .map((shape) => shape.rect);
    const routingBounds = {
      ...pelaksanaBounds,
      // Routing must reach OPC anchors OUTSIDE the table body.
      top: Math.min(pelaksanaBounds.top, ...opcRects.map((rect) => rect.top)),
      bottom: Math.max(
        pelaksanaBounds.bottom,
        ...opcRects.map((rect) => rect.top + rect.height),
      ),
    };
    setGeometry({
      width: root.scrollWidth,
      height: root.scrollHeight,
      pelaksanaBounds: routingBounds,
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
      <OpcStrip
        endpoints={page.topOpc}
        position="top"
        model={model}
        columnWidths={columnWidths}
        actorCenters={actorCenters}
        setShapeRef={setShapeRef}
      />
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: columnWidths.number }} />
          <col style={{ width: columnWidths.activity }} />
          {model.actorColumns.map((actor, index) => (
            <col
              key={actor.actorId ?? `fallback-${index}`}
              style={{ width: columnWidths.actor }}
            />
          ))}
          <col style={{ width: columnWidths.input }} />
          <col style={{ width: columnWidths.duration }} />
          <col style={{ width: columnWidths.output }} />
          <col style={{ width: columnWidths.note }} />
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
          {page.rows.length === 0 ? (
            <tr>
              <td colSpan={totalColumns} className={styles.empty}>
                Belum ada langkah SOP.
              </td>
            </tr>
          ) : (
            page.rows.map((row) => {
              const selected = selectedStepId === row.stepId;
              const issueCount = annotations.issueCounts.get(row.stepId) ?? 0;

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
                          <span>
                            {annotations.decisionLabels.get(row.stepId)}
                          </span>
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
      <OpcStrip
        endpoints={page.bottomOpc}
        position="bottom"
        model={model}
        columnWidths={columnWidths}
        actorCenters={actorCenters}
        setShapeRef={setShapeRef}
      />

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
              id={markerId}
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
            const obstacles = editingEnabled
              ? [...geometry.shapes.values()]
                  .filter(
                    (shape) =>
                      shape.stepId !== edge.from && shape.stepId !== edge.to,
                  )
                  .map((shape) => shape.rect)
              : [];
            const occupiedSegments = editingEnabled
              ? [...routeSegmentsById.entries()]
                  .filter(([edgeId]) => edgeId !== edge.id)
                  .flatMap(([, segments]) => segments)
              : [];
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
                  markerEnd={`url(#${markerId})`}
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

/** OPCs are page-local routing anchors, never procedure-table rows. */
function OpcStrip({
  endpoints,
  position,
  model,
  columnWidths,
  actorCenters,
  setShapeRef,
}: {
  endpoints: FormalProcedurePageModel["topOpc"];
  position: "top" | "bottom";
  model: ProcedureModel;
  columnWidths: ReturnType<typeof procedureColumnWidths>;
  actorCenters: Readonly<Record<string, number>>;
  setShapeRef: (shapeId: string, element: HTMLSpanElement | null) => void;
}) {
  const placements = layoutFormalOpcEndpoints(endpoints, {
    actors: model.actorColumns.map((actor) => ({ id: actor.actorId })),
    tableColumns: {
      // Use the exact normalized colgroup percentages, not the raw SOP
      // template's 5/25/% values (which can shift with actor count).
      noColPercent: Number.parseFloat(columnWidths.number),
      kegiatanPercent: Number.parseFloat(columnWidths.activity),
      pelaksanaColPercent: Number.parseFloat(columnWidths.actor),
    },
  });
  if (placements.length === 0) return null;

  const maxStack = Math.max(
    ...placements.map((placement) => placement.stackIndex),
  );
  const height = formalOpcStackTopPx(maxStack) + 60 + 16;

  return (
    <div
      className={styles.opcStrip}
      data-sopflow-opc-strip={position}
      style={{ height }}
    >
      {placements.map((placement) => {
        const actorKey = placement.actorId ?? "fallback";
        // Prefer DOM-measured column center; percentage is first-render fallback.
        const x = actorCenters[actorKey];
        return (
          <span
            key={placement.elementId}
            ref={(element) => setShapeRef(placement.elementId, element)}
            className={styles.opcAnchor}
            data-sopflow-opc={placement.elementId}
            data-sopflow-opc-actor-id={actorKey}
            data-variant={
              endpoints.find(
                (candidate) =>
                  (candidate.variant === "in"
                    ? candidate.opc.opcInId
                    : candidate.opc.opcOutId) === placement.elementId,
              )?.variant
            }
            role="img"
            aria-label={`Off-page connector ${placement.opc.letter}`}
            style={{
              position: "absolute",
              left: x === undefined ? `${placement.centerPercent}%` : x,
              top: formalOpcStackTopPx(placement.stackIndex) + 8,
              transform: "translateX(-50%)",
            }}
          >
            <svg width="50" height="40" viewBox="0 0 50 40" aria-hidden="true">
              <polygon points="2,2 48,2 48,27 25,38 2,27" />
              <text x="25" y="20" textAnchor="middle">
                {placement.opc.letter}
              </text>
            </svg>
          </span>
        );
      })}
    </div>
  );
}
