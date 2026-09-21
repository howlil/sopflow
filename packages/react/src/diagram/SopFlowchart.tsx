import {
  buildSopFlowchart,
  pointsToPath,
  type SopFlowchartNode,
  type SopFlowchartNodePlacement,
} from "@sopflow/diagram";
import type { SOPDocument, StepId } from "@sopflow/core";
import { useEffect, useId } from "react";

import "../styles/token.css";

import styles from "./SopFlowchart.module.css";
import { SopDiagramViewport } from "./SopDiagramViewport.js";

export interface SopFlowchartProps {
  document: SOPDocument;
  selectedStepId?: StepId | null;
  onSelectedStepChange?: (stepId: StepId | null) => void;
  fit?: boolean;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  pannable?: boolean;
  className?: string;
}

export function SopFlowchart({
  document,
  selectedStepId = null,
  onSelectedStepChange,
  fit = true,
  minZoom = 0.4,
  maxZoom = 1.75,
  zoomStep = 0.1,
  pannable = true,
  className,
}: SopFlowchartProps) {
  const flowchart = buildSopFlowchart(document);
  const arrowMarkerId = `sopflow-flowchart-arrow-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    if (!selectedStepId || !onSelectedStepChange) return;

    if (!document.steps.some((step) => step.id === selectedStepId)) {
      onSelectedStepChange(null);
    }
  }, [document.steps, onSelectedStepChange, selectedStepId]);

  if (flowchart.nodes.length === 0) {
    return (
      <div
        data-sopflow-root
        className={[styles.empty, className].filter(Boolean).join(" ")}
        role="status"
      >
        Belum ada flowchart SOP.
      </div>
    );
  }

  const renderSvg = (scale: number) => (
    <svg
      className={styles.svg}
      width={flowchart.width * scale}
      height={flowchart.height * scale}
      viewBox={`0 0 ${flowchart.width} ${flowchart.height}`}
      role="img"
      aria-label={`Flowchart SOP ${document.title}`}
      data-sopflow-flowchart
    >
      <defs>
        <marker
          id={arrowMarkerId}
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

      <g className={styles.grid}>
        {flowchart.lanes.map((lane) => (
          <g key={lane.actorId ?? "fallback"}>
            <rect
              x={lane.x}
              y={24}
              width={lane.width}
              height={flowchart.height - 48}
              className={styles.lane}
            />
            <rect
              x={lane.x}
              y={24}
              width={lane.width}
              height={flowchart.headerHeight}
              className={styles.laneHeader}
            />
            <text
              x={lane.x + lane.width / 2}
              y={24 + flowchart.headerHeight / 2}
              className={styles.laneLabel}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {lane.label}
            </text>
          </g>
        ))}

        {document.steps.map((step, row) => {
          const y = 24 + flowchart.headerHeight + row * flowchart.rowHeight;

          return (
            <line
              key={step.id}
              x1={flowchart.lanes[0]?.x ?? 24}
              x2={
                (flowchart.lanes.at(-1)?.x ?? 24) +
                (flowchart.lanes.at(-1)?.width ?? 0)
              }
              y1={y}
              y2={y}
              className={styles.rowLine}
            />
          );
        })}
      </g>

      <g className={styles.edges}>
        {flowchart.edges.map((edge) => (
          <g key={edge.id}>
            <path
              d={pointsToPath(edge.points)}
              className={styles.edge}
              data-kind={edge.kind}
              markerEnd={`url(#${arrowMarkerId})`}
            />
            {edge.label && edge.labelPosition ? (
              <text
                x={edge.labelPosition.x}
                y={edge.labelPosition.y}
                className={styles.edgeLabel}
                textAnchor="middle"
              >
                {edge.label}
              </text>
            ) : null}
          </g>
        ))}
      </g>

      <g className={styles.nodes}>
        {flowchart.nodes.map((node) =>
          node.placements.map((placement, placementIndex) => {
            const primary = placementIndex === 0;
            const selected = selectedStepId === node.id;

            if (!primary) {
              return (
                <g
                  key={`${node.id}-${placement.actorId ?? placementIndex}`}
                  className={styles.node}
                  data-kind={node.kind}
                  data-selected={selected || undefined}
                >
                  <FlowchartShape node={node} placement={placement} />
                </g>
              );
            }

            return (
              // biome-ignore lint/a11y/useSemanticElements: SVG group is the interactive flowchart node.
              <g
                key={`${node.id}-primary`}
                className={styles.node}
                data-kind={node.kind}
                data-selected={selected || undefined}
                data-sopflow-diagram-interactive
                data-sopflow-step-id={node.id}
                tabIndex={0}
                role="button"
                aria-pressed={selected}
                aria-label={`${node.label || "Langkah"} (${node.kind})`}
                onClick={() => onSelectedStepChange?.(node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectedStepChange?.(node.id);
                  }
                }}
              >
                <FlowchartShape node={node} placement={placement} />
                <text
                  x={placement.x}
                  y={placement.y + node.height / 2 + 16}
                  className={styles.nodeLabel}
                  textAnchor="middle"
                >
                  {node.label}
                </text>
              </g>
            );
          }),
        )}
      </g>
    </svg>
  );

  if (!fit) {
    return (
      <div
        data-sopflow-root
        className={[styles.root, className].filter(Boolean).join(" ")}
      >
        {renderSvg(1)}
      </div>
    );
  }

  return (
    <SopDiagramViewport
      width={flowchart.width}
      height={flowchart.height}
      minZoom={minZoom}
      maxZoom={maxZoom}
      zoomStep={zoomStep}
      pannable={pannable}
      {...(className ? { className } : {})}
    >
      {renderSvg}
    </SopDiagramViewport>
  );
}

function FlowchartShape({
  node,
  placement,
}: {
  node: SopFlowchartNode;
  placement: SopFlowchartNodePlacement;
}) {
  const x = placement.x - node.width / 2;
  const y = placement.y - node.height / 2;

  if (node.kind === "decision") {
    return (
      <polygon
        points={`${placement.x},${y} ${x + node.width},${placement.y} ${placement.x},${y + node.height} ${x},${placement.y}`}
        className={styles.nodeShape}
      />
    );
  }

  return (
    <rect
      x={x}
      y={y}
      width={node.width}
      height={node.height}
      rx={node.kind === "start" || node.kind === "end" ? node.height / 2 : 2}
      className={styles.nodeShape}
    />
  );
}
