import type { DiagramModel, DiagramNode } from "./types.js";

export interface DiagramLayoutOptions {
  direction?: "top-to-bottom";
  nodeGap?: number;
  layerGap?: number;
  padding?: number;
}

const DEFAULT_OPTIONS: Required<DiagramLayoutOptions> = {
  direction: "top-to-bottom",
  nodeGap: 48,
  layerGap: 96,
  padding: 48,
};

export function layoutDiagram(
  model: DiagramModel,
  options: DiagramLayoutOptions = {},
): DiagramModel {
  const config: Required<DiagramLayoutOptions> = {
    direction: DEFAULT_OPTIONS.direction,
    nodeGap: Math.max(
      0,
      safeNumber(
        options.nodeGap ?? DEFAULT_OPTIONS.nodeGap,
        DEFAULT_OPTIONS.nodeGap,
      ),
    ),
    layerGap: Math.max(
      0,
      safeNumber(
        options.layerGap ?? DEFAULT_OPTIONS.layerGap,
        DEFAULT_OPTIONS.layerGap,
      ),
    ),
    padding: Math.max(
      0,
      safeNumber(
        options.padding ?? DEFAULT_OPTIONS.padding,
        DEFAULT_OPTIONS.padding,
      ),
    ),
  };

  if (model.nodes.length === 0) {
    return {
      ...model,
      width: 0,
      height: 0,
    };
  }

  const nodeOrder = new Map(model.nodes.map((node, index) => [node.id, index]));

  const adjacency = buildAdjacency(model, nodeOrder);
  const components = findStronglyConnectedComponents(
    model.nodes,
    adjacency,
    nodeOrder,
  );

  const componentByNode = new Map<string, number>();

  components.forEach((component, componentIndex) => {
    for (const nodeId of component) {
      componentByNode.set(nodeId, componentIndex);
    }
  });

  const componentGraph = buildComponentGraph(
    model,
    components,
    componentByNode,
  );

  const componentRanks = assignComponentRanks(
    components,
    componentGraph,
    nodeOrder,
  );

  const nodeRanks = new Map<string, number>();

  components.forEach((component, index) => {
    const baseRank = componentRanks.get(index) ?? 0;

    component.forEach((nodeId, offset) => {
      nodeRanks.set(nodeId, baseRank + offset);
    });
  });

  return positionNodes(model, nodeRanks, config, nodeOrder);
}

function buildAdjacency(
  model: DiagramModel,
  nodeOrder: Map<string, number>,
): Map<string, string[]> {
  const nodeIds = new Set(model.nodes.map((node) => node.id));
  const adjacency = new Map<string, string[]>();

  for (const node of model.nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of model.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      continue;
    }

    adjacency.get(edge.from)?.push(edge.to);
  }

  for (const targets of adjacency.values()) {
    targets.sort((a, b) => compareNodeIds(a, b, nodeOrder));
  }

  return adjacency;
}

function findStronglyConnectedComponents(
  nodes: DiagramNode[],
  adjacency: Map<string, string[]>,
  nodeOrder: Map<string, number>,
): string[][] {
  let index = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  function visit(nodeId: string): void {
    indices.set(nodeId, index);
    lowLinks.set(nodeId, index);
    index += 1;

    stack.push(nodeId);
    onStack.add(nodeId);

    const targets = adjacency.get(nodeId) ?? [];

    for (const targetId of targets) {
      if (!indices.has(targetId)) {
        visit(targetId);

        const currentLowLink = lowLinks.get(nodeId);
        const targetLowLink = lowLinks.get(targetId);

        if (currentLowLink === undefined || targetLowLink === undefined) {
          continue;
        }

        lowLinks.set(nodeId, Math.min(currentLowLink, targetLowLink));
      } else if (onStack.has(targetId)) {
        const currentLowLink = lowLinks.get(nodeId);
        const targetIndex = indices.get(targetId);

        if (currentLowLink === undefined || targetIndex === undefined) {
          continue;
        }

        lowLinks.set(nodeId, Math.min(currentLowLink, targetIndex));
      }
    }

    if (lowLinks.get(nodeId) !== indices.get(nodeId)) {
      return;
    }

    const component: string[] = [];

    while (stack.length > 0) {
      const current = stack.pop();

      if (current === undefined) {
        break;
      }

      onStack.delete(current);
      component.push(current);

      if (current === nodeId) {
        break;
      }
    }

    component.sort((a, b) => compareNodeIds(a, b, nodeOrder));
    components.push(component);
  }

  const orderedNodes = [...nodes].sort((a, b) =>
    compareNodeIds(a.id, b.id, nodeOrder),
  );

  for (const node of orderedNodes) {
    if (!indices.has(node.id)) {
      visit(node.id);
    }
  }

  return components;
}

