import { validateSop, type SOPDocument, type StepId } from "@sopflow/core";
import { useCallback, useEffect, useMemo, useState } from "react";

import "./styles/token.css";

import { SopDocumentCanvas } from "./editor/SopDocumentCanvas.js";
import { EditorStatus } from "./editor/EditorStatus.js";
import { useSopHistory } from "./editor/hooks/useSopHistory.js";
import { SopEditorToolbar } from "./editor/SopEditorToolbar.js";
import styles from "./SopEditor.module.css";
import type { SopHeaderValue } from "./types.js";

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
  const issues = useMemo(() => validateSop(value), [value]);

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

      <SopDocumentCanvas
        document={value}
        header={header}
        issues={issues}
        selectedStepId={selectedStepId}
        onSelectedStepChange={handleSelectedStepChange}
        toolbar={
          mutationDisabled ? null : (
            <SopEditorToolbar
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
            />
          )
        }
        {...(onChange ? { onDocumentChange: handleChange } : {})}
        {...(onHeaderChange ? { onHeaderChange: handleHeaderChange } : {})}
        onOperation={applyOperation}
        onOperations={applyOperations}
        disabled={mutationDisabled}
      />
    </div>
  );
}
