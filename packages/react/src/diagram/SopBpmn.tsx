import type { SOPDocument, StepId } from "@sopflow/core";
import {
  buildBpmnModel,
  formalPathToSegments,
  pointsToPath,
  removeProcedureManualRoute,
  setProcedureManualRoute,
  type BpmnNode,
  type DiagramRect,
  type SopDiagramConfig,
} from "@sopflow/diagram";
import { useEffect, useId, useMemo, useState } from "react";

import "../styles/token.css";
import { EditableFormalFlowchartPath } from "./EditableFormalFlowchartPath.js";
import styles from "./SopBpmn.module.css";

export interface SopBpmnProps {
  document: SOPDocument;
  selectedStepId?: StepId | null;
  onSelectedStepChange?: (stepId: StepId | null) => void;
  diagramConfig?: SopDiagramConfig;
  onDiagramConfigChange?: (config: SopDiagramConfig) => void;
  manualEditing?: boolean;
  className?: string;
}

export function SopBpmn({
  document,
  selectedStepId = null,
  onSelectedStepChange,
  diagramConfig = {},
  onDiagramConfigChange,
  manualEditing = false,
  className,
}: SopBpmnProps) {
  const markerId = `sopflow-bpmn-arrow-${useId().replace(/:/g, "")}`;
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(
    null,
  );
  const model = useMemo(
    () => buildBpmnModel(document, { diagramConfig }),
    [diagramConfig, document],
  );
  const nodeById = useMemo(
    () => new Map(model.nodes.map((node) => [node.id, node] as const)),
    [model.nodes],
  );
  const routeSegmentsById = useMemo(
    () =>
      new Map(
        model.edges.map(
          (edge) => [edge.id, formalPathToSegments(edge.points)] as const,
        ),
      ),
    [model.edges],
  );

  useEffect(() => {
    if (!manualEditing) setSelectedConnectionId(null);
  }, [manualEditing]);

  const changeRoute = (
    edgeId: string,
    route: Parameters<
      NonNullable<
        React.ComponentProps<typeof EditableFormalFlowchartPath>["onChange"]
      >
    >[0],
  ) => {
    if (!onDiagramConfigChange) return;
    const currentRoute = diagramConfig.routes?.[edgeId];
    onDiagramConfigChange(
      setProcedureManualRoute(diagramConfig, edgeId, {
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
  };

  const resetRoute = (edgeId: string) => {
    if (!onDiagramConfigChange) return;
    onDiagramConfigChange(removeProcedureManualRoute(diagramConfig, edgeId));
  };

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-sopflow-root
      data-sopflow-bpmn
      aria-label="BPMN SOP"
    >
      <svg
        className={styles.svg}
        viewBox={`0 0 ${model.width} ${model.height}`}
        role="img"
        aria-label={`BPMN SOP ${document.title}`}
      >
        <defs>
          <marker
            id={markerId}
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 8 4 L 0 8 Z" className={styles.arrow} />
          </marker>
        </defs>

        {model.lanes.map((lane) => (
          <g key={lane.actorId ?? `lane-${lane.index}`}>
            <rect
              x={model.padding}
              y={lane.y}
              width={model.width - model.padding * 2}
              height={lane.height}
              className={styles.lane}
            />
            <rect
              x={model.padding}
              y={lane.y}
              width={model.headerWidth}
              height={lane.height}
              className={styles.laneHeader}
            />
            <text
              x={model.padding + model.headerWidth / 2}
              y={lane.y + lane.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className={styles.laneLabel}
            >
              {lane.label}
            </text>
          </g>
        ))}

        <g className={styles.edges}>
          {model.edges.map((edge) => (
            <g key={edge.id}>
              <path
                d={pointsToPath(edge.points)}
                className={styles.edge}
                markerEnd={`url(#${markerId})`}
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
              {manualEditing && onDiagramConfigChange ? (
                <EditableFormalFlowchartPath
                  path={edge.points}
                  connectionId={edge.id}
                  selected={selectedConnectionId === edge.id}
                  sourceSide={edge.sourceSide}
                  targetSide={edge.targetSide}
                  sourceRect={bpmnNodeRect(nodeById.get(edge.from))}
                  targetRect={bpmnNodeRect(nodeById.get(edge.to))}
                  sourceIsDiamond={nodeById.get(edge.from)?.kind === "decision"}
                  targetIsDiamond={nodeById.get(edge.to)?.kind === "decision"}
                  obstacles={model.nodes
                    .filter(
                      (node) => node.id !== edge.from && node.id !== edge.to,
                    )
                    .map((node) => bpmnNodeRect(node))
                    .filter((rect): rect is DiagramRect => rect !== undefined)}
                  occupiedSegments={model.edges
                    .filter((candidate) => candidate.id !== edge.id)
                    .flatMap(
                      (candidate) => routeSegmentsById.get(candidate.id) ?? [],
                    )}
                  routingBounds={{
                    left: 0,
                    top: 0,
                    width: model.width,
                    height: model.height,
                  }}
                  onSelect={setSelectedConnectionId}
                  onChange={(route) => changeRoute(edge.id, route)}
                  onReset={() => resetRoute(edge.id)}
                />
              ) : null}
            </g>
          ))}
        </g>

        <g className={styles.nodes}>
          {model.nodes.map((node) => {
            const selected = selectedStepId === node.id;

            return (
              // biome-ignore lint/a11y/useSemanticElements: interactive BPMN nodes are SVG groups.
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`${node.label} (${node.kind})`}
                data-selected={selected || undefined}
                data-sopflow-diagram-interactive
                data-sopflow-step-id={node.id}
                className={styles.node}
                onClick={() => onSelectedStepChange?.(node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectedStepChange?.(node.id);
                  }
                }}
              >
                <BpmnShape node={node} />
                <BpmnNodeLabel node={node} />
              </g>
            );
          })}
        </g>
      </svg>
    </section>
  );
}

function bpmnNodeRect(node: BpmnNode | undefined): DiagramRect | undefined {
  if (!node) return undefined;
  return {
    left: node.x - node.width / 2,
    top: node.y - node.height / 2,
    width: node.width,
    height: node.height,
  };
}

function BpmnShape({ node }: { node: BpmnNode }) {
  const x = node.x - node.width / 2;
  const y = node.y - node.height / 2;

  if (node.kind === "decision") {
    return (
      <>
        <polygon
          points={`${node.x},${y} ${x + node.width},${node.y} ${node.x},${y + node.height} ${x},${node.y}`}
          className={styles.nodeShape}
        />
        <path
          d={`M ${node.x - 8} ${node.y - 8} L ${node.x + 8} ${node.y + 8} M ${node.x + 8} ${node.y - 8} L ${node.x - 8} ${node.y + 8}`}
          className={styles.gatewayMark}
        />
      </>
    );
  }

  if (node.kind === "start" || node.kind === "end") {
    return (
      <>
        <circle
          cx={node.x}
          cy={node.y}
          r={node.width / 2}
          className={styles.nodeShape}
        />
        {node.kind === "end" ? (
          <circle
            cx={node.x}
            cy={node.y}
            r={node.width / 2 - 4}
            className={styles.endRing}
          />
        ) : null}
      </>
    );
  }

  return (
    <rect
      x={x}
      y={y}
      width={node.width}
      height={node.height}
      rx={8}
      className={styles.nodeShape}
    />
  );
}

function BpmnNodeLabel({ node }: { node: BpmnNode }) {
  const insideTask = node.kind === "task";
  const firstY = insideTask
    ? node.y - ((node.labelLines.length - 1) * node.labelLineHeight) / 2 + 4
    : node.y + node.height / 2 + 16;
  const occurrences = new Map<string, number>();
  const labelLines = node.labelLines.map((line, index) => {
    const occurrence = (occurrences.get(line) ?? 0) + 1;
    occurrences.set(line, occurrence);

    return {
      line,
      key: `${node.id}:${line}:${occurrence}`,
      first: index === 0,
    };
  });

  return (
    <text
      x={node.x}
      y={firstY}
      textAnchor="middle"
      className={styles.nodeLabel}
    >
      {labelLines.map(({ line, key, first }) => (
        <tspan key={key} x={node.x} dy={first ? 0 : node.labelLineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}
