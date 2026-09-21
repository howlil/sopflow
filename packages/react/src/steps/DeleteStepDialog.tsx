import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  applyValidatedOperations,
  getIncomingConnections,
  type SOPDocument,
  type SopOperation,
  type Step,
  type StepId,
} from "@sopflow/core";
import { useDialogFocus } from "../primitives/dialog/useDialogFocus.js";
import styles from "./DeleteStepDialog.module.css";

export interface DeleteStepDialogProps {
  open: boolean;
  step: Step;
  document: SOPDocument;
  onClose: () => void;
  onOperations: (operations: SopOperation[]) => void;
  disabled?: boolean;
}

export function DeleteStepDialog({
  open,
  step,
  document,
  onClose,
  onOperations,
  disabled = false,
}: DeleteStepDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [replacementId, setReplacementId] = useState<StepId>("");
  const incoming = getIncomingConnections(document, step.id);
  const needsReplacement = incoming.length > 0;
  const { dialogRef, handleKeyDown } = useDialogFocus({
    open,
    onClose,
  });

  useEffect(() => {
    if (!open) return;

    setReplacementId("");
  }, [open]);

  if (!open) {
    return null;
  }

  function buildDeleteOperations(targetId?: StepId): SopOperation[] {
    const operations: SopOperation[] = [];

    if (targetId) {
      for (const connection of incoming) {
        if (connection.type === "next") {
          operations.push({
            type: "connect",
            from: connection.from,
            to: targetId,
          });
          continue;
        }

        operations.push({
          type: "connect-decision",
          from: connection.from,
          branch: connection.type,
          to: targetId,
        });
      }
    }

    operations.push({
      type: "remove-step",
      stepId: step.id,
    });

    return operations;
  }

  function isValidReplacement(targetId: StepId): boolean {
    try {
      applyValidatedOperations(document, buildDeleteOperations(targetId));
      return true;
    } catch {
      return false;
    }
  }

  const candidates = document.steps.filter(
    (candidate) =>
      candidate.id !== step.id &&
      (!needsReplacement || isValidReplacement(candidate.id)),
  );
  const hasNoValidReplacement = needsReplacement && candidates.length === 0;

  function handleDelete() {
    if (
      disabled ||
      hasNoValidReplacement ||
      (needsReplacement && !replacementId)
    ) {
      return;
    }

    onOperations(buildDeleteOperations(replacementId || undefined));
    onClose();
  }

  return createPortal(
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            Hapus langkah
          </h2>

          <p id={descriptionId} className={styles.description}>
            Langkah &quot;{step.name || "Tanpa judul"}&quot; akan dihapus.
          </p>
        </header>

        {needsReplacement ? (
          <>
            <label className={styles.field}>
              <span className={styles.label}>
                Sambungkan langkah sebelumnya ke
              </span>

              <select
                className={styles.select}
                value={replacementId}
                disabled={disabled || hasNoValidReplacement}
                onChange={(event) => setReplacementId(event.target.value)}
              >
                <option value="">Pilih langkah</option>

                {candidates.map((candidate, index) => (
                  <option key={candidate.id} value={candidate.id}>
                    {index + 1}. {candidate.name || "Tanpa judul"}
                  </option>
                ))}
              </select>
            </label>

            {hasNoValidReplacement ? (
              <p className={styles.notice}>
                Tidak ada target pengganti yang menjaga workflow tetap valid.
              </p>
            ) : null}
          </>
        ) : (
          <p className={styles.notice}>
            Langkah ini tidak direferensikan oleh langkah lain.
          </p>
        )}

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
            className={styles.dangerButton}
            disabled={
              disabled ||
              hasNoValidReplacement ||
              (needsReplacement && !replacementId)
            }
            onClick={handleDelete}
          >
            Hapus
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
