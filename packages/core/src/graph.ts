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
  const steps = createStepMap(document);
  const visited = new Set<StepId>();
  const visiting = new Set<StepId>();
  const result: StepId[] = [];

  function visitComponent(rootId: StepId): void {
    const ordered: StepId[] = [];
    const terminal: StepId[] = [];
    const frames: { id: StepId; nextIds: StepId[]; nextIndex: number }[] = [];

    function enter(id: StepId): void {
      if (visited.has(id) || visiting.has(id)) return;

      const step = steps.get(id);
      if (!step) return;

      visiting.add(id);

      if (step.type !== "end") {
        ordered.push(id);
      }

      frames.push({ id, nextIds: getNextStepIds(step), nextIndex: 0 });
    }

    enter(rootId);

    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      if (!frame) break;

      const nextId = frame.nextIds[frame.nextIndex];

      if (nextId !== undefined) {
        frame.nextIndex += 1;
        enter(nextId);
        continue;
      }

      visiting.delete(frame.id);
      visited.add(frame.id);

      if (steps.get(frame.id)?.type === "end") {
        terminal.push(frame.id);
      }

      frames.pop();
    }

    for (const id of ordered) result.push(id);
    for (const id of terminal) result.push(id);
  }

  const startIds = document.steps
    .filter((step) => step.type === "start")
    .map((step) => step.id)
    .sort(compareStepIds);

  for (const startId of startIds) {
    visitComponent(startId);
  }

  const zeroIncomingIds = findZeroIncomingStepIds(document)
    .filter((id) => !visited.has(id))
    .sort(compareStepIds);

  for (const rootId of zeroIncomingIds) {
    visitComponent(rootId);
  }

  const remainingIds = [...steps.keys()]
    .filter((id) => !visited.has(id))
    .sort(compareStepIds);

  for (const rootId of remainingIds) {
    visitComponent(rootId);
  }

  return result;
}

function findZeroIncomingStepIds(document: SOPDocument): StepId[] {
  const knownIds = new Set(document.steps.map((step) => step.id));
  const incoming = new Set<StepId>();

  for (const step of document.steps) {
    for (const nextId of getNextStepIds(step)) {
      if (knownIds.has(nextId)) incoming.add(nextId);
    }
  }

  return document.steps
    .map((step) => step.id)
    .filter((id) => !incoming.has(id));
}

function compareStepIds(left: StepId, right: StepId): number {
  return left.localeCompare(right);
}

export function getOrderedSteps(document: SOPDocument): Step[] {
  const steps = createStepMap(document);

  return getOrderedStepIds(document)
    .map((stepId) => steps.get(stepId))
    .filter((step): step is Step => step !== undefined);
}

/**
 * Resolve authored/display order without changing workflow execution semantics.
 * Invalid or incomplete presentationOrder values stay renderable: known unique
 * ids are kept first and missing steps are appended in deterministic graph order.
 * validateSop() reports the contract violation separately.
 */
export function getPresentationStepIds(document: SOPDocument): StepId[] {
  if (!document.presentationOrder) return getOrderedStepIds(document);

  const known = new Set(document.steps.map((step) => step.id));
  const seen = new Set<StepId>();
  const ordered: StepId[] = [];

  for (const id of document.presentationOrder) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  for (const id of getOrderedStepIds(document)) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  return ordered;
}

export function getPresentationSteps(document: SOPDocument): Step[] {
  const steps = createStepMap(document);

  return getPresentationStepIds(document)
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

/**
 * Find every step belonging to a directed cycle, including overlapping cycles.
 * Kosaraju's algorithm uses explicit stacks to avoid call-stack exhaustion.
 */
export function findCycleStepIds(document: SOPDocument): Set<StepId> {
  const steps = createStepMap(document);
  const forward = new Map<StepId, StepId[]>();
  const reverse = new Map<StepId, StepId[]>();

  for (const id of steps.keys()) {
    reverse.set(id, []);
  }

  for (const step of document.steps) {
    const targets = getNextStepIds(step).filter((id) => steps.has(id));
    forward.set(step.id, targets);

    for (const targetId of targets) {
      reverse.get(targetId)?.push(step.id);
    }
  }

  const visited = new Set<StepId>();
  const finishingOrder: StepId[] = [];

  for (const rootId of steps.keys()) {
    if (visited.has(rootId)) continue;

    visited.add(rootId);
    const frames: { id: StepId; nextIndex: number }[] = [
      { id: rootId, nextIndex: 0 },
    ];

    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      if (!frame) break;

      const targets = forward.get(frame.id) ?? [];
      const nextId = targets[frame.nextIndex];

      if (nextId !== undefined) {
        frame.nextIndex += 1;
        if (!visited.has(nextId)) {
          visited.add(nextId);
          frames.push({ id: nextId, nextIndex: 0 });
        }
      } else {
        finishingOrder.push(frame.id);
        frames.pop();
      }
    }
  }

  const assigned = new Set<StepId>();
  const cycleNodes = new Set<StepId>();

  for (let index = finishingOrder.length - 1; index >= 0; index--) {
    const rootId = finishingOrder[index];
    if (rootId === undefined || assigned.has(rootId)) continue;

    const component: StepId[] = [];
    const stack: StepId[] = [rootId];
    assigned.add(rootId);

    while (stack.length > 0) {
      const id = stack.pop();
      if (id === undefined) continue;

      component.push(id);
      for (const previousId of reverse.get(id) ?? []) {
        if (assigned.has(previousId)) continue;
        assigned.add(previousId);
        stack.push(previousId);
      }
    }

    if (component.length > 1 || forward.get(rootId)?.includes(rootId)) {
      for (const id of component) cycleNodes.add(id);
    }
  }

  return cycleNodes;
}