function buildComponentGraph(
  model: DiagramModel,
  components: string[][],
  componentByNode: Map<string, number>,
): Map<number, Set<number>> {
  const graph = new Map<number, Set<number>>();

  components.forEach((_, index) => {
    graph.set(index, new Set());
  });

  for (const edge of model.edges) {
    const from = componentByNode.get(edge.from);
    const to = componentByNode.get(edge.to);

    if (from === undefined || to === undefined || from === to) {
      continue;
    }

    graph.get(from)?.add(to);
  }

  return graph;
}

function assignComponentRanks(
  components: string[][],
  graph: Map<number, Set<number>>,
  nodeOrder: Map<string, number>,
): Map<number, number> {
  const indegree = new Map<number, number>();

  for (let index = 0; index < components.length; index += 1) {
    indegree.set(index, 0);
  }

  for (const targets of graph.values()) {
    for (const target of targets) {
      indegree.set(target, (indegree.get(target) ?? 0) + 1);
    }
  }

  const componentOrder = new Map<number, number>();

  components.forEach((component, index) => {
    const firstNodeOrder = Math.min(
      ...component.map(
        (nodeId) => nodeOrder.get(nodeId) ?? Number.MAX_SAFE_INTEGER,
      ),
    );

    componentOrder.set(index, firstNodeOrder);
  });

  const compareComponents = (a: number, b: number) =>
    (componentOrder.get(a) ?? 0) - (componentOrder.get(b) ?? 0);

  const queue = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([index]) => index)
    .sort(compareComponents);

  const rank = new Map<number, number>();

  for (const component of queue) {
    rank.set(component, 0);
  }

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === undefined) {
      break;
    }

    const currentRank = rank.get(current) ?? 0;
    const currentComponent = components[current];

    if (currentComponent === undefined) {
      continue;
    }

    const targets = [...(graph.get(current) ?? [])].sort(compareComponents);

    for (const target of targets) {
      rank.set(
        target,
        Math.max(rank.get(target) ?? 0, currentRank + currentComponent.length),
      );

      indegree.set(target, (indegree.get(target) ?? 1) - 1);

      if (indegree.get(target) === 0) {
        queue.push(target);
        queue.sort(compareComponents);
      }
    }
  }

  return rank;
}

function positionNodes(
  model: DiagramModel,
  nodeRanks: Map<string, number>,
  options: Required<DiagramLayoutOptions>,
  nodeOrder: Map<string, number>,
): DiagramModel {
  const safeNodes = model.nodes.map((node) => ({
    ...node,
    position: {
      x: safeNumber(node.position.x, 0),
      y: safeNumber(node.position.y, 0),
    },
    size: {
      width: Math.max(1, safeNumber(node.size.width, 160)),
      height: Math.max(1, safeNumber(node.size.height, 64)),
    },
  }));
  const layers = new Map<number, DiagramNode[]>();

  for (const node of safeNodes) {
    const rank = nodeRanks.get(node.id) ?? 0;
    const layer = layers.get(rank) ?? [];

    layer.push(node);
    layers.set(rank, layer);
  }

  for (const layer of layers.values()) {
    layer.sort((a, b) => compareNodeIds(a.id, b.id, nodeOrder));
  }

  const sortedRanks = [...layers.keys()].sort((a, b) => a - b);
  const layerWidths = new Map<number, number>();
  let maxWidth = 0;

  for (const rank of sortedRanks) {
    const nodes = layers.get(rank) ?? [];
    const width =
      nodes.reduce((sum, node) => sum + node.size.width, 0) +
      Math.max(0, nodes.length - 1) * options.nodeGap;

    layerWidths.set(rank, width);
    maxWidth = Math.max(maxWidth, width);
  }

  let y = options.padding;
  const positioned = new Map<string, DiagramNode>();

  for (const rank of sortedRanks) {
    const nodes = layers.get(rank) ?? [];
    const layerWidth = layerWidths.get(rank) ?? 0;
    let x = options.padding + (maxWidth - layerWidth) / 2;
    let maxHeight = 0;

    for (const node of nodes) {
      positioned.set(node.id, {
        ...node,
        position: { x, y },
      });

      x += node.size.width + options.nodeGap;
      maxHeight = Math.max(maxHeight, node.size.height);
    }

    y += maxHeight + options.layerGap;
  }

  const width = maxWidth + options.padding * 2;
  const height = y - options.layerGap + options.padding;

  return {
    ...model,
    nodes: safeNodes.map((node) => positioned.get(node.id) ?? node),
    width,
    height,
  };
}

function safeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function compareNodeIds(
  a: string,
  b: string,
  nodeOrder: Map<string, number>,
): number {
  const orderDifference =
    (nodeOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
    (nodeOrder.get(b) ?? Number.MAX_SAFE_INTEGER);

  return orderDifference !== 0 ? orderDifference : a.localeCompare(b);
}
