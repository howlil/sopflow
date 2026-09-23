import type { SOPDocument, StepId } from "@sopflow/core";
import type { WorkflowEdge, WorkflowGraph } from "./workflow.js";

export interface BpmnLayoutNode {
  readonly id: StepId;
  readonly laneIndex: number;
  readonly columnIndex: number;
}

/**
 * Assign graph-aware BPMN columns without letting feedback edges distort the
 * forward reading direction. Cross-lane one-to-one handoffs may share a column;
 * same-lane flow and decision branches always advance.
 */
export function layoutBpmnGraph(
  document: SOPDocument,
  graph: WorkflowGraph,
): readonly BpmnLayoutNode[] {
  const actorIndex = new Map(
    document.actors.map((actor, index) => [actor.id, index] as const),
  );
  const fallbackLaneIndex =
    document.actors.length > 0 ? document.actors.length : 0;
  const stepById = new Map(
    document.steps.map((step) => [step.id, step] as const),
  );
  const orderById = new Map(
    graph.nodes.map((node, index) => [node.id, index] as const),
  );

  const laneById = new Map<StepId, number>();
  for (const node of graph.nodes) {
    const step = stepById.get(node.id);
    const actorId = step?.actorIds[0];
    laneById.set(
      node.id,
      actorId
        ? (actorIndex.get(actorId) ?? fallbackLaneIndex)
        : fallbackLaneIndex,
    );
  }

  const forwardEdges = getForwardEdges(graph, orderById);
  const mainSpine = buildBpmnMainSpine(graph);
  const incoming = countEdges(forwardEdges, "to");
  const outgoing = countEdges(forwardEdges, "from");
  const predecessors = new Map<StepId, WorkflowEdge[]>();

  for (const edge of forwardEdges) {
    const list = predecessors.get(edge.to) ?? [];
    list.push(edge);
    predecessors.set(edge.to, list);
  }

  const columnById = new Map<StepId, number>();
  for (const node of graph.nodes) {
    const incomingEdges = predecessors.get(node.id) ?? [];
    let column = 0;

    for (const edge of incomingEdges) {
      const sourceColumn = columnById.get(edge.from) ?? 0;
      const advance = minimumColumnAdvance(
        edge,
        graph,
        laneById,
        incoming,
        outgoing,
      );
      column = Math.max(column, sourceColumn + advance);
    }

    columnById.set(node.id, column);
  }

  // Resolve lane collisions and propagate resulting pushes through forward edges.
  // Columns only move to the right, so this converges quickly for the small SOP
  // graphs this package targets.
  for (let pass = 0; pass < Math.max(1, graph.nodes.length); pass += 1) {
    let changed = ensureUniqueLaneColumns(
      graph,
      laneById,
      columnById,
      mainSpine,
    );

    for (const edge of forwardEdges) {
      const sourceColumn = columnById.get(edge.from) ?? 0;
      const targetColumn = columnById.get(edge.to) ?? 0;
      const required =
        sourceColumn +
        minimumColumnAdvance(edge, graph, laneById, incoming, outgoing);

      if (targetColumn < required) {
        columnById.set(edge.to, required);
        changed = true;
      }
    }

    if (!changed) break;
  }

  // A final collision pass handles pushes introduced by the last propagation pass.
  ensureUniqueLaneColumns(graph, laneById, columnById, mainSpine);

  return graph.nodes.map((node) => ({
    id: node.id,
    laneIndex: laneById.get(node.id) ?? fallbackLaneIndex,
    columnIndex: columnById.get(node.id) ?? 0,
  }));
}

