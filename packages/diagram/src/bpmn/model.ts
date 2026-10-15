import type { SOPDocument } from "@sopflow/core";
import { projectWorkflow } from "../workflow.js";
import { layoutBpmnGraph } from "./layout.js";
import { reconcileBpmnRoutes } from "./routing.js";
import { scoreBpmnPlan } from "./scoring.js";
import { measureBpmnNode, positive, nonNegative } from "./geometry.js";
import type { BpmnLayoutOptions, BpmnModel, BpmnLane, BpmnNode } from "./types.js";
import type { DiagramDiagnostic } from "../types.js";

const DEFAULTS: Required<
  Pick<BpmnLayoutOptions, "laneHeight" | "headerWidth" | "stepGap" | "padding">
> = {
  laneHeight: 112,
  headerWidth: 116,
  stepGap: 144,
  padding: 24,
};

export function buildBpmnModel(
  document: SOPDocument,
  options: BpmnLayoutOptions = {},
): BpmnModel {
  const first = buildBpmnModelPass(document, options, "feedback-first");
  const second = buildBpmnModelPass(document, options, "branch-first");
  return scoreBpmnPlan(second) < scoreBpmnPlan(first) ? second : first;
}

function buildBpmnModelPass(
  document: SOPDocument,
  options: BpmnLayoutOptions,
  order: "feedback-first" | "branch-first",
): BpmnModel {
  const config = {
    laneHeight: positive(options.laneHeight, DEFAULTS.laneHeight),
    headerWidth: positive(options.headerWidth, DEFAULTS.headerWidth),
    stepGap: positive(options.stepGap, DEFAULTS.stepGap),
    padding: nonNegative(options.padding, DEFAULTS.padding),
  };
  const graph = projectWorkflow(document);
  const diagnostics: DiagramDiagnostic[] = [...graph.diagnostics];
  const actorIndex = new Map(
    document.actors.map((actor, index) => [actor.id, index] as const),
  );
  const needsFallbackLane = document.steps.some((step) => {
    const actorId = step.actorIds[0];
    return !actorId || !actorIndex.has(actorId);
  });
  const hasExplicitActors = document.actors.length > 0;
  const laneCount = Math.max(
    1,
    document.actors.length + (needsFallbackLane && hasExplicitActors ? 1 : 0),
  );
  const layoutNodes = layoutBpmnGraph(document, graph);
  const layoutById = new Map(
    layoutNodes.map((node) => [node.id, node] as const),
  );
  const metricsById = new Map(
    graph.nodes.map(
      (node) => [node.id, measureBpmnNode(node.kind, node.label)] as const,
    ),
  );
  const feedbackEdgeIds = graph.edges.flatMap((edge) => {
    if (edge.from === edge.to) return [];
    const source = layoutById.get(edge.from);
    const target = layoutById.get(edge.to);
    if (!source || !target || target.columnIndex > source.columnIndex)
      return [];
    return [edge.id];
  });
  const feedbackSlotById = new Map(
    feedbackEdgeIds.map((edgeId, index) => [edgeId, index] as const),
  );
  const feedbackCorridorReserve =
    feedbackEdgeIds.length > 0 ? 32 + (feedbackEdgeIds.length - 1) * 14 : 0;
  const maxColumn = Math.max(0, ...layoutNodes.map((node) => node.columnIndex));
  const columnWidths = Array.from({ length: maxColumn + 1 }, () => 96);
  for (const layout of layoutNodes) {
    const metrics = metricsById.get(layout.id);
    if (!metrics) continue;
    columnWidths[layout.columnIndex] = Math.max(
      columnWidths[layout.columnIndex] ?? 96,
      metrics.footprintWidth,
    );
  }
  const columnGap = Math.max(24, config.stepGap - 96);
  const columnCenters: number[] = [];
  let columnCursor = config.padding + config.headerWidth;
  columnWidths.forEach((columnWidth, index) => {
    columnCenters[index] = columnCursor + columnWidth / 2;
    columnCursor += columnWidth;
    if (index < columnWidths.length - 1) columnCursor += columnGap;
  });
  const width = columnCursor + config.padding;

  const laneHeights = Array.from(
    { length: laneCount },
    () => config.laneHeight,
  );
  for (const layout of layoutNodes) {
    const metrics = metricsById.get(layout.id);
    if (!metrics) continue;
    laneHeights[layout.laneIndex] = Math.max(
      laneHeights[layout.laneIndex] ?? config.laneHeight,
      metrics.footprintHeight + 24,
    );
  }
  let laneCursor = config.padding + feedbackCorridorReserve;
  const lanes: BpmnLane[] = Array.from({ length: laneCount }, (_, index) => {
    const actor = document.actors[index];
    const laneHeight = laneHeights[index] ?? config.laneHeight;
    const lane = {
      actorId: actor?.id ?? null,
      label: actor?.name ?? "Pelaksana",
      index,
      y: laneCursor,
      height: laneHeight,
    };
    laneCursor += laneHeight;
    return lane;
  });
  const height = laneCursor + config.padding;

  const stepById = new Map(document.steps.map((step) => [step.id, step]));
  const nodes = graph.nodes.flatMap<BpmnNode>((node) => {
    const step = stepById.get(node.id);
    const layout = layoutById.get(node.id);
    const metrics = metricsById.get(node.id);
    if (!step || !layout || !metrics) return [];

    const firstActorId = step.actorIds[0];
    const laneIndex = layout.laneIndex;
    if (!firstActorId && hasExplicitActors) {
      diagnostics.push({
        code: "UNASSIGNED_ACTOR",
        edgeId: `node:${node.id}`,
        from: node.id,
        to: node.id,
      });
    } else if (firstActorId && !actorIndex.has(firstActorId)) {
      diagnostics.push({
        code: "UNKNOWN_ACTOR_LANE",
        edgeId: `node:${node.id}`,
        from: node.id,
        to: node.id,
      });
    }

    const lane = lanes[laneIndex];
    if (!lane) return [];

    return [
      {
        id: node.id,
        kind: node.kind,
        label: node.label,
        laneIndex,
        x:
          columnCenters[layout.columnIndex] ??
          config.padding + config.headerWidth + metrics.width / 2,
        y: lane.y + lane.height / 2,
        width: metrics.width,
        height: metrics.height,
        labelLines: metrics.labelLines,
        labelLineHeight: metrics.labelLineHeight,
      },
    ];
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const routing = reconcileBpmnRoutes({
    semanticEdges: graph.edges,
    nodes,
    nodeById,
    width,
    height,
    order,
    feedbackSlotById,
    feedbackCorridorTop: config.padding + 8,
    diagramConfig: options.diagramConfig ?? {},
  });
  diagnostics.push(...routing.diagnostics);
  const edges = routing.edges;

  return {
    lanes,
    nodes,
    connections: graph.connections,
    edges,
    diagnostics,
    width,
    height,
    padding: config.padding,
    headerWidth: config.headerWidth,
    laneHeight: config.laneHeight,
  };
}
