import type { ActorId, SOPDocument, StepId } from "@sopflow/core";
import type { DiagramPoint } from "./types.js";
import {
  projectWorkflow,
  type WorkflowEdge,
} from "./workflow.js";

export interface BpmnLayoutOptions {
  readonly laneHeight?: number;
  readonly headerWidth?: number;
  readonly stepGap?: number;
  readonly padding?: number;
}

export interface BpmnLane {
  readonly actorId: ActorId | null;
  readonly label: string;
  readonly index: number;
  readonly y: number;
  readonly height: number;
}

export interface BpmnNode {
  readonly id: StepId;
  readonly kind: "start" | "task" | "decision" | "end";
  readonly label: string;
  readonly laneIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BpmnRoutedEdge extends WorkflowEdge {
  readonly points: readonly DiagramPoint[];
  readonly labelPosition?: DiagramPoint;
}

export interface BpmnModel {
  readonly lanes: readonly BpmnLane[];
  readonly nodes: readonly BpmnNode[];
  readonly edges: readonly BpmnRoutedEdge[];
  readonly width: number;
  readonly height: number;
  readonly padding: number;
  readonly headerWidth: number;
  readonly laneHeight: number;
}

const DEFAULTS: Required<BpmnLayoutOptions> = {
  laneHeight: 112,
  headerWidth: 116,
  stepGap: 144,
  padding: 24,
};

export function buildBpmnModel(
  document: SOPDocument,
  options: BpmnLayoutOptions = {},
): BpmnModel {
  const config = {
    laneHeight: positive(options.laneHeight, DEFAULTS.laneHeight),
    headerWidth: positive(options.headerWidth, DEFAULTS.headerWidth),
    stepGap: positive(options.stepGap, DEFAULTS.stepGap),
    padding: nonNegative(options.padding, DEFAULTS.padding),
  };
  const graph = projectWorkflow(document);
  const actorIndex = new Map(
    document.actors.map((actor, index) => [actor.id, index] as const),
  );
  const laneCount = Math.max(1, document.actors.length);
  const lanes: BpmnLane[] = Array.from({ length: laneCount }, (_, index) => {
    const actor = document.actors[index];

    return {
      actorId: actor?.id ?? null,
      label: actor?.name ?? "Pelaksana",
      index,
      y: config.padding + index * config.laneHeight,
      height: config.laneHeight,
    };
  });
  const width =
    config.headerWidth +
    config.padding * 2 +
    Math.max(1, document.steps.length) * config.stepGap;
  const height = config.padding * 2 + laneCount * config.laneHeight;

  const stepById = new Map(document.steps.map((step) => [step.id, step]));
  const nodes = graph.nodes.flatMap<BpmnNode>((node, index) => {
    const step = stepById.get(node.id);
    if (!step) return [];

    const firstActorId = step.actorIds[0];
    const laneIndex = firstActorId ? (actorIndex.get(firstActorId) ?? 0) : 0;
    const size = nodeSize(node.kind);

    return [
      {
        id: node.id,
        kind: node.kind,
        label: node.label,
        laneIndex,
        x:
          config.headerWidth +
          config.padding +
          index * config.stepGap +
          config.stepGap / 2,
        y:
          config.padding +
          laneIndex * config.laneHeight +
          config.laneHeight / 2,
        ...size,
      },
    ];
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const edges = graph.edges.flatMap<BpmnRoutedEdge>((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) return [];

    const start = {
      x: from.x + from.width / 2,
      y: from.y,
    };
    const end = {
      x: to.x - to.width / 2,
      y: to.y,
    };
    const midX = start.x + (end.x - start.x) / 2;

    return [
      {
        ...edge,
        points: compactOrthogonalPoints([
          start,
          { x: midX, y: start.y },
          { x: midX, y: end.y },
          end,
        ]),
        ...(edge.label
          ? {
              labelPosition: {
                x: midX + 4,
                y: (start.y + end.y) / 2 - 4,
              },
            }
          : {}),
      },
    ];
  });

  return {
    lanes,
    nodes,
    edges,
    width,
    height,
    padding: config.padding,
    headerWidth: config.headerWidth,
    laneHeight: config.laneHeight,
  };
}

function nodeSize(kind: BpmnNode["kind"]): {
  readonly width: number;
  readonly height: number;
} {
  if (kind === "decision") return { width: 48, height: 48 };
  if (kind === "start" || kind === "end") return { width: 38, height: 38 };
  return { width: 96, height: 48 };
}

function compactOrthogonalPoints(
  points: readonly DiagramPoint[],
): DiagramPoint[] {
  const result: DiagramPoint[] = [];

  for (const point of points) {
    const previous = result.at(-1);
    if (previous?.x === point.x && previous.y === point.y) continue;
    result.push({ x: point.x, y: point.y });
  }

  return result;
}

function positive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0
    ? (value as number)
    : fallback;
}

function nonNegative(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? -1) >= 0
    ? (value as number)
    : fallback;
}
