import type {
  SOPDocument,
  SopOperation,
  Step,
  StepId,
  ValidationIssue,
} from "@sopflow/core";
import { FormField as Field } from "../primitives/FormField.js";
import { ActorField } from "./fields/ActorField.js";
import { DurationField } from "./fields/DurationField.js";
import { InputField } from "./fields/InputField.js";
import { NoteField } from "./fields/NoteField.js";
import { OutputField } from "./fields/OutputField.js";
import { StepNameField } from "./fields/StepNameField.js";
import { StepTypeField } from "./fields/StepTypeField.js";
import { DecisionEditor } from "./DecisionEditor.js";
import { DeleteStepDialog } from "./DeleteStepDialog.js";
import { StepActions } from "./StepActions.js";
import { useStepEditorController } from "./hooks/useStepEditorController.js";
import { InspectorSection } from "../primitives/InspectorSection.js";
import styles from "./SopStepFields.module.css";

export interface SopStepFieldsProps {
  document: SOPDocument;
  stepId: StepId;
  onOperation: (operation: SopOperation) => void;
  onOperations: (operations: SopOperation[]) => void;
  issues?: readonly ValidationIssue[];
  disabled?: boolean;
  className?: string;
}

export function SopStepFields({
  document,
  stepId,
  onOperation,
  onOperations,
  issues = [],
  disabled = false,
  className,
}: SopStepFieldsProps) {
  const step = document.steps.find((candidate) => candidate.id === stepId);

  if (!step) return null;

  return (
    <SopStepFieldsContent
      document={document}
      step={step}
      onOperation={onOperation}
      onOperations={onOperations}
      issues={issues}
      disabled={disabled}
      {...(className ? { className } : {})}
    />
  );
}

interface SopStepFieldsContentProps {
  document: SOPDocument;
  step: Step;
  onOperation: (operation: SopOperation) => void;
  onOperations: (operations: SopOperation[]) => void;
  issues: readonly ValidationIssue[];
  disabled: boolean;
  className?: string;
}

function SopStepFieldsContent({
  document,
  step,
  onOperation,
  onOperations,
  issues,
  disabled,
  className,
}: SopStepFieldsContentProps) {
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
    <div
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-sopflow-step-fields={step.id}
      data-sopflow-step-id={step.id}
    >
      <InspectorSection title="Kegiatan" headingLevel="h3">
        <StepNameField
          value={step.name}
          readOnly={disabled}
          onChange={updateName}
        />
      </InspectorSection>

      <InspectorSection title="Tipe dan pelaksana" headingLevel="h3">
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
            onChange={updateActorIds}
          />
        </Field>
      </InspectorSection>

      <InspectorSection title="Mutu baku" headingLevel="h3">
        <Field label="Kelengkapan">
          <InputField
            value={step.input}
            readOnly={disabled}
            onChange={updateInput}
          />
        </Field>

        <Field label="Waktu">
          <DurationField
            value={step.duration}
            readOnly={disabled}
            onChange={updateDuration}
          />
        </Field>

        <Field label="Output">
          <OutputField
            value={step.output}
            readOnly={disabled}
            onChange={updateOutput}
          />
        </Field>
      </InspectorSection>

      <InspectorSection title="Keterangan" headingLevel="h3">
        <NoteField
          value={step.note}
          readOnly={disabled}
          onChange={updateNote}
        />
      </InspectorSection>

      <InspectorSection title="Alur" headingLevel="h3">
        <div className={styles.flowSummary}>{flowSummary(step, document)}</div>
      </InspectorSection>

      {stepIssues.length > 0 ? (
        <InspectorSection title="Masalah" headingLevel="h3">
          <ul className={styles.issueList}>
            {stepIssues.map((issue) => (
              <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </InspectorSection>
      ) : null}

      {!disabled ? (
        <section className={styles.actions}>
          <span className={styles.actionLabel}>Aksi langkah</span>
          <StepActions
            step={step}
            onAddAfter={addAfter}
            onDelete={openDeleteDialog}
            onConfigureDecision={openDecisionEditor}
          />
        </section>
      ) : null}

      {step.type === "decision" ? (
        <DecisionEditor
          open={isDecisionEditorOpen}
          step={step}
          document={document}
          disabled={disabled}
          onOperations={onOperations}
          onClose={closeDecisionEditor}
        />
      ) : null}

      <DeleteStepDialog
        open={isDeleteDialogOpen}
        step={step}
        document={document}
        disabled={disabled}
        onOperations={onOperations}
        onClose={closeDeleteDialog}
      />
    </div>
  );
}

function flowSummary(step: Step, document: SOPDocument): string {
  const label = (id: StepId) => {
    const index = document.steps.findIndex((candidate) => candidate.id === id);
    const target = document.steps[index];

    if (!target) return "Target tidak ditemukan";

    return `${index + 1}. ${target.name || "Tanpa judul"}`;
  };

  if (step.type === "end") return "Langkah akhir.";

  if (step.type === "decision") {
    return `Ya → ${label(step.yes)} · Tidak → ${label(step.no)}`;
  }

  return `Lanjut → ${label(step.next)}`;
}
