import type {
  SOPDocument,
  SopOperation,
  StepId,
  ValidationIssue,
} from "@sopflow/core";
import { useState } from "react";
import { SopBpmn } from "../diagram/SopBpmn.js";
import { SopHeaderView } from "../header/SopHeaderView.js";
import {
  SopProcedureView,
  type SopManualPathOffsets,
} from "../steps/SopProcedureView.js";
import { SopStepsEditor } from "../steps/SopStepsEditor.js";
import type { SopHeaderValue } from "../types.js";
import {
  SopDocumentToolbar,
  type SopDiagramKind,
  type SopDocumentMode,
} from "./SopDocumentToolbar.js";
import styles from "./SopDocumentCanvas.module.css";

export interface SopDocumentCanvasProps {
  document: SOPDocument;
  header: SopHeaderValue;
  issues: readonly ValidationIssue[];
  selectedStepId: StepId | null;
  onSelectedStepChange: (stepId: StepId | null) => void;
  onOperation: (operation: SopOperation) => void;
  onOperations: (operations: SopOperation[]) => void;
  mode: SopDocumentMode;
  onModeChange: (mode: SopDocumentMode) => void;
  diagramKind: SopDiagramKind;
  onDiagramKindChange: (kind: SopDiagramKind) => void;
  manualEditing: boolean;
  onManualEditingChange: (editing: boolean) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function SopDocumentCanvas({
  document,
  header,
  issues,
  selectedStepId,
  onSelectedStepChange,
  onOperation,
  onOperations,
  mode,
  onModeChange,
  diagramKind,
  onDiagramKindChange,
  manualEditing,
  onManualEditingChange,
  disabled = false,
  readOnly = false,
}: SopDocumentCanvasProps) {
  const [manualPathOffsets, setManualPathOffsets] =
    useState<SopManualPathOffsets>({});

  return (
    <main className={styles.canvas}>
      <div className={styles.document} data-sopflow-page="a4">
        <SopHeaderView document={document} header={header} />

        <section className={styles.content}>
          <div className={styles.toolbarRow}>
            <SopDocumentToolbar
              mode={mode}
              onModeChange={onModeChange}
              diagramKind={diagramKind}
              onDiagramKindChange={onDiagramKindChange}
              manualEditing={manualEditing}
              onManualEditingChange={onManualEditingChange}
              readOnly={readOnly}
              manualEditingSupported={diagramKind === "flowchart"}
            />
          </div>

          {mode === "steps" ? (
            <SopStepsEditor
              document={document}
              issues={[...issues]}
              selectedStepId={selectedStepId}
              onSelectedStepChange={onSelectedStepChange}
              onOperation={onOperation}
              onOperations={onOperations}
              disabled={disabled}
            />
          ) : diagramKind === "bpmn" ? (
            <SopBpmn
              document={document}
              selectedStepId={selectedStepId}
              onSelectedStepChange={onSelectedStepChange}
            />
          ) : (
            <SopProcedureView
              document={document}
              issues={issues}
              selectedStepId={selectedStepId}
              onSelectedStepChange={onSelectedStepChange}
              manualEditing={manualEditing}
              manualPathOffsets={manualPathOffsets}
              onManualPathOffsetsChange={setManualPathOffsets}
            />
          )}
        </section>
      </div>
    </main>
  );
}
