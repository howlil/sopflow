import {
  buildRemoveActorAndReferencesOperations,
  type Actor,
  type SOPDocument,
  type SopOperation,
} from "@sopflow/core";
import { Button } from "../primitives/Button.js";
import { Dialog } from "../primitives/Dialog.js";

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

    onOperations(buildRemoveActorAndReferencesOperations(document, actor.id));
    onClose();
  }

  return (
    <Dialog
      open={open}
      role="alertdialog"
      title="Hapus pelaksana"
      description={
        <>
          Pelaksana <strong>{actor.name || "Tanpa nama"}</strong> akan dihapus.
        </>
      }
      onClose={onClose}
      footer={
        <>
          <Button type="button" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={disabled}
            onClick={handleDelete}
          >
            Hapus
          </Button>
        </>
      }
    >
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
    </Dialog>
  );
}
