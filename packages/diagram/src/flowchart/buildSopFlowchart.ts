import type { SOPDocument, Step } from "@sopflow/core";
import { routeDiagramEdges } from "../routeEdges.js";
import { projectWorkflow } from "../workflow.js";
import type { DiagramModel } from "../types.js";
import type {
  SopFlowchartEdge,
  SopFlowchartLane,
  SopFlowchartModel,
  SopFlowchartNode,
  SopFlowchartNodePlacement,
} from "./types.js";

export interface BuildSopFlowchartOptions {
  laneWidth?: number;
  rowHeight?: number;
  headerHeight?: number;
  padding?: number;
  nodeWidth?: number;
  nodeHeight?: number;
}

const DEFAULTS: Required<BuildSopFlowchartOptions> = {
  laneWidth: 180,
  rowHeight: 96,
  headerHeight: 56,
  padding: 24,
  nodeWidth: 84,
  nodeHeight: 36,
};

export function buildSopFlowchart(
  document: SOPDocument,
  options: BuildSopFlowchartOptions = {},
): SopFlowchartModel {
  const config = resolveOptions(options);
  const graph = projectWorkflow(document);
  const stepById = new Map(
    document.steps.map((step) => [step.id, step] as const),
  );
  const orderByStepId = new Map(
    graph.nodes.map((node, index) => [node.id, index] as const),
  );
  const actorList =
    document.actors.length > 0
      ? document.actors.map((actor) => ({
          actorId: actor.id,
          label: actor.name,
        }))
      : [{ actorId: null, label: "Pelaksana" }];

  const lanes: SopFlowchartLane[] = actorList.map((actor, index) => ({
    actorId: actor.actorId,
    label: actor.label,
    x: config.padding + index * config.laneWidth,
    width: config.laneWidth,
  }));

  const laneByActorId = new Map(
    lanes
      .filter((lane) => lane.actorId !== null)
      .map((lane) => [lane.actorId as string, lane]),
  );
  const fallbackLane = lanes[0];

  const nodes = graph.nodes.flatMap<SopFlowchartNode>((workflowNode, row) => {
    const step = stepById.get(workflowNode.id);
    if (!step) return [];

    const size = nodeSize(step, config);
    const assignedLanes = step.actorIds
      .map((actorId) => laneByActorId.get(actorId))
      .filter((lane): lane is SopFlowchartLane => lane !== undefined);
    const resolvedLanes =
      assignedLanes.length > 0
        ? assignedLanes
        : fallbackLane
          ? [fallbackLane]
          : [];

    const centerY =
      config.padding +
      config.headerHeight +
      row * config.rowHeight +
      config.rowHeight / 2;

    const placements = resolvedLanes.map<SopFlowchartNodePlacement>((lane) => ({
      actorId: lane.actorId,
      x: lane.x + lane.width / 2,
      y: centerY,
    }));

    return [
      {
        id: step.id,
        kind: step.type,
        label: step.name,
        actorIds: step.actorIds,
        row,
        width: size.width,
        height: size.height,
        placements,
      },
    ];
  });

  const laneAreaRight = config.padding + lanes.length * config.laneWidth;
  const backEdgeCount = graph.edges.filter((edge) => {
    const fromRow = orderByStepId.get(edge.from);
    const targetRow = orderByStepId.get(edge.to);
    return fromRow !== undefined && targetRow !== undefined && targetRow <= fromRow;
  }).length;
  const backEdgeExtra = backEdgeCount > 0 ? 72 + backEdgeCount * 20 : 0;
  const width = laneAreaRight + config.padding + backEdgeExtra;
  const height =
    config.padding * 2 +
    config.headerHeight +
    Math.max(1, graph.nodes.length) * config.rowHeight;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const diagramModel: DiagramModel = {
    nodes: nodes.map((node) => {
      const placement = node.placements[0];
      return {
        id: node.id,
        kind: node.kind,
        label: node.label,
        text: { lines: [node.label], lineHeight: 14 },
        position: {
          x: (placement?.x ?? 0) - node.width / 2,
          y: (placement?.y ?? 0) - node.height / 2,
        },
        size: { width: node.width, height: node.height },
      };
    }),
    connections: graph.connections.map((edge) => ({ ...edge })),
    edges: graph.edges.map((edge) => ({ ...edge })),
    routedEdges: [],
    diagnostics: graph.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    width,
    height,
  };
  const routed = routeDiagramEdges(diagramModel, {
    edgeGap: Math.max(16, config.padding),
    backEdgeGap: Math.max(32, config.padding + 16),
    routingBounds: { left: 0, top: 0, width, height },
  });
  const routedById = new Map(routed.routedEdges.map((edge) => [edge.id, edge]));
  const edges = graph.edges.flatMap<SopFlowchartEdge>((edge) => {
    const route = routedById.get(edge.id);
    const node = nodeById.get(edge.from);
    if (!route || !node) return [];

    return [
      {
        ...edge,
        points: route.points,
        ...(route.labelPosition ? { labelPosition: route.labelPosition } : {}),
        ...(route.routeKind ? { routeKind: route.routeKind } : {}),
        ...(route.sourceSide ? { sourceSide: route.sourceSide } : {}),
        ...(route.targetSide ? { targetSide: route.targetSide } : {}),
        ...(route.quality ? { quality: route.quality } : {}),
        ...(route.routeDiagnostics
          ? { routeDiagnostics: route.routeDiagnostics }
          : {}),
      },
    ];
  });

  return {
    lanes,
    nodes,
    connections: graph.connections,
    edges,
    diagnostics: routed.diagnostics,
    width,
    height,
    headerHeight: config.headerHeight,
    rowHeight: config.rowHeight,
  };
}

function resolveOptions(
  options: BuildSopFlowchartOptions,
): Required<BuildSopFlowchartOptions> {
  return {
    laneWidth: positive(options.laneWidth, DEFAULTS.laneWidth),
    rowHeight: positive(options.rowHeight, DEFAULTS.rowHeight),
    headerHeight: positive(options.headerHeight, DEFAULTS.headerHeight),
    padding: nonNegative(options.padding, DEFAULTS.padding),
    nodeWidth: positive(options.nodeWidth, DEFAULTS.nodeWidth),
    nodeHeight: positive(options.nodeHeight, DEFAULTS.nodeHeight),
  };
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

function nodeSize(
  step: Step,
  config: Required<BuildSopFlowchartOptions>,
): { width: number; height: number } {
  if (step.type === "decision") {
    const size = Math.min(config.nodeWidth, Math.max(config.nodeHeight, 44));
    return { width: size, height: size };
  }

  if (step.type === "start" || step.type === "end") {
    return {
      width: config.nodeWidth * 0.8,
      height: config.nodeHeight * 0.85,
    };
  }

  return {
    width: config.nodeWidth,
    height: config.nodeHeight,
  };
}
