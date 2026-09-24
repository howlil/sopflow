import { useEffect, useState } from "react";
import {
  buildSetDecisionBranchesOperations,
  getPresentationSteps,
  type DecisionStep,
  type SOPDocument,
  type SopOperation,
  type StepId,
} from "@sopflow/core";
import { Button } from "../primitives/Button.js";
import { Dialog } from "../primitives/Dialog.js";
import { FormField as Field } from "../primitives/FormField.js";
import { Select } from "../primitives/Select.js";
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
  const [yesId, setYesId] = useState<StepId>(step.yes);
  const [noId, setNoId] = useState<StepId>(step.no);

  useEffect(() => {
    if (!open) return;

    setYesId(step.yes);
    setNoId(step.no);
  }, [open, step.yes, step.no]);

  if (!open) {
    return null;
  }

  const orderedSteps = getPresentationSteps(document);
  const orderById = new Map(
    orderedSteps.map((candidate, index) => [candidate.id, index + 1] as const),
  );
  const selectableSteps = orderedSteps.filter(
    (candidate) => candidate.id !== step.id,
  );

  const hasError = !yesId || !noId || yesId === noId;

  function handleSave() {
    if (disabled || hasError) {
      return;
    }

    onOperations(
      buildSetDecisionBranchesOperations(document, step.id, yesId, noId),
    );

    onClose();
  }

  return (
    <Dialog
      open={open}
      title="Atur cabang keputusan"
      description="Pilih tujuan untuk jawaban Ya dan Tidak."
      onClose={onClose}
      footer={
        <>
          <Button type="button" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={disabled || hasError}
            onClick={handleSave}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className={styles.stepInfo}>
        <span className={styles.stepLabel}>Decision</span>
        <strong>{step.name || "Tanpa judul"}</strong>
      </div>

      <div className={styles.fields}>
        <Field label="Tahap jika Tidak">
          <Select
            aria-label="Tahap jika Tidak"
            value={noId}
            disabled={disabled}
            onChange={(event) => setNoId(event.target.value)}
          >
            <option value="">Pilih tahap</option>

            {selectableSteps.map((candidate) => (
              <option
                key={candidate.id}
                value={candidate.id}
                disabled={candidate.id === yesId}
              >
                {orderById.get(candidate.id) ?? "?"}.{" "}
                {candidate.name || "Tanpa judul"}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tahap jika Ya">
          <Select
            aria-label="Tahap jika Ya"
            value={yesId}
            disabled={disabled}
            onChange={(event) => setYesId(event.target.value)}
          >
            <option value="">Pilih tahap</option>

            {selectableSteps.map((candidate) => (
              <option
                key={candidate.id}
                value={candidate.id}
                disabled={candidate.id === noId}
              >
                {orderById.get(candidate.id) ?? "?"}.{" "}
                {candidate.name || "Tanpa judul"}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {hasError ? (
        <p className={styles.error}>
          Cabang Ya dan Tidak harus memiliki tujuan yang berbeda.
        </p>
      ) : null}
    </Dialog>
  );
}
