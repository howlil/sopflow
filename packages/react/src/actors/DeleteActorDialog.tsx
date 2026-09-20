import { useId } from "react";
import { createPortal } from "react-dom";
import type { Actor, SOPDocument, SopOperation } from "@sopflow/core";
import { useDialogFocus } from "../primitives/dialog/useDialogFocus.js";

import styles from "./DeleteActorDialog.module.css";

export interface DeleteActorDialogProps {
  open: boolean;
  actor: Actor;
  document: SOPDocument;

  onClose: () => void;
  onOperations: (operations: SopOperation[]) => void;

  disabled?: boolean;
}

export function DeleteActorDialog({
  open,
  actor,
  document,
  onClose,
  onOperations,
  disabled = false,
}: DeleteActorDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const { dialogRef, handleKeyDown } = useDialogFocus({
    open,
    onClose,
  });

  if (!open) {
    return null;
  }

  const usedBy = document.steps.filter((step) =>
    step.actorIds.includes(actor.id),
  );

  function handleDelete() {
    if (disabled) {
      return;
    }

    const operations: SopOperation[] = usedBy.map((step) => ({
      type: "update-step",
      step: {
        ...step,
        actorIds: step.actorIds.filter((actorId) => actorId !== actor.id),
      },
    }));

    operations.push({
      type: "remove-actor",
      actorId: actor.id,
    });

    onOperations(operations);
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
            Hapus pelaksana
          </h2>

          <p id={descriptionId} className={styles.description}>
            Pelaksana <strong>{actor.name || "Tanpa nama"}</strong> akan
            dihapus.
          </p>
        </header>

        {usedBy.length > 0 ? (
          <div className={styles.warning}>
            <p className={styles.warningTitle}>
              Pelaksana digunakan oleh {usedBy.length} langkah.
            </p>

            <ul className={styles.stepList}>
              {usedBy.map((step) => (
                <li key={step.id}>{step.name || "Tanpa judul"}</li>
              ))}
            </ul>

            <p className={styles.warningText}>
              Referensi pelaksana pada langkah tersebut juga akan dihapus.
            </p>
          </div>
        ) : (
          <p className={styles.notice}>
            Pelaksana ini belum digunakan oleh langkah mana pun.
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
            disabled={disabled}
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
