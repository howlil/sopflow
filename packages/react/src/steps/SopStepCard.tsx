import type { ReactNode } from "react";
import type {
  SOPDocument,
  SopOperation,
  Step,
  ValidationIssue,
} from "@sopflow/core";
import { ActorField } from "./fields/ActorField.js";
import { DurationField } from "./fields/DurationField.js";
import { InputField } from "./fields/InputField.js";
import { NoteField } from "./fields/NoteField.js";
import { OutputField } from "./fields/OutputField.js";
import { StepNameField } from "./fields/StepNameField.js";
import { StepTypeField } from "./fields/StepTypeField.js";
import { StepActions } from "./StepActions.js";
import { DecisionEditor } from "./DecisionEditor.js";
import { DeleteStepDialog } from "./DeleteStepDialog.js";
import { useStepActions } from "./hooks/useStepActions.js";
import { getStepIssues, hasStepIssue } from "../validation/getStepIssues.js";
import styles from "./SopStepCard.module.css";

export interface SopStepCardProps {
  step: Step;
  index: number;
  document: SOPDocument;
  issues: ValidationIssue[];
  selected?: boolean;
  onSelect: () => void;
  onOperation: (operation: SopOperation) => void;
  onOperations: (operations: SopOperation[]) => void;
  disabled?: boolean;
}

export function SopStepCard({
  step,
  index,
  document,
  issues,
  selected = false,
  onSelect,
  onOperation,
  onOperations,
  disabled = false,
}: SopStepCardProps) {
  const {
    updateStep,
    changeStepType,
    addAfter,
    isDecisionEditorOpen,
    openDecisionEditor,
    closeDecisionEditor,
    isDeleteDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
  } = useStepActions({
    step,
    document,
    onOperation,
    onOperations,
  });

  const stepIssues = getStepIssues(issues, step.id);
  const hasActorError = hasStepIssue(issues, step.id, [
    "UNKNOWN_ACTOR_REFERENCE",
  ]);
  const hasWorkflowError = hasStepIssue(issues, step.id, [
    "UNKNOWN_STEP_REFERENCE",
    "CANNOT_REACH_END",
    "UNREACHABLE_STEP",
  ]);
  const hasError = stepIssues.length > 0 || hasWorkflowError;

  return (
    <section
      className={styles.card}
      data-sopflow-step-id={step.id}
      data-selected={selected || undefined}
      data-error={hasError || undefined}
      data-disabled={disabled || undefined}
    >
      <header className={styles.header}>
        <button
          type="button"
          className={styles.selectButton}
          aria-pressed={selected}
          onClick={onSelect}
        >
          <strong className={styles.title}>Langkah {index + 1}</strong>
        </button>

        <StepActions
          step={step}
          disabled={disabled}
          onAddAfter={addAfter}
          onDelete={openDeleteDialog}
          onConfigureDecision={openDecisionEditor}
        />
      </header>

      <Field label="Kegiatan">
        <StepNameField
          value={step.name}
          readOnly={disabled}
          onChange={(name) =>
            updateStep({
              ...step,
              name,
            })
          }
        />
      </Field>

      {stepIssues.length > 0 ? (
        <div className={styles.issues}>
          {stepIssues.map((issue) => (
            <p key={`${issue.code}-${issue.message}`} className={styles.issue}>
              {issue.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className={styles.twoColumns}>
        <Field label="Tipe">
          <StepTypeField
            step={step}
            steps={document.steps}
            readOnly={disabled}
            onChange={changeStepType}
          />
        </Field>

        <Field label="Pelaksana">
          <ActorField
            value={step.actorIds}
            actors={document.actors}
            readOnly={disabled}
            error={hasActorError}
            onChange={(actorIds) =>
              updateStep({
                ...step,
                actorIds,
              })
            }
          />
        </Field>
      </div>

      <Field label="Kelengkapan">
        <InputField
          value={step.input}
          readOnly={disabled}
          onChange={(input) =>
            updateStep({
              ...step,
              input: input || undefined,
            })
          }
        />
      </Field>

      <Field label="Waktu">
        <DurationField
          value={step.duration}
          readOnly={disabled}
          onChange={(duration) =>
            updateStep({
              ...step,
              duration,
            })
          }
        />
      </Field>

      <Field label="Output">
        <OutputField
          value={step.output}
          readOnly={disabled}
          onChange={(output) =>
            updateStep({
              ...step,
              output: output || undefined,
            })
          }
        />
      </Field>

      <Field label="Keterangan">
        <NoteField
          value={step.note}
          readOnly={disabled}
          onChange={(note) =>
            updateStep({
              ...step,
              note: note || undefined,
            })
          }
        />
      </Field>

      {!disabled && step.type === "decision" ? (
        <DecisionEditor
          open={isDecisionEditorOpen}
          step={step}
          document={document}
          disabled={disabled}
          onOperations={onOperations}
          onClose={closeDecisionEditor}
        />
      ) : null}

      {!disabled ? (
        <DeleteStepDialog
          open={isDeleteDialogOpen}
          step={step}
          document={document}
          disabled={disabled}
          onOperations={onOperations}
          onClose={closeDeleteDialog}
        />
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>

      {children}
    </div>
  );
}
