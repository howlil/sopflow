import type {
  DiagramEdgeKind,
  DiagramModel,
  DiagramNode,
  DiagramPoint,
  DiagramRoutedEdge,
} from "./types.js";

export interface EdgeRoutingOptions {
  edgeGap?: number;
  backEdgeGap?: number;
}

const DEFAULT_OPTIONS: Required<EdgeRoutingOptions> = {
  edgeGap: 24,
  backEdgeGap: 48,
};

export function routeDiagramEdges(
  model: DiagramModel,
  options: EdgeRoutingOptions = {},
): DiagramModel {
  const config: Required<EdgeRoutingOptions> = {
    edgeGap: resolveGap(options.edgeGap, DEFAULT_OPTIONS.edgeGap),
    backEdgeGap: resolveGap(options.backEdgeGap, DEFAULT_OPTIONS.backEdgeGap),
  };
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  let backEdgeIndex = 0;

  const routedEdges = model.edges.map<DiagramRoutedEdge>((edge) => {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);

    if (!from || !to) {
      return { ...edge, points: [] };
    }

    if (isBackEdge(from, to)) {
      const points = routeBackEdge(from, to, backEdgeIndex, config);
      backEdgeIndex += 1;
      return { ...edge, points };
    }

    return {
      ...edge,
      points: routeForwardEdge(from, to, edge.kind, config),
    };
  });

  return { ...model, routedEdges };
}

function resolveGap(value: number | undefined, fallback: number): number {
  const resolved = value ?? fallback;

  return Number.isFinite(resolved) ? Math.max(0, resolved) : fallback;
}

function topCenter(node: DiagramNode): DiagramPoint {
  return {
    x: node.position.x + node.size.width / 2,
    y: node.position.y,
  };
}

function bottomCenter(node: DiagramNode): DiagramPoint {
  return {
    x: node.position.x + node.size.width / 2,
    y: node.position.y + node.size.height,
  };
}

function rightCenter(node: DiagramNode): DiagramPoint {
  return {
    x: node.position.x + node.size.width,
    y: node.position.y + node.size.height / 2,
  };
}

function isBackEdge(from: DiagramNode, to: DiagramNode): boolean {
  return to.position.y <= from.position.y;
}

function routeForwardEdge(
  from: DiagramNode,
  to: DiagramNode,
  _kind: DiagramEdgeKind,
  options: Required<EdgeRoutingOptions>,
): DiagramPoint[] {
  const start = bottomCenter(from);
  const end = topCenter(to);

  if (Math.abs(start.x - end.x) < 1) {
    return [start, end];
  }

  const middleY = start.y + Math.max(options.edgeGap, (end.y - start.y) / 2);

  return simplifyPoints([
    start,
    { x: start.x, y: middleY },
    { x: end.x, y: middleY },
    end,
  ]);
}

function routeBackEdge(
  from: DiagramNode,
  to: DiagramNode,
  index: number,
  options: Required<EdgeRoutingOptions>,
): DiagramPoint[] {
  const start = rightCenter(from);
  const end = rightCenter(to);
  const routeX =
    Math.max(from.position.x + from.size.width, to.position.x + to.size.width) +
    options.backEdgeGap +
    index * options.edgeGap;

  return simplifyPoints([
    start,
    { x: routeX, y: start.y },
    { x: routeX, y: end.y },
    end,
  ]);
}

function simplifyPoints(points: DiagramPoint[]): DiagramPoint[] {
  if (points.length <= 2) {
    return points;
  }

  const first = points[0];
  const last = points[points.length - 1];

  if (!first || !last) {
    return [];
  }

  const result: DiagramPoint[] = [first];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = result[result.length - 1];
    const current = points[index];
    const next = points[index + 1];

    if (!previous || !current || !next) {
      continue;
    }

    const collinear =
      (previous.x === current.x && current.x === next.x) ||
      (previous.y === current.y && current.y === next.y);

    if (!collinear) {
      result.push(current);
    }
  }

  result.push(last);
  return result;
}
