import type { SOPDocument, Step } from "./types.js";
import type { SopOperation } from "./operations.js";
import { applyOperations, applyValidatedOperations } from "./operations.js";

export interface SopHistory {
  readonly past: readonly SOPDocument[];
  readonly present: SOPDocument;
  readonly future: readonly SOPDocument[];
}

export function createHistory(document: SOPDocument): SopHistory {
  return {
    past: [],
    present: document,
    future: [],
  };
}

export function applyHistoryOperation(
  history: SopHistory,
  operation: SopOperation,
): SopHistory {
  return applyHistoryOperations(history, [operation]);
}

export function applyHistoryOperations(
  history: SopHistory,
  operations: readonly SopOperation[],
): SopHistory {
  if (operations.length === 0) return history;

  const nextDocument = applyOperations(history.present, operations);

  return commitHistory(history, nextDocument);
}

export function applyValidatedHistoryOperations(
  history: SopHistory,
  operations: readonly SopOperation[],
): SopHistory {
  if (operations.length === 0) return history;

  const nextDocument = applyValidatedOperations(history.present, operations);

  return commitHistory(history, nextDocument);
}

function commitHistory(
  history: SopHistory,
  nextDocument: SOPDocument,
): SopHistory {
  if (sameDocument(history.present, nextDocument)) return history;

  return {
    past: [...history.past, history.present],
    present: nextDocument,
    future: [],
  };
}

export function undo(history: SopHistory): SopHistory {
  const previous = history.past.at(-1);

  if (!previous) return history;

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: SopHistory): SopHistory {
  const next = history.future[0];

  if (!next) return history;

  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

/** Compare canonical domain values, not object identity, before recording undo. */
function sameDocument(left: SOPDocument, right: SOPDocument): boolean {
  if (left === right) return true;

  return (
    left.schemaVersion === right.schemaVersion &&
    left.id === right.id &&
    left.title === right.title &&
    sameIds(left.presentationOrder, right.presentationOrder) &&
    left.actors.length === right.actors.length &&
    left.actors.every(
      (actor, index) =>
        actor.id === right.actors[index]?.id &&
        actor.name === right.actors[index]?.name,
    ) &&
    left.steps.length === right.steps.length &&
    left.steps.every((step, index) => {
      const other = right.steps[index];
      return other !== undefined && sameStep(step, other);
    })
  );
}

function sameIds(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
}

function sameStep(left: Step, right: Step): boolean {
  if (
    left.type !== right.type ||
    left.id !== right.id ||
    left.name !== right.name ||
    !sameIds(left.actorIds, right.actorIds) ||
    left.input !== right.input ||
    left.output !== right.output ||
    left.note !== right.note ||
    left.duration?.value !== right.duration?.value ||
    left.duration?.unit !== right.duration?.unit
  ) {
    return false;
  }

  switch (left.type) {
    case "start":
    case "task":
      return (
        (right.type === "start" || right.type === "task") &&
        left.next === right.next
      );
    case "decision":
      return (
        right.type === "decision" &&
        left.yes === right.yes &&
        left.no === right.no
      );
    case "end":
      return true;
  }
}
