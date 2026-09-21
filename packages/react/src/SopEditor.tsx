import {
  applyOperation as applySopOperation,
  applyOperations as applySopOperations,
  validateSop,
  type SOPDocument,
  type SopOperation,
  type StepId,
} from "@sopflow/core";
import type { SopDiagramConfig } from "@sopflow/diagram";
import { useCallback, useMemo, useState } from "react";

import "./styles/token.css";

import { ActorsEditor } from "./actors/ActorsEditor.js";
import { SopDocumentCanvas } from "./editor/SopDocumentCanvas.js";
import type {
  SopDiagramKind,
  SopDocumentMode,
} from "./editor/SopDocumentToolbar.js";
import { EditorStatus } from "./editor/EditorStatus.js";
import { SopHeaderFields } from "./header/SopHeaderFields.js";
import styles from "./SopEditor.module.css";
import type { SopHeaderValue } from "./types.js";

export interface SopEditorProps {
  value: SOPDocument;
  onChange?: (document: SOPDocument) => void;
  header: SopHeaderValue;
  onHeaderChange?: (header: SopHeaderValue) => void;
  selectedStepId?: StepId | null;
  onSelectedStepChange?: (stepId: StepId | null) => void;
  mode?: SopDocumentMode;
  onModeChange?: (mode: SopDocumentMode) => void;
  diagramKind?: SopDiagramKind;
  onDiagramKindChange?: (kind: SopDiagramKind) => void;
  diagramConfig?: SopDiagramConfig;
  onDiagramConfigChange?: (config: SopDiagramConfig) => void;
  manualEditing?: boolean;
  onManualEditingChange?: (editing: boolean) => void;
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
  mode: controlledMode,
  onModeChange,
  diagramKind: controlledDiagramKind,
  onDiagramKindChange,
  diagramConfig: controlledDiagramConfig,
  onDiagramConfigChange,
  manualEditing: controlledManualEditing,
  onManualEditingChange,
  readOnly = false,
  loading = false,
  error = null,
  className,
}: SopEditorProps) {
  const handleChange = useCallback(
    (nextDocument: SOPDocument) => {
      if (readOnly || loading || !onChange) return;
      onChange(nextDocument);
    },
    [loading, onChange, readOnly],
  );
  const handleHeaderChange = useCallback(
    (nextHeader: SopHeaderValue) => {
      if (readOnly || loading || !onHeaderChange) return;
      onHeaderChange(nextHeader);
    },
    [loading, onHeaderChange, readOnly],
  );

  const applyOperation = useCallback(
    (operation: SopOperation) => {
      handleChange(applySopOperation(value, operation));
    },
    [handleChange, value],
  );
  const applyOperations = useCallback(
    (operations: SopOperation[]) => {
      handleChange(applySopOperations(value, operations));
    },
    [handleChange, value],
  );

  const [internalSelectedStepId, setInternalSelectedStepId] =
    useState<StepId | null>(null);
  const [internalMode, setInternalMode] = useState<SopDocumentMode>("preview");
  const [internalDiagramKind, setInternalDiagramKind] =
    useState<SopDiagramKind>("flowchart");
  const [internalDiagramConfig, setInternalDiagramConfig] =
    useState<SopDiagramConfig>({});
  const [internalManualEditing, setInternalManualEditing] = useState(false);

  const selectedStepId =
    controlledSelectedStepId !== undefined
      ? controlledSelectedStepId
      : internalSelectedStepId;
  const mode = controlledMode ?? internalMode;
  const diagramKind = controlledDiagramKind ?? internalDiagramKind;
  const diagramConfig = controlledDiagramConfig ?? internalDiagramConfig;
  const manualEditing = controlledManualEditing ?? internalManualEditing;
  const diagramConfigMutable =
    controlledDiagramConfig === undefined ||
    onDiagramConfigChange !== undefined;

  const mutationDisabled = readOnly || loading || !onChange;
  const headerDisabled = readOnly || loading || !onHeaderChange;
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

  const handleDiagramConfigChange = useCallback(
    (nextConfig: SopDiagramConfig) => {
      if (controlledDiagramConfig === undefined) {
        setInternalDiagramConfig(nextConfig);
      }
      onDiagramConfigChange?.(nextConfig);
    },
    [controlledDiagramConfig, onDiagramConfigChange],
  );

  const handleManualEditingChange = useCallback(
    (editing: boolean) => {
      if (controlledManualEditing === undefined) {
        setInternalManualEditing(editing);
      }
      onManualEditingChange?.(editing);
    },
    [controlledManualEditing, onManualEditingChange],
  );

  const handleModeChange = useCallback(
    (nextMode: SopDocumentMode) => {
      if (controlledMode === undefined) {
        setInternalMode(nextMode);
      }
      onModeChange?.(nextMode);
      if (nextMode === "steps") {
        handleManualEditingChange(false);
      }
    },
    [controlledMode, handleManualEditingChange, onModeChange],
  );

  const handleDiagramKindChange = useCallback(
    (nextKind: SopDiagramKind) => {
      if (controlledDiagramKind === undefined) {
        setInternalDiagramKind(nextKind);
      }
      onDiagramKindChange?.(nextKind);
      if (nextKind !== "flowchart") {
        handleManualEditingChange(false);
      }
    },
    [controlledDiagramKind, handleManualEditingChange, onDiagramKindChange],
  );

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
              onOperation={applyOperation}
              onOperations={applyOperations}
              mode={mode}
              onModeChange={handleModeChange}
              diagramKind={diagramKind}
              onDiagramKindChange={handleDiagramKindChange}
              manualEditing={manualEditing}
              onManualEditingChange={handleManualEditingChange}
              diagramConfig={diagramConfig}
              onDiagramConfigChange={handleDiagramConfigChange}
              manualEditingSupported={diagramConfigMutable}
              disabled={mutationDisabled}
              readOnly={readOnly}
            />
          </div>

          <aside
            className={styles.inspector}
            data-sopflow-inspector
            aria-label="Properti SOP"
          >
            <div className={styles.inspectorHeader}>
              <h2 className={styles.inspectorTitle}>Properti</h2>
            </div>

            <div className={styles.inspectorContent}>
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
            </div>

            {headerDisabled && !mutationDisabled ? (
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

export type { SopDiagramConfig, SopDiagramKind, SopDocumentMode };
