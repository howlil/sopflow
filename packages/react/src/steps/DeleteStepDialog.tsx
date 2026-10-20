import { useEffect, useState } from "react";
import {
  buildRemoveStepAndReconnectOperations,
  getStepRemovalOptions,
  getPresentationSteps,
  type SOPDocument,
  type SopOperation,
  type Step,
  type StepId,
} from "@sopflow/core";
import { Button } from "../primitives/Button.js";
import { Dialog } from "../primitives/Dialog.js";
import { FormField as Field } from "../primitives/FormField.js";
import { Select } from "../components/arc/select/select.js";
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
  const orderById = new Map(getPresentationSteps(document).map((item, index) => [item.id, index + 1] as const));
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
          <Button type="button" data-sopflow-cancel onClick={onClose}>
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
              compact
              wideMenu
              label="Sambungkan langkah sebelumnya ke"
              value={replacementId}
              placeholder="Pilih langkah"
              disabled={disabled || hasNoValidReplacement}
              onValueChange={setReplacementId}
              options={candidates.map((candidate) => ({
                value: candidate.id,
                label: `${orderById.get(candidate.id) ?? "?"}. ${candidate.name || "Tanpa judul"}`,
              }))}
            />
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
