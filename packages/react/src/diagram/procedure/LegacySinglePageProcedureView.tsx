import type { StepId } from "@sopflow/core";
import {
  buildProcedureModel,
  formalPathToSegments,
  pointsToPath,
  removeProcedureManualRoute,
  routeProcedureEdges,
  setProcedureManualRoute,
  updateProcedureManualTrunk,
  type FormalFlowchartGeometry,
  type FormalFlowchartShapeGeometry,
  type FormalRouteChange,
  type ProcedureGeometry,
  type ProcedureLaneGeometry,
  type ProcedureNodeGeometry,
  type SopDiagramConfig,
} from "@sopflow/diagram";
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
import type { SopManualPathOffsets, SopProcedureViewProps } from "./SopProcedureView.js";
import styles from "./SopProcedureView.module.css";

export function LegacySinglePageSopProcedureView({
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
        routedEdges.map(
          (edge) => [edge.id, formalPathToSegments(edge.points)] as const,
        ),
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

  const columnWidths = procedureColumnWidths(model.actorColumns.length);
  const markerId = `sopflow-procedure-arrow-${useId().replace(/:/g, "")}`;
  const totalColumns = model.actorColumns.length + 6;
  const annotations = useMemo(
    () => buildProcedureAnnotations(model, issues),
    [model, issues],
  );

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
          {model.rows.length === 0 ? (
            <tr>
              <td colSpan={totalColumns} className={styles.empty}>
                Belum ada langkah SOP.
              </td>
            </tr>
          ) : (
            model.rows.map((row) => {
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
                  markerEnd={`url(#${markerId})`}
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
