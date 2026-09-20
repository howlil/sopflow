import type { SOPDocument, SopOperation, Step } from "@sopflow/core";
import { getIncomingConnections } from "@sopflow/core";
import { createStepId } from "../utils/createStepId.js";
import styles from "./AddStepButton.module.css";

export interface AddStepButtonProps {
  document: SOPDocument;
  onOperations: (operations: SopOperation[]) => void;
  disabled?: boolean;
}

export function AddStepButton({
  document,
  onOperations,
  disabled = false,
}: AddStepButtonProps) {
  const ends = document.steps.filter((step) => step.type === "end");
  const canAdd = ends.length === 1;
  const hasMultipleEnds = ends.length > 1;

  function handleAdd() {
    if (disabled || !canAdd) {
      return;
    }

    const end = ends[0];

    if (end) {
      insertBeforeEnd(end);
    }
  }

  function insertBeforeEnd(end: Extract<Step, { type: "end" }>) {
    const taskId = createStepId();
    const incoming = getIncomingConnections(document, end.id);
    const task: Step = {
      id: taskId,
      type: "task",
      name: "",
      actorIds: document.actors[0] ? [document.actors[0].id] : [],
      next: end.id,
    };
    const operations: SopOperation[] = [
      {
        type: "insert-step-before",
        step: task,
        beforeStepId: end.id,
      },
    ];

    for (const connection of incoming) {
      if (connection.type === "next") {
        operations.push({
          type: "connect",
          from: connection.from,
          to: taskId,
        });
        continue;
      }

      operations.push({
        type: "connect-decision",
        from: connection.from,
        branch: connection.type,
        to: taskId,
      });
    }

    onOperations(operations);
  }

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.button}
        disabled={disabled || !canAdd}
        onClick={handleAdd}
      >
        + Tambah langkah
      </button>

      {hasMultipleEnds ? (
        <p className={styles.hint}>
          SOP memiliki beberapa End. Tambahkan langkah melalui aksi pada langkah
          tujuan.
        </p>
      ) : null}
    </div>
  );
}
