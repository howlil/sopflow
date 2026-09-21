import type { SOPDocument } from "./types.js";
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
  if (nextDocument === history.present) return history;

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
