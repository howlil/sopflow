import type { SOPDocument, Step, StepId } from "./types.js";

export interface SopGraphIndex {
  readonly stepById: ReadonlyMap<StepId, Step>;
  readonly actorById: ReadonlyMap<string, SOPDocument["actors"][number]>;
  readonly incomingByStepId: ReadonlyMap<StepId, readonly IncomingConnection[]>;
  readonly orderByStepId: ReadonlyMap<StepId, number>;
}

export function createGraphIndex(document: SOPDocument): SopGraphIndex {
  const stepById = new Map(document.steps.map((step) => [step.id, step]));
  const actorById = new Map(document.actors.map((actor) => [actor.id, actor]));
  const incomingByStepId = new Map<StepId, IncomingConnection[]>();
  const orderByStepId = new Map(
    document.steps.map((step, index) => [step.id, index] as const),
  );

  for (const step of document.steps) {
    const connections =
      step.type === "decision"
        ? [
            { targetId: step.yes, type: "yes" as const },
            { targetId: step.no, type: "no" as const },
          ]
        : step.type === "end"
          ? []
          : [{ targetId: step.next, type: "next" as const }];

    for (const { targetId, type } of connections) {
      const incoming = incomingByStepId.get(targetId) ?? [];

      incoming.push({ from: step.id, type });

      incomingByStepId.set(targetId, incoming);
    }
  }

  return {
    stepById,
    actorById,
    incomingByStepId,
    orderByStepId,
  };
}

function createStepMap(document: SOPDocument): Map<StepId, Step> {
  return new Map(document.steps.map((step) => [step.id, step]));
}

export function getStep(document: SOPDocument, id: StepId): Step | undefined {
  return document.steps.find((step) => step.id === id);
}

export function getNextStepIds(step: Step): StepId[] {
  switch (step.type) {
    case "start":
    case "task":
      return [step.next];
    case "decision":
      return [step.yes, step.no];
    case "end":
      return [];
  }
}

export function getOrderedStepIds(document: SOPDocument): StepId[] {
  const start = document.steps.find((step) => step.type === "start");

  if (!start) return document.steps.map((step) => step.id);

  const steps = createStepMap(document);
  const visited = new Set<StepId>();
  const visiting = new Set<StepId>();
  const ordered: StepId[] = [];
  const terminal: StepId[] = [];

  function visit(id: StepId): void {
    if (visited.has(id) || visiting.has(id)) return;

    const step = steps.get(id);

    if (!step) return;

    visiting.add(id);

    if (step.type !== "end") {
      ordered.push(id);
    }

    for (const nextId of getNextStepIds(step)) {
      visit(nextId);
    }

    visiting.delete(id);
    visited.add(id);

    if (step.type === "end") {
      terminal.push(id);
    }
  }

  visit(start.id);

  const orphanIds = document.steps
    .filter((step) => !visited.has(step.id))
    .map((step) => step.id);

  return [...ordered, ...terminal, ...orphanIds];
}

export function getOrderedSteps(document: SOPDocument): Step[] {
  const steps = createStepMap(document);

  return getOrderedStepIds(document)
    .map((stepId) => steps.get(stepId))
    .filter((step): step is Step => step !== undefined);
}

export function getReachableStepIds(document: SOPDocument): Set<StepId> {
  const start = document.steps.find((step) => step.type === "start");

  if (!start) return new Set();

  const steps = createStepMap(document);
  const visited = new Set<StepId>();
  const stack: StepId[] = [start.id];

  while (stack.length > 0) {
    const currentId = stack.pop();

    if (currentId === undefined || visited.has(currentId)) continue;

    visited.add(currentId);

    const step = steps.get(currentId);

    if (!step) continue;

    for (const nextId of getNextStepIds(step)) {
      if (!visited.has(nextId)) {
        stack.push(nextId);
      }
    }
  }

  return visited;
}

export function getPreviousStepIds(
  document: SOPDocument,
  targetId: StepId,
): StepId[] {
  return [
    ...new Set(
      getIncomingConnections(document, targetId).map(
        (connection) => connection.from,
      ),
    ),
  ];
}

/**
 * Returns incoming connections without collapsing Ya/Tidak branches.
 *
 * `getPreviousStepIds` is intentionally source-oriented and therefore
 * deduplicates a decision that points both branches at the same target. Route
 * and label planners must use this branch-preserving view instead.
 */
export function getPreviousConnections(
  document: SOPDocument,
  targetId: StepId,
): IncomingConnection[] {
  return getIncomingConnections(document, targetId);
}

export type IncomingConnection =
  | {
      readonly from: StepId;
      readonly type: "next";
    }
  | {
      readonly from: StepId;
      readonly type: "yes";
    }
  | {
      readonly from: StepId;
      readonly type: "no";
    };

export function getIncomingConnections(
  document: SOPDocument,
  targetId: StepId,
): IncomingConnection[] {
  const connections: IncomingConnection[] = [];

  for (const step of document.steps) {
    switch (step.type) {
      case "start":
      case "task":
        if (step.next === targetId) {
          connections.push({ from: step.id, type: "next" });
        }
        break;

      case "decision":
        if (step.yes === targetId) {
          connections.push({ from: step.id, type: "yes" });
        }

        if (step.no === targetId) {
          connections.push({ from: step.id, type: "no" });
        }
        break;

      case "end":
        break;
    }
  }

  return connections;
}

/**
 * @deprecated In the v1 domain every non-end step always has an outgoing edge,
 * so a well-typed SOPDocument cannot contain a structural dead end.
 */
export function findDeadEndStepIds(document: SOPDocument): StepId[] {
  return document.steps
    .filter((step) => step.type !== "end" && getNextStepIds(step).length === 0)
    .map((step) => step.id);
}

export function canReachEnd(document: SOPDocument, startId: StepId): boolean {
  const steps = createStepMap(document);
  const visited = new Set<StepId>();
  const stack: StepId[] = [startId];

  while (stack.length > 0) {
    const currentId = stack.pop();

    if (currentId === undefined || visited.has(currentId)) continue;

    visited.add(currentId);

    const step = steps.get(currentId);

    if (!step) continue;

    if (step.type === "end") return true;

    for (const nextId of getNextStepIds(step)) {
      if (!visited.has(nextId)) {
        stack.push(nextId);
      }
    }
  }

  return false;
}

export function findCycleStepIds(document: SOPDocument): Set<StepId> {
  const steps = createStepMap(document);
  const visited = new Set<StepId>();
  const visiting = new Set<StepId>();
  const path: StepId[] = [];
  const cycleNodes = new Set<StepId>();

  function dfs(id: StepId): void {
    if (visiting.has(id)) {
      const cycleStart = path.indexOf(id);

      if (cycleStart >= 0) {
        for (const cycleId of path.slice(cycleStart)) {
          cycleNodes.add(cycleId);
        }
      }

      return;
    }

    if (visited.has(id)) return;

    visiting.add(id);
    path.push(id);

    const step = steps.get(id);

    if (step) {
      for (const nextId of getNextStepIds(step)) {
        dfs(nextId);
      }
    }

    path.pop();
    visiting.delete(id);
    visited.add(id);
  }

  for (const step of document.steps) {
    dfs(step.id);
  }

  return cycleNodes;
}
