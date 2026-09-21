import type { SOPDocument, StepId } from "@sopflow/core";
import {
  buildBpmnModel,
  pointsToPath,
  type BpmnNode,
} from "@sopflow/diagram";
import { useId, useMemo } from "react";

import "../styles/token.css";
import styles from "./SopBpmn.module.css";

export interface SopBpmnProps {
  document: SOPDocument;
  selectedStepId?: StepId | null;
  onSelectedStepChange?: (stepId: StepId | null) => void;
  className?: string;
}

export function SopBpmn({
  document,
  selectedStepId = null,
  onSelectedStepChange,
  className,
}: SopBpmnProps) {
  const markerId = `sopflow-bpmn-arrow-${useId().replace(/:/g, "")}`;
  const model = useMemo(() => buildBpmnModel(document), [document]);

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
                {node.kind === "task" ? (
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    className={styles.nodeLabel}
                  >
                    {shortLabel(node.label)}
                  </text>
                ) : (
                  <text
                    x={node.x}
                    y={node.y + node.height / 2 + 16}
                    textAnchor="middle"
                    className={styles.nodeLabel}
                  >
                    {shortLabel(node.label)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </section>
  );
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

function shortLabel(value: string): string {
  return value.length > 18 ? `${value.slice(0, 17)}…` : value;
}
