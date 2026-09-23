import {
  buildCreateInitialWorkflowOperations,
  type SOPDocument,
  type SopOperation,
} from "@sopflow/core";
import { Button } from "../primitives/Button.js";
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

    onOperations(
      buildCreateInitialWorkflowOperations(document, {
        startId: createStepId(),
        taskId: createStepId(),
        endId: createStepId(),
      }),
    );
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

        <Button
          type="button"
          size="default"
          className={styles.button}
          disabled={disabled}
          onClick={handleCreate}
        >
          Buat langkah awal
        </Button>
      </div>
    </div>
  );
}
