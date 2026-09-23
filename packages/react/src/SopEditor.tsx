import {
  applyOperation as applySopOperation,
  applyOperations as applySopOperations,
  validateSop,
  type SOPDocument,
  type SopOperation,
  type StepId,
} from "@sopflow/core";
import type { SopDiagramConfig } from "@sopflow/diagram";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { getSopReadinessIssues } from "./validation/readiness.js";
import type { SopReadinessIssue } from "./validation/readiness.js";
import { ValidationPanel } from "./validation/ValidationPanel.js";

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
  onReadinessChange?: (issues: readonly SopReadinessIssue[]) => void;
  showValidationPanel?: boolean;
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
  onReadinessChange,
  showValidationPanel = true,
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
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const openInspectorRef = useRef<HTMLButtonElement>(null);
  const closeInspectorRef = useRef<HTMLButtonElement>(null);
  const previousInspectorOpen = useRef(inspectorOpen);

  useEffect(() => {
    if (previousInspectorOpen.current !== inspectorOpen) {
      (inspectorOpen ? closeInspectorRef : openInspectorRef).current?.focus();
      previousInspectorOpen.current = inspectorOpen;
    }
  }, [inspectorOpen]);

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
  const readinessIssues = useMemo(
    () => getSopReadinessIssues(value, header, issues),
    [header, issues, value],
  );

  useEffect(() => {
    onReadinessChange?.(readinessIssues);
  }, [onReadinessChange, readinessIssues]);

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
      data-sopflow-ready={readinessIssues.length === 0 ? "true" : "false"}
      aria-busy={loading || undefined}
      className={[styles.root, className].filter(Boolean).join(" ")}
    >
      <EditorStatus loading={loading} error={error} />
      {showValidationPanel ? (
        <ValidationPanel issues={readinessIssues} />
      ) : null}

      <div className={styles.workspaceScroll}>
        <div
          className={styles.workspace}
          data-sopflow-editor-layout
          data-mode={mode}
          data-inspector-open={inspectorOpen}
        >
          <div className={styles.mainPane} data-sopflow-main-pane>
            {!inspectorOpen ? (
              <button
                type="button"
                className={styles.openInspector}
                aria-label="Buka panel properti"
                title="Buka panel properti"
                ref={openInspectorRef}
                onClick={() => setInspectorOpen(true)}
              >
                <InspectorIcon />
              </button>
            ) : null}
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

          {inspectorOpen ? (
            <aside
              className={styles.inspector}
              data-sopflow-inspector
              aria-label="Properti SOP"
            >
              <div className={styles.inspectorHeader}>
                <h2 className={styles.inspectorTitle}>Properti</h2>
                <button
                  type="button"
                  className={styles.inspectorToggle}
                  aria-label="Tutup panel properti"
                  title="Tutup panel properti"
                  ref={closeInspectorRef}
                  onClick={() => setInspectorOpen(false)}
                >
                  <InspectorIcon />
                </button>
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
                  Header hanya dapat dibaca karena onHeaderChange tidak
                  tersedia.
                </p>
              ) : null}
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export type { SopDiagramConfig, SopDiagramKind, SopDocumentMode };

function InspectorIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="2.25"
        y="2.25"
        width="11.5"
        height="11.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6 2.75V13.25M9.25 6.25H11.5M9.25 8H11.5M9.25 9.75H11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
