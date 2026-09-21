import {
  buildInsertTaskBeforeEndOperations,
  type SOPDocument,
  type SopOperation,
} from "@sopflow/core";
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
  const endCount = document.steps.filter((step) => step.type === "end").length;
  const canAdd = endCount === 1;
  const hasMultipleEnds = endCount > 1;

  function handleAdd() {
    if (disabled || !canAdd) {
      return;
    }

    onOperations(
      buildInsertTaskBeforeEndOperations(document, createStepId()),
    );
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