export function buildBpmnMainSpine(graph: WorkflowGraph): ReadonlySet<StepId> {
  const orderById = new Map(
    graph.nodes.map((node, index) => [node.id, index] as const),
  );
  const forwardEdges = getForwardEdges(graph, orderById);
  const outgoing = new Map<StepId, WorkflowEdge[]>();
  for (const edge of forwardEdges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const distanceMemo = new Map<StepId, number>();

  function distanceToEnd(id: StepId): number {
    const cached = distanceMemo.get(id);
    if (cached !== undefined) return cached;

    const node = nodeById.get(id);
    if (!node) return Number.POSITIVE_INFINITY;
    if (node.kind === "end") {
      distanceMemo.set(id, 0);
      return 0;
    }

    const candidates = outgoing.get(id) ?? [];
    let distance = Number.POSITIVE_INFINITY;
    for (const edge of candidates) {
      const targetDistance = distanceToEnd(edge.to);
      if (Number.isFinite(targetDistance)) {
        distance = Math.min(distance, targetDistance + 1);
      }
    }

    distanceMemo.set(id, distance);
    return distance;
  }

  const start = graph.nodes.find((node) => node.kind === "start");
  if (!start) return new Set();

  const spine = new Set<StepId>();
  let currentId: StepId | undefined = start.id;

  while (currentId && !spine.has(currentId)) {
    spine.add(currentId);
    const current = nodeById.get(currentId);
    if (!current || current.kind === "end") break;

    const candidates = (outgoing.get(currentId) ?? [])
      .filter((edge) => Number.isFinite(distanceToEnd(edge.to)))
      .sort((left, right) => {
        const distanceDifference =
          distanceToEnd(left.to) - distanceToEnd(right.to);
        if (distanceDifference !== 0) return distanceDifference;

        const branchDifference =
          bpmnSpineBranchPriority(left.kind) -
          bpmnSpineBranchPriority(right.kind);
        if (branchDifference !== 0) return branchDifference;

        const targetDifference =
          (orderById.get(left.to) ?? Number.MAX_SAFE_INTEGER) -
          (orderById.get(right.to) ?? Number.MAX_SAFE_INTEGER);
        return targetDifference || left.id.localeCompare(right.id);
      });

    currentId = candidates[0]?.to;
  }

  return spine;
}

function getForwardEdges(
  graph: WorkflowGraph,
  orderById: ReadonlyMap<StepId, number>,
): WorkflowEdge[] {
  return graph.edges.filter((edge) => {
    const from = orderById.get(edge.from);
    const to = orderById.get(edge.to);
    return from !== undefined && to !== undefined && to > from;
  });
}

function bpmnSpineBranchPriority(kind: WorkflowEdge["kind"]): number {
  return kind === "next" ? 0 : kind === "yes" ? 1 : 2;
}

function countEdges(
  edges: readonly WorkflowEdge[],
  field: "from" | "to",
): ReadonlyMap<StepId, number> {
  const counts = new Map<StepId, number>();
  for (const edge of edges) {
    const id = edge[field];
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function minimumColumnAdvance(
  edge: WorkflowEdge,
  graph: WorkflowGraph,
  laneById: ReadonlyMap<StepId, number>,
  incoming: ReadonlyMap<StepId, number>,
  outgoing: ReadonlyMap<StepId, number>,
): 0 | 1 {
  const source = graph.nodes.find((node) => node.id === edge.from);
  const sameLane = laneById.get(edge.from) === laneById.get(edge.to);

  if (sameLane) return 1;
  if (source?.kind === "decision") return 1;

  const simpleCrossLaneHandoff =
    (outgoing.get(edge.from) ?? 0) === 1 && (incoming.get(edge.to) ?? 0) === 1;

  return simpleCrossLaneHandoff ? 0 : 1;
}

function ensureUniqueLaneColumns(
  graph: WorkflowGraph,
  laneById: ReadonlyMap<StepId, number>,
  columnById: Map<StepId, number>,
  mainSpine: ReadonlySet<StepId>,
): boolean {
  const occupied = new Set<string>();
  let changed = false;
  const orderById = new Map(
    graph.nodes.map((node, index) => [node.id, index] as const),
  );
  const nodes = [...graph.nodes].sort((left, right) => {
    const leftPriority = mainSpine.has(left.id) ? 0 : 1;
    const rightPriority = mainSpine.has(right.id) ? 0 : 1;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;

    return (orderById.get(left.id) ?? 0) - (orderById.get(right.id) ?? 0);
  });

  for (const node of nodes) {
    const lane = laneById.get(node.id) ?? 0;
    let column = columnById.get(node.id) ?? 0;

    while (occupied.has(`${lane}:${column}`)) {
      column += 1;
    }

    if (column !== (columnById.get(node.id) ?? 0)) {
      columnById.set(node.id, column);
      changed = true;
    }
    occupied.add(`${lane}:${column}`);
  }

  return changed;
}
