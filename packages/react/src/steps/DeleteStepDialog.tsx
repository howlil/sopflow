import { useEffect, useState } from "react";
import {
  buildRemoveStepAndReconnectOperations,
  getStepRemovalOptions,
  type SOPDocument,
  type SopOperation,
  type Step,
  type StepId,
} from "@sopflow/core";
import { Button } from "../primitives/Button.js";
import { Dialog } from "../primitives/Dialog.js";
import { FormField as Field } from "../primitives/FormField.js";
import { Select } from "../primitives/Select.js";
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
  const [replacementId, setReplacementId] = useState<StepId>("");
  const removal = getStepRemovalOptions(document, step.id);
  const needsReplacement = removal.requiresReplacement;
  const candidates = removal.candidates;
  const hasNoValidReplacement = needsReplacement && candidates.length === 0;

  useEffect(() => {
    if (!open) return;

    setReplacementId("");
  }, [open]);

  if (!open) {
    return null;
  }

  function handleDelete() {
    if (
      disabled ||
      hasNoValidReplacement ||
      (needsReplacement && !replacementId)
    ) {
      return;
    }

    onOperations(
      buildRemoveStepAndReconnectOperations(
        document,
        step.id,
        replacementId || undefined,
      ),
    );
    onClose();
  }

  return (
    <Dialog
      open={open}
      role="alertdialog"
      title="Hapus langkah"
      description={`Langkah "${step.name || "Tanpa judul"}" akan dihapus.`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={
              disabled ||
              hasNoValidReplacement ||
              (needsReplacement && !replacementId)
            }
            onClick={handleDelete}
          >
            Hapus
          </Button>
        </>
      }
    >
      {needsReplacement ? (
        <>
          <Field
            label="Sambungkan langkah sebelumnya ke"
            className={styles.field}
          >
            <Select
              aria-label="Sambungkan langkah sebelumnya ke"
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
            </Select>
          </Field>

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
    </Dialog>
  );
}
