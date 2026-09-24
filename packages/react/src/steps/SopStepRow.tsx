import {
  getPresentationSteps,
  type SOPDocument,
  type SopOperation,
  type Step,
  type ValidationIssue,
} from "@sopflow/core";
import { ActorField } from "./fields/ActorField.js";
import { DurationField } from "./fields/DurationField.js";
import { InputField } from "./fields/InputField.js";
import { NoteField } from "./fields/NoteField.js";
import { OutputField } from "./fields/OutputField.js";
import { StepActions } from "./StepActions.js";
import { StepTypeField } from "./fields/StepTypeField.js";
import { StepNameField } from "./fields/StepNameField.js";
import { DecisionEditor } from "./DecisionEditor.js";
import { DeleteStepDialog } from "./DeleteStepDialog.js";
import { useStepEditorController } from "./hooks/useStepEditorController.js";
import styles from "./SopStepRow.module.css";

export interface SopStepRowProps {
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

export function SopStepRow({
  step,
  index,
  document,
  issues,
  selected = false,
  onSelect,
  onOperation,
  onOperations,
  disabled = false,
}: SopStepRowProps) {
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
    <>
      <tr
        className={styles.row}
        data-sopflow-step-id={step.id}
        tabIndex={0}
        aria-selected={selected}
        data-error={hasError || undefined}
        data-selected={selected || undefined}
        data-disabled={disabled || undefined}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
      >
        <td className={styles.number}>{index + 1}</td>

        <td>
          <StepNameField
            value={step.name}
            readOnly={disabled}
            onChange={updateName}
          />

          {stepIssues.length > 0 ? (
            <div className={styles.issues}>
              {stepIssues.map((issue) => (
                <p
                  key={`${issue.code}-${issue.message}`}
                  className={styles.issue}
                >
                  {issue.message}
                </p>
              ))}
            </div>
          ) : null}
        </td>

        <td>
          <StepTypeField
            step={step}
            steps={getPresentationSteps(document)}
            readOnly={disabled}
            onChange={changeStepType}
          />
        </td>

        <td>
          <ActorField
            value={step.actorIds}
            actors={document.actors}
            readOnly={disabled}
            error={hasActorError}
            onChange={updateActorIds}
          />
        </td>

        <td>
          <InputField
            value={step.input}
            readOnly={disabled}
            onChange={updateInput}
          />
        </td>

        <td>
          <DurationField
            value={step.duration}
            readOnly={disabled}
            onChange={updateDuration}
          />
        </td>

        <td>
          <OutputField
            value={step.output}
            readOnly={disabled}
            onChange={updateOutput}
          />
        </td>

        <td>
          <NoteField
            value={step.note}
            readOnly={disabled}
            onChange={updateNote}
          />
        </td>

        <td className={styles.actions}>
          <StepActions
            step={step}
            disabled={disabled}
            onAddAfter={addAfter}
            onDelete={openDeleteDialog}
            onConfigureDecision={openDecisionEditor}
          />
        </td>
      </tr>

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
    </>
  );
}
