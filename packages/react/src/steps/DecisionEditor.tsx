import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import type {
  DecisionStep,
  SOPDocument,
  SopOperation,
  StepId,
} from "@sopflow/core";
import { useDialogFocus } from "../primitives/dialog/useDialogFocus.js";
import styles from "./DecisionEditor.module.css";

export interface DecisionEditorProps {
  open: boolean;
  step: DecisionStep;
  document: SOPDocument;
  onClose: () => void;
  onOperations: (operations: SopOperation[]) => void;
  disabled?: boolean;
}

export function DecisionEditor({
  open,
  step,
  document,
  onClose,
  onOperations,
  disabled = false,
}: DecisionEditorProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [yesId, setYesId] = useState<StepId>(step.yes);
  const [noId, setNoId] = useState<StepId>(step.no);
  const { dialogRef, handleKeyDown } = useDialogFocus({
    open,
    onClose,
  });

  useEffect(() => {
    if (!open) return;

    setYesId(step.yes);
    setNoId(step.no);
  }, [open, step.yes, step.no]);

  if (!open) {
    return null;
  }

  const selectableSteps = document.steps.filter(
    (candidate) => candidate.id !== step.id,
  );

  const hasError = !yesId || !noId || yesId === noId;

  function handleSave() {
    if (disabled || hasError) {
      return;
    }

    onOperations([
      {
        type: "connect-decision",
        from: step.id,
        branch: "yes",
        to: yesId,
      },
      {
        type: "connect-decision",
        from: step.id,
        branch: "no",
        to: noId,
      },
    ]);

    onClose();
  }

  return createPortal(
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        data-error={hasError || undefined}
        data-disabled={disabled || undefined}
        onKeyDown={handleKeyDown}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            Atur cabang keputusan
          </h2>

          <p id={descriptionId} className={styles.description}>
            Pilih langkah tujuan untuk jawaban Ya dan Tidak.
          </p>
        </header>

        <div className={styles.stepInfo}>
          <span className={styles.stepLabel}>Decision</span>

          <strong>{step.name || "Tanpa judul"}</strong>
        </div>

        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.label}>Tahap jika Tidak</span>

            <select
              className={styles.select}
              value={noId}
              disabled={disabled}
              onChange={(event) => setNoId(event.target.value)}
            >
              <option value="">Pilih tahap</option>

              {selectableSteps.map((candidate, index) => (
                <option
                  key={candidate.id}
                  value={candidate.id}
                  disabled={candidate.id === yesId}
                >
                  {index + 1}. {candidate.name || "Tanpa judul"}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Tahap jika Ya</span>

            <select
              className={styles.select}
              value={yesId}
              disabled={disabled}
              onChange={(event) => setYesId(event.target.value)}
            >
              <option value="">Pilih tahap</option>

              {selectableSteps.map((candidate, index) => (
                <option
                  key={candidate.id}
                  value={candidate.id}
                  disabled={candidate.id === noId}
                >
                  {index + 1}. {candidate.name || "Tanpa judul"}
                </option>
              ))}
            </select>
          </label>
        </div>

        {hasError ? (
          <p className={styles.error}>
            Cabang Ya dan Tidak harus memiliki tujuan yang berbeda.
          </p>
        ) : null}

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClose}
          >
            Batal
          </button>

          <button
            type="button"
            className={styles.primaryButton}
            disabled={disabled || hasError}
            onClick={handleSave}
          >
            Simpan
          </button>
        </footer>
      </div>
      <button
        type="button"
        className={styles.backdropClose}
        aria-label="Tutup dialog"
        onClick={onClose}
      />
    </div>,
    globalThis.document.body,
  );
}
