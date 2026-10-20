import { Button } from "../primitives/Button.js";
import type { ReactNode } from "react";
import {
  getPresentationSteps,
  type SOPDocument,
  type SopOperation,
  type Step,
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
import { useStepEditorController } from "./hooks/useStepEditorController.js";
import type { StepDiagnostic } from "../validation/getStepIssues.js";
import type { StepProblemField } from "../workspace/resolveProblemTarget.js";
import styles from "./SopStepCard.module.css";

export interface SopStepCardProps {
  step: Step;
  index: number;
  document: SOPDocument;
  issues: readonly StepDiagnostic[];
  orderedSteps?: readonly Step[];
  stepOrder?: ReadonlyMap<string, number>;
  selected?: boolean;
  highlightedField?: StepProblemField;
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
  orderedSteps,
  stepOrder,
  selected = false,
  highlightedField,
  onSelect,
  onOperation,
  onOperations,
  disabled = false,
}: SopStepCardProps) {
  const {
    changeStepType,
    addAfter,
    isDecisionEditorOpen,
    openDecisionEditor,
    closeDecisionEditor,
    isDeleteDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
    stepIssues,
    hasActorError,
    hasError,
    updateName,
    updateActorIds,
    updateInput,
    updateDuration,
    updateOutput,
    updateNote,
  } = useStepEditorController({
    step,
    document,
    issues,
    onOperation,
    onOperations,
  });

  return (
    <section
      className={styles.card}
      data-sopflow-step-id={step.id}
      data-selected={selected || undefined}
      data-sopflow-highlight-field={highlightedField}
      data-error={hasError || undefined}
      data-disabled={disabled || undefined}
    >
      <header className={styles.header}>
        <Button
          variant="ghost"
          type="button"
          className={styles.selectButton}
          aria-pressed={selected}
          onClick={onSelect}
        >
          <strong className={styles.title}>Langkah {index + 1}</strong>
        </Button>

        <div data-sopflow-step-field="decisionRoutes">
          <StepActions
            step={step}
            disabled={disabled}
            onAddAfter={addAfter}
            onDelete={openDeleteDialog}
            onConfigureDecision={openDecisionEditor}
          />
        </div>
      </header>

      <Field label="Kegiatan" field="name">
        <StepNameField
          error={highlightedField === "name"}
          value={step.name}
          readOnly={disabled}
          onChange={updateName}
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
        <Field label="Tipe" field="type">
          <StepTypeField
            step={step}
            steps={orderedSteps ?? getPresentationSteps(document)}
            {...(stepOrder ? { orderByStepId: stepOrder } : {})}
            readOnly={disabled}
            onChange={changeStepType}
          />
        </Field>

        <Field label="Pelaksana" field="actorIds">
          <ActorField
            value={step.actorIds}
            actors={document.actors}
            readOnly={disabled}
            error={hasActorError || highlightedField === "actorIds"}
            onChange={updateActorIds}
          />
        </Field>
      </div>

      <Field label="Kelengkapan" field="input">
        <InputField
          error={highlightedField === "input"}
          value={step.input}
          readOnly={disabled}
          onChange={updateInput}
        />
      </Field>

      <Field label="Waktu" field="duration">
        <DurationField
          value={step.duration}
          readOnly={disabled}
          onChange={updateDuration}
        />
      </Field>

      <Field label="Output" field="output">
        <OutputField
          error={highlightedField === "output"}
          value={step.output}
          readOnly={disabled}
          onChange={updateOutput}
        />
      </Field>

      <Field label="Keterangan" field="note">
        <NoteField
          error={highlightedField === "note"}
          value={step.note}
          readOnly={disabled}
          onChange={updateNote}
        />
      </Field>

      {!disabled && isDecisionEditorOpen && step.type === "decision" ? (
        <DecisionEditor
          open={isDecisionEditorOpen}
          step={step}
          document={document}
          disabled={disabled}
          onOperations={onOperations}
          onClose={closeDecisionEditor}
        />
      ) : null}

      {!disabled && isDeleteDialogOpen ? (
        <DeleteStepDialog
          open={true}
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

function Field({
  label,
  children,
  field,
}: {
  label: string;
  children: ReactNode;
  field: string;
}) {
  return (
    <div className={styles.field} data-sopflow-step-field={field}>
      <span className={styles.label}>{label}</span>

      {children}
    </div>
  );
}
