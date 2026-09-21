import type { SOPDocument, Step } from "@sopflow/core";
import { buildDiagramModel } from "../buildDiagramModel.js";
import type { DiagramPoint } from "../types.js";
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

  const nodes = document.steps.map<SopFlowchartNode>((step, row) => {
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

    return {
      id: step.id,
      kind: step.type,
      label: step.name,
      actorIds: step.actorIds,
      row,
      width: size.width,
      height: size.height,
      placements,
    };
  });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const graph = buildDiagramModel(document);
  let backEdgeIndex = 0;

  const laneAreaRight = config.padding + lanes.length * config.laneWidth;

  const edges = graph.edges.flatMap<SopFlowchartEdge>((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    const source = from?.placements[0];
    const target = to?.placements[0];

    if (!from || !to || !source || !target) return [];

    const routed =
      to.row <= from.row
        ? routeBackEdge(
            source,
            target,
            from,
            to,
            laneAreaRight,
            backEdgeIndex++,
          )
        : routeForwardEdge(source, target, from, to);

    return [
      {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        kind: edge.kind,
        ...(edge.label ? { label: edge.label } : {}),
        points: routed.points,
        ...(routed.labelPosition
          ? { labelPosition: routed.labelPosition }
          : {}),
      },
    ];
  });

  const backEdgeExtra = backEdgeIndex > 0 ? 72 + backEdgeIndex * 20 : 0;
  const width = laneAreaRight + config.padding + backEdgeExtra;
  const height =
    config.padding * 2 +
    config.headerHeight +
    Math.max(1, document.steps.length) * config.rowHeight;

  return {
    lanes,
    nodes,
    edges,
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

function routeForwardEdge(
  source: SopFlowchartNodePlacement,
  target: SopFlowchartNodePlacement,
  from: SopFlowchartNode,
  to: SopFlowchartNode,
): { points: DiagramPoint[]; labelPosition?: DiagramPoint } {
  const start = {
    x: source.x,
    y: source.y + from.height / 2,
  };
  const end = {
    x: target.x,
    y: target.y - to.height / 2,
  };
  const middleY = start.y + (end.y - start.y) / 2;
  const points = compact([
    start,
    { x: start.x, y: middleY },
    { x: end.x, y: middleY },
    end,
  ]);

  return {
    points,
    labelPosition: {
      x: (start.x + end.x) / 2,
      y: middleY - 6,
    },
  };
}

function routeBackEdge(
  source: SopFlowchartNodePlacement,
  target: SopFlowchartNodePlacement,
  from: SopFlowchartNode,
  to: SopFlowchartNode,
  laneAreaRight: number,
  index: number,
): { points: DiagramPoint[]; labelPosition?: DiagramPoint } {
  const start = {
    x: source.x + from.width / 2,
    y: source.y,
  };
  const end = {
    x: target.x + to.width / 2,
    y: target.y,
  };
  const routeX = laneAreaRight + 40 + index * 20;
  const points = compact([
    start,
    { x: routeX, y: start.y },
    { x: routeX, y: end.y },
    end,
  ]);

  return {
    points,
    labelPosition: {
      x: routeX - 8,
      y: (start.y + end.y) / 2,
    },
  };
}

function compact(points: DiagramPoint[]): DiagramPoint[] {
  const result: DiagramPoint[] = [];

  for (const point of points) {
    const previous = result[result.length - 1];
    if (previous && previous.x === point.x && previous.y === point.y) continue;
    result.push(point);
  }

  if (result.length <= 2) return result;

  const simplified: DiagramPoint[] = [result[0] as DiagramPoint];

  for (let index = 1; index < result.length - 1; index += 1) {
    const previous = simplified[simplified.length - 1];
    const current = result[index];
    const next = result[index + 1];

    if (!previous || !current || !next) continue;

    const collinear =
      (previous.x === current.x && current.x === next.x) ||
      (previous.y === current.y && current.y === next.y);

    if (!collinear) simplified.push(current);
  }

  simplified.push(result[result.length - 1] as DiagramPoint);
  return simplified;
}
