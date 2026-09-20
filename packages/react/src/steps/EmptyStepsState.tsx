import type { SOPDocument, SopOperation, Step } from "@sopflow/core";
import { createStepId } from "../utils/createStepId.js";
import styles from "./EmptyStepsState.module.css";

export interface EmptyStepsStateProps {
  document: SOPDocument;
  onOperations: (operations: SopOperation[]) => void;
  disabled?: boolean;
}

export function EmptyStepsState({
  document,
  onOperations,
  disabled = false,
}: EmptyStepsStateProps) {
  function handleCreate() {
    if (disabled || document.steps.length > 0) {
      return;
    }

    const startId = createStepId();
    const taskId = createStepId();
    const endId = createStepId();
    const actorIds = document.actors[0] ? [document.actors[0].id] : [];

    const start: Step = {
      id: startId,
      type: "start",
      name: "Mulai",
      actorIds,
      next: taskId,
    };

    const task: Step = {
      id: taskId,
      type: "task",
      name: "",
      actorIds,
      next: endId,
    };

    const end: Step = {
      id: endId,
      type: "end",
      name: "Selesai",
      actorIds,
    };

    onOperations([
      {
        type: "add-step",
        step: end,
      },
      {
        type: "insert-step-before",
        step: task,
        beforeStepId: endId,
      },
      {
        type: "insert-step-before",
        step: start,
        beforeStepId: taskId,
      },
    ]);
  }

  return (
    <div className={styles.root}>
      <div className={styles.preview}>
        <span className={styles.step}>Mulai</span>

        <span className={styles.arrow} aria-hidden="true">
          →
        </span>

        <span className={styles.step}>Langkah</span>

        <span className={styles.arrow} aria-hidden="true">
          →
        </span>

        <span className={styles.step}>Selesai</span>
      </div>

      <div className={styles.content}>
        <h3 className={styles.title}>Belum ada langkah</h3>

        <p className={styles.description}>
          Buat struktur awal SOP untuk mulai mengisi prosedur.
        </p>

        <button
          type="button"
          className={styles.button}
          disabled={disabled}
          onClick={handleCreate}
        >
          Buat langkah awal
        </button>
      </div>
    </div>
  );
}
