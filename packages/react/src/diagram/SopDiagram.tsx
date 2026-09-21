import {
  buildDiagram,
  getDiamondPoints,
  type SvgNodeModel,
} from "@sopflow/diagram";
import type { SOPDocument, StepId } from "@sopflow/core";
import { useEffect, useId } from "react";

import "../styles/token.css";

import styles from "./SopDiagram.module.css";
import { SopDiagramViewport } from "./SopDiagramViewport.js";

export interface SopDiagramProps {
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

export function SopDiagram({
  document,
  selectedStepId = null,
  onSelectedStepChange,
  fit = true,
  minZoom = 0.4,
  maxZoom = 1.75,
  zoomStep = 0.1,
  pannable = true,
  className,
}: SopDiagramProps) {
  const diagram = buildDiagram(document);
  const arrowMarkerId = `sopflow-arrow-${useId().replace(/:/g, "")}`;
  const safeMinZoom = Number.isFinite(minZoom) ? minZoom : 0.4;
  const safeMaxZoom = Number.isFinite(maxZoom) ? maxZoom : 1.75;
  const resolvedMinZoom = Math.max(0.1, Math.min(safeMinZoom, safeMaxZoom));
  const resolvedMaxZoom = Math.max(resolvedMinZoom, safeMaxZoom);
  const resolvedZoomStep = Number.isFinite(zoomStep)
    ? Math.max(0.05, zoomStep)
    : 0.1;

  useEffect(() => {
    if (!selectedStepId || !onSelectedStepChange) {
      return;
    }

    const exists = document.steps.some((step) => step.id === selectedStepId);

    if (!exists) {
      onSelectedStepChange(null);
    }
  }, [document.steps, onSelectedStepChange, selectedStepId]);

  if (diagram.nodes.length === 0) {
    return (
      <div
        data-sopflow-root
        className={[styles.empty, className].filter(Boolean).join(" ")}
        role="status"
      >
        Belum ada diagram SOP.
      </div>
    );
  }

  const renderSvg = (scale: number) => (
    <svg
      className={styles.svg}
      width={diagram.width * scale}
      height={diagram.height * scale}
      viewBox={`0 0 ${diagram.width} ${diagram.height}`}
      role="img"
      aria-label={`Diagram SOP ${document.title}`}
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

      <g className={styles.edges}>
        {diagram.edges.map((edge) => (
          <g key={edge.id}>
            <path
              d={edge.path}
              className={styles.edge}
              data-kind={edge.kind}
              markerEnd={`url(#${arrowMarkerId})`}
            />
            {edge.label && edge.labelPosition ? (
              <text
                x={edge.labelPosition.x}
                y={edge.labelPosition.y - 6}
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
        {diagram.nodes.map((node) => {
          const selected = selectedStepId === node.id;

          return (
            // biome-ignore lint/a11y/useSemanticElements: SVG groups are the interactive node surface.
            <g
              key={node.id}
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
              <NodeShape node={node} />
              <NodeLabel node={node} />
            </g>
          );
        })}
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
      width={diagram.width}
      height={diagram.height}
      minZoom={resolvedMinZoom}
      maxZoom={resolvedMaxZoom}
      zoomStep={resolvedZoomStep}
      pannable={pannable}
      {...(className ? { className } : {})}
    >
      {renderSvg}
    </SopDiagramViewport>
  );
}

function NodeShape({ node }: { node: SvgNodeModel }) {
  if (node.shape === "diamond") {
    return (
      <polygon
        points={getDiamondPoints(node.x, node.y, node.width, node.height)}
        className={styles.nodeShape}
      />
    );
  }

  return (
    <rect
      x={node.x}
      y={node.y}
      width={node.width}
      height={node.height}
      rx={node.shape === "rounded" ? node.height / 2 : 4}
      className={styles.nodeShape}
    />
  );
}

function NodeLabel({ node }: { node: SvgNodeModel }) {
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  const totalHeight = (node.lines.length - 1) * node.lineHeight;
  const startY = centerY - totalHeight / 2;

  return (
    <text className={styles.nodeLabel} textAnchor="middle" pointerEvents="none">
      {node.lines.map((line, index) => (
        <tspan
          // biome-ignore lint/suspicious/noArrayIndexKey: text lines have no state and duplicate lines need positional identity.
          key={`${line}-${index}`}
          x={centerX}
          y={startY + index * node.lineHeight}
          dominantBaseline="middle"
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}
