import { validateSop, type SOPDocument, type StepId } from "@sopflow/core";
import { useCallback, useEffect, useMemo, useState } from "react";

import "./styles/token.css";

import { ActorsEditor } from "./actors/ActorsEditor.js";
import { SopDocumentCanvas } from "./editor/SopDocumentCanvas.js";
import { EditorStatus } from "./editor/EditorStatus.js";
import { useSopHistory } from "./editor/hooks/useSopHistory.js";
import { SopEditorToolbar } from "./editor/SopEditorToolbar.js";
import { SopHeaderFields } from "./header/SopHeaderFields.js";
import styles from "./SopEditor.module.css";
import { AddStepButton } from "./steps/AddStepButton.js";
import { EmptyStepsState } from "./steps/EmptyStepsState.js";
import { SopStepFields } from "./steps/SopStepFields.js";
import type { SopHeaderValue } from "./types.js";
import { ValidationPanel } from "./validation/ValidationPanel.js";

export interface SopEditorProps {
  value: SOPDocument;
  onChange?: (document: SOPDocument) => void;
  header: SopHeaderValue;
  onHeaderChange?: (header: SopHeaderValue) => void;
  selectedStepId?: StepId | null;
  onSelectedStepChange?: (stepId: StepId | null) => void;
  readOnly?: boolean;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export function SopEditor({
  value,
  onChange,
  header,
  onHeaderChange,
  selectedStepId: controlledSelectedStepId,
  onSelectedStepChange: onSelectedStepChangeProp,
  readOnly = false,
  loading = false,
  error = null,
  className,
}: SopEditorProps) {
  const handleChange = useCallback(
    (nextDocument: SOPDocument) => {
      if (readOnly || loading || !onChange) {
        return;
      }

      onChange(nextDocument);
    },
    [loading, onChange, readOnly],
  );
  const handleHeaderChange = useCallback(
    (nextHeader: SopHeaderValue) => {
      if (readOnly || loading || !onHeaderChange) {
        return;
      }

      onHeaderChange(nextHeader);
    },
    [loading, onHeaderChange, readOnly],
  );
  const { applyOperation, applyOperations, undo, redo, canUndo, canRedo } =
    useSopHistory({ value, onChange: handleChange });
  const [internalSelectedStepId, setInternalSelectedStepId] =
    useState<StepId | null>(null);
  const selectedStepId =
    controlledSelectedStepId !== undefined
      ? controlledSelectedStepId
      : internalSelectedStepId;
  const mutationDisabled = readOnly || loading || !onChange;
  const headerDisabled = readOnly || loading || !onHeaderChange;
  const issues = useMemo(() => validateSop(value), [value]);
  const selectedStepIndex = selectedStepId
    ? value.steps.findIndex((step) => step.id === selectedStepId)
    : -1;
  const selectedStep =
    selectedStepIndex >= 0 ? value.steps[selectedStepIndex] : undefined;

  const handleSelectedStepChange = useCallback(
    (stepId: StepId | null) => {
      if (controlledSelectedStepId === undefined) {
        setInternalSelectedStepId(stepId);
      }

      onSelectedStepChangeProp?.(stepId);
    },
    [controlledSelectedStepId, onSelectedStepChangeProp],
  );

  useEffect(() => {
    if (!selectedStepId) {
      return;
    }

    const stillExists = value.steps.some((step) => step.id === selectedStepId);

    if (!stillExists) {
      handleSelectedStepChange(null);
    }
  }, [value.steps, selectedStepId, handleSelectedStepChange]);

  return (
    <div
      data-sopflow-root
      data-disabled={mutationDisabled || undefined}
      data-readonly={readOnly || undefined}
      data-loading={loading || undefined}
      data-error={error ? "true" : undefined}
      aria-busy={loading || undefined}
      className={[styles.root, className].filter(Boolean).join(" ")}
    >
      <EditorStatus loading={loading} error={error} />

      <div className={styles.workspaceScroll}>
        <div className={styles.workspace} data-sopflow-editor-layout>
          <div className={styles.mainPane} data-sopflow-main-pane>
            <SopDocumentCanvas
              document={value}
              header={header}
              issues={issues}
              selectedStepId={selectedStepId}
              onSelectedStepChange={handleSelectedStepChange}
            />
          </div>

          <aside
            className={styles.inspector}
            data-sopflow-inspector
            aria-label={selectedStep ? "Properti langkah" : "Properti SOP"}
          >
            <div className={styles.inspectorHeader}>
              <div className={styles.inspectorHeading}>
                {selectedStep ? (
                  <button
                    type="button"
                    className={styles.backButton}
                    aria-label="Kembali ke properti dokumen"
                    onClick={() => handleSelectedStepChange(null)}
                  >
                    ←
                  </button>
                ) : null}

                <div>
                  <h2 className={styles.inspectorTitle}>
                    {selectedStep
                      ? `Langkah ${selectedStepIndex + 1}`
                      : "Properti"}
                  </h2>
                  {selectedStep ? (
                    <p className={styles.inspectorSubtitle}>
                      {selectedStep.name || "Tanpa judul"}
                    </p>
                  ) : null}
                </div>
              </div>

              {!mutationDisabled ? (
                <SopEditorToolbar
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={undo}
                  onRedo={redo}
                />
              ) : null}
            </div>

            <div className={styles.inspectorContent}>
              {selectedStep ? (
                <SopStepFields
                  document={value}
                  stepId={selectedStep.id}
                  issues={issues}
                  onOperation={applyOperation}
                  onOperations={applyOperations}
                  disabled={mutationDisabled}
                />
              ) : (
                <>
                  <SopHeaderFields
                    document={value}
                    header={header}
                    disabled={readOnly || loading}
                    {...(onChange ? { onDocumentChange: handleChange } : {})}
                    {...(onHeaderChange
                      ? { onHeaderChange: handleHeaderChange }
                      : {})}
                  />

                  <ActorsEditor
                    document={value}
                    onOperation={applyOperation}
                    onOperations={applyOperations}
                    disabled={mutationDisabled}
                  />

                  <section className={styles.procedureActions}>
                    <h3 className={styles.sectionTitle}>Prosedur</h3>

                    {value.steps.length === 0 ? (
                      <EmptyStepsState
                        document={value}
                        onOperations={applyOperations}
                        disabled={mutationDisabled}
                      />
                    ) : (
                      <AddStepButton
                        document={value}
                        onOperations={applyOperations}
                        disabled={mutationDisabled}
                      />
                    )}
                  </section>
                </>
              )}

              <div className={styles.validation}>
                <ValidationPanel issues={issues} />
              </div>
            </div>

            {headerDisabled && !mutationDisabled && !selectedStep ? (
              <p className={styles.inspectorNotice}>
                Header hanya dapat dibaca karena onHeaderChange tidak tersedia.
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
