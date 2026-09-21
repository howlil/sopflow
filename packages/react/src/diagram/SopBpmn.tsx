import type { SOPDocument, Step, StepId } from "@sopflow/core";
import { useMemo, useId } from "react";

import "../styles/token.css";
import styles from "./SopBpmn.module.css";

export interface SopBpmnProps {
  document: SOPDocument;
  selectedStepId?: StepId | null;
  onSelectedStepChange?: (stepId: StepId | null) => void;
  className?: string;
}

interface BpmnNode {
  step: Step;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function SopBpmn({
  document,
  selectedStepId = null,
  onSelectedStepChange,
  className,
}: SopBpmnProps) {
  const markerId = `sopflow-bpmn-arrow-${useId().replace(/:/g, "")}`;
  const actorIndex = useMemo(
    () => new Map(document.actors.map((actor, index) => [actor.id, index])),
    [document.actors],
  );

  const laneCount = Math.max(1, document.actors.length);
  const laneHeight = 112;
  const headerWidth = 116;
  const stepGap = 144;
  const padding = 24;
  const width =
    headerWidth + padding * 2 + Math.max(1, document.steps.length) * stepGap;
  const height = padding * 2 + laneCount * laneHeight;

  const nodes = document.steps.map<BpmnNode>((step, index) => {
    const firstActorId = step.actorIds[0];
    const lane = firstActorId ? actorIndex.get(firstActorId) ?? 0 : 0;
    const size =
      step.type === "decision"
        ? { width: 48, height: 48 }
        : step.type === "start" || step.type === "end"
          ? { width: 38, height: 38 }
          : { width: 96, height: 48 };

    return {
      step,
      x: headerWidth + padding + index * stepGap + stepGap / 2,
      y: padding + lane * laneHeight + laneHeight / 2,
      ...size,
    };
  });

  const nodeById = new Map(nodes.map((node) => [node.step.id, node]));
  const edges = document.steps.flatMap((step) => {
    if (step.type === "end") return [];
    if (step.type === "decision") {
      return [
        { id: `${step.id}:yes`, from: step.id, to: step.yes, label: "Ya" },
        { id: `${step.id}:no`, from: step.id, to: step.no, label: "Tidak" },
      ];
    }

    return [{ id: `${step.id}:next`, from: step.id, to: step.next }];
  });

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-sopflow-root
      data-sopflow-bpmn
      aria-label="BPMN SOP"
    >
      <svg
        className={styles.svg}
        viewBox={`0 0 ${width} ${height}`}
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

        {Array.from({ length: laneCount }, (_, index) => {
          const y = padding + index * laneHeight;
          const actor = document.actors[index];

          return (
            <g key={actor?.id ?? `lane-${index}`}>
              <rect
                x={padding}
                y={y}
                width={width - padding * 2}
                height={laneHeight}
                className={styles.lane}
              />
              <rect
                x={padding}
                y={y}
                width={headerWidth}
                height={laneHeight}
                className={styles.laneHeader}
              />
              <text
                x={padding + headerWidth / 2}
                y={y + laneHeight / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                className={styles.laneLabel}
              >
                {actor?.name ?? "Pelaksana"}
              </text>
            </g>
          );
        })}

        <g className={styles.edges}>
          {edges.map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;

            const start = {
              x: from.x + from.width / 2,
              y: from.y,
            };
            const end = {
              x: to.x - to.width / 2,
              y: to.y,
            };
            const midX = start.x + (end.x - start.x) / 2;
            const d = `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;

            return (
              <g key={edge.id}>
                <path
                  d={d}
                  className={styles.edge}
                  markerEnd={`url(#${markerId})`}
                />
                {"label" in edge && edge.label ? (
                  <text
                    x={midX + 4}
                    y={(start.y + end.y) / 2 - 4}
                    className={styles.edgeLabel}
                  >
                    {edge.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>

        <g className={styles.nodes}>
          {nodes.map((node) => {
            const selected = selectedStepId === node.step.id;

            return (
              // biome-ignore lint/a11y/useSemanticElements: interactive BPMN nodes are SVG groups.
              <g
                key={node.step.id}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`${node.step.name} (${node.step.type})`}
                data-selected={selected || undefined}
                data-sopflow-diagram-interactive
                data-sopflow-step-id={node.step.id}
                className={styles.node}
                onClick={() => onSelectedStepChange?.(node.step.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectedStepChange?.(node.step.id);
                  }
                }}
              >
                <BpmnShape node={node} />
                {node.step.type === "task" ? (
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    className={styles.nodeLabel}
                  >
                    {shortLabel(node.step.name)}
                  </text>
                ) : (
                  <text
                    x={node.x}
                    y={node.y + node.height / 2 + 16}
                    textAnchor="middle"
                    className={styles.nodeLabel}
                  >
                    {shortLabel(node.step.name)}
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

  if (node.step.type === "decision") {
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

  if (node.step.type === "start" || node.step.type === "end") {
    return (
      <>
        <circle
          cx={node.x}
          cy={node.y}
          r={node.width / 2}
          className={styles.nodeShape}
        />
        {node.step.type === "end" ? (
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
