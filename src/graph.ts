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
