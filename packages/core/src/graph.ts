import type { SOPDocument, Step, StepId } from "./types.js";

export function getStep(document: SOPDocument, id: StepId): Step | undefined {
  return document.steps.find((step) => step.id === id);
}

export function getNextStepIds(step: Step): StepId[] {
  switch (step.type) {
    case "start":
      return [step.next];
    case "task":
      return [step.next];
    case "decision":
      return [step.yes, step.no];
    case "end":
      return [];
    default:
      throw new Error("Unsupported step type");
  }
}

export function getOrderedStepIds(document: SOPDocument): StepId[] {
  const start = document.steps.find((step) => step.type === "start");

  if (!start) return document.steps.map((step) => step.id);

  const visited = new Set<StepId>();
  const visiting = new Set<StepId>();
  const ordered: StepId[] = [];
  const terminal: StepId[] = [];

  function visit(id: StepId): void {
    if (visited.has(id) || visiting.has(id)) return;

    const step = getStep(document, id);

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
  const steps = new Map(document.steps.map((step) => [step.id, step]));

  return getOrderedStepIds(document)
    .map((stepId) => steps.get(stepId))
    .filter((step): step is Step => step !== undefined);
}

export function getReachableStepIds(document: SOPDocument): Set<StepId> {
  const start = document.steps.find((step) => step.type === "start");

  if (!start) return new Set();

  const visited = new Set<StepId>();
  const stack: StepId[] = [start.id];

  while (stack.length > 0) {
    const currentId = stack.pop();

    if (currentId === undefined) continue;

    if (visited.has(currentId)) continue;

    visited.add(currentId);

    const step = getStep(document, currentId);

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

export type IncomingConnection =
  | {
      from: StepId;
      type: "next";
    }
  | {
      from: StepId;
      type: "yes";
    }
  | {
      from: StepId;
      type: "no";
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
          connections.push({
            from: step.id,
            type: "next",
          });
        }
        break;

      case "decision":
        if (step.yes === targetId) {
          connections.push({
            from: step.id,
            type: "yes",
          });
        }

        if (step.no === targetId) {
          connections.push({
            from: step.id,
            type: "no",
          });
        }
        break;

      case "end":
        break;
    }
  }

  return connections;
}

export function findDeadEndStepIds(document: SOPDocument): StepId[] {
  return document.steps
    .filter((step) => {
      if (step.type === "end") {
        return false;
      }
      return getNextStepIds(step).length === 0;
    })
    .map((step) => step.id);
}

export function canReachEnd(document: SOPDocument, startId: StepId): boolean {
  const visited = new Set<StepId>();
  const stack: StepId[] = [startId];

  while (stack.length > 0) {
    const currentId = stack.pop();

    if (currentId === undefined) continue;

    if (visited.has(currentId)) continue;

    visited.add(currentId);

    const step = getStep(document, currentId);

    if (!step) continue;

    if (step.type === "end") return true;

    for (const nextId of getNextStepIds(step)) {
      stack.push(nextId);
    }
  }
  return false;
}

export function findCycleStepIds(document: SOPDocument): Set<StepId> {
  const visited = new Set<StepId>();
  const visiting = new Set<StepId>();
  const path: StepId[] = [];
  const cycleNodes = new Set<StepId>();

  function dfs(id: StepId): void {
    if (visiting.has(id)) {
      const cycleStart = path.indexOf(id);

      for (const cycleId of path.slice(cycleStart)) {
        cycleNodes.add(cycleId);
      }

      return;
    }

    if (visited.has(id)) return;

    visiting.add(id);
    path.push(id);

    const step = getStep(document, id);

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
