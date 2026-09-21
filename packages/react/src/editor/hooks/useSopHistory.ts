import {
  applyHistoryOperation,
  applyHistoryOperations,
  createHistory,
  redo as redoHistory,
  undo as undoHistory,
  type SOPDocument,
  type SopHistory,
  type SopOperation,
} from "@sopflow/core";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseSopHistoryOptions {
  value: SOPDocument;
  onChange?: (document: SOPDocument) => void;
}

export function useSopHistory({ value, onChange }: UseSopHistoryOptions) {
  const [history, setHistory] = useState(() => createHistory(value));
  const historyRef = useRef(history);
  const lastEmittedRef = useRef<SOPDocument | null>(null);

  useEffect(() => {
    const lastEmitted = lastEmittedRef.current;

    if (lastEmitted && areDocumentsEqual(value, lastEmitted)) {
      lastEmittedRef.current = null;

      if (historyRef.current.present !== value) {
        const nextHistory: SopHistory = {
          ...historyRef.current,
          present: value,
        };

        historyRef.current = nextHistory;
        setHistory(nextHistory);
      }

      return;
    }

    const nextHistory = createHistory(value);

    lastEmittedRef.current = null;
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }, [value]);

  const commit = useCallback(
    (nextHistory: SopHistory) => {
      if (nextHistory === historyRef.current) {
        return;
      }

      historyRef.current = nextHistory;
      lastEmittedRef.current = nextHistory.present;
      setHistory(nextHistory);
      onChange?.(nextHistory.present);
    },
    [onChange],
  );

  const applyOperation = useCallback(
    (operation: SopOperation) => {
      commit(applyHistoryOperation(historyRef.current, operation));
    },
    [commit],
  );

  const applyOperations = useCallback(
    (operations: readonly SopOperation[]) => {
      commit(applyHistoryOperations(historyRef.current, operations));
    },
    [commit],
  );

  const undo = useCallback(() => {
    commit(undoHistory(historyRef.current));
  }, [commit]);

  const redo = useCallback(() => {
    commit(redoHistory(historyRef.current));
  }, [commit]);

  return {
    history,
    applyOperation,
    applyOperations,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

function areDocumentsEqual(a: SOPDocument, b: SOPDocument): boolean {
  if (a === b) return true;

  if (
    a.schemaVersion !== b.schemaVersion ||
    a.id !== b.id ||
    a.title !== b.title ||
    a.actors.length !== b.actors.length ||
    a.steps.length !== b.steps.length
  ) {
    return false;
  }

  for (let index = 0; index < a.actors.length; index += 1) {
    const left = a.actors[index];
    const right = b.actors[index];

    if (!left || !right || left.id !== right.id || left.name !== right.name) {
      return false;
    }
  }

  for (let index = 0; index < a.steps.length; index += 1) {
    const left = a.steps[index];
    const right = b.steps[index];

    if (!left || !right || JSON.stringify(left) !== JSON.stringify(right)) {
      return false;
    }
  }

  return true;
}
