import {
  applyHistoryOperation,
  applyHistoryOperations,
  createHistory,
  redo as redoHistory,
  undo as undoHistory,
  type SOPDocument,
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
    if (value === lastEmittedRef.current) {
      lastEmittedRef.current = null;
      return;
    }

    const nextHistory = createHistory(value);

    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }, [value]);

  const commit = useCallback(
    (nextHistory: typeof history) => {
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
    (operations: SopOperation[]) => {
      commit(applyHistoryOperations(historyRef.current, operations));
    },
    [commit],
  );

  const undo = useCallback(() => {
    const nextHistory = undoHistory(historyRef.current);

    if (nextHistory === historyRef.current) {
      return;
    }

    commit(nextHistory);
  }, [commit]);

  const redo = useCallback(() => {
    const nextHistory = redoHistory(historyRef.current);

    if (nextHistory === historyRef.current) {
      return;
    }

    commit(nextHistory);
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
