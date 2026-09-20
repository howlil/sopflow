import type { ReactNode } from "react";
import type {
  SOPDocument,
  SopOperation,
  StepId,
  ValidationIssue,
} from "@sopflow/core";
import type { SopHeaderValue } from "../types.js";
import { ActorsEditor } from "../actors/ActorsEditor.js";
import { SopHeaderEditor } from "../header/SopHeaderEditor.js";
import { SopStepsEditor } from "../steps/SopStepsEditor.js";
import { ValidationPanel } from "../validation/ValidationPanel.js";
import styles from "./SopDocumentCanvas.module.css";

export interface SopDocumentCanvasProps {
  document: SOPDocument;
  header: SopHeaderValue;
  issues: ValidationIssue[];
  selectedStepId: StepId | null;
  onSelectedStepChange: (stepId: StepId | null) => void;
  toolbar?: ReactNode;
  onDocumentChange?: (document: SOPDocument) => void;
  onHeaderChange?: (header: SopHeaderValue) => void;
  onOperation: (operation: SopOperation) => void;
  onOperations: (operations: SopOperation[]) => void;
  disabled?: boolean;
}

export function SopDocumentCanvas({
  document,
  header,
  issues,
  selectedStepId,
  onSelectedStepChange,
  toolbar,
  onDocumentChange,
  onHeaderChange,
  onOperation,
  onOperations,
  disabled = false,
}: SopDocumentCanvasProps) {
  return (
    <main className={styles.canvas}>
      <div className={styles.document} data-sopflow-page="a4">
        <SopHeaderEditor
          document={document}
          header={header}
          onChange={onDocumentChange ?? (() => undefined)}
          onHeaderChange={onHeaderChange ?? (() => undefined)}
          readOnly={disabled || !onDocumentChange || !onHeaderChange}
        />

        {toolbar ? <div className={styles.toolbar}>{toolbar}</div> : null}

        <div className={styles.actors}>
          <ActorsEditor
            document={document}
            onOperation={onOperation}
            onOperations={onOperations}
            disabled={disabled}
          />
        </div>

        <section className={styles.content}>
          <SopStepsEditor
            document={document}
            issues={issues}
            selectedStepId={selectedStepId}
            onSelectedStepChange={onSelectedStepChange}
            onOperation={onOperation}
            onOperations={onOperations}
            disabled={disabled}
          />

          <div className={styles.validation}>
            <ValidationPanel issues={issues} />
          </div>
        </section>
      </div>
    </main>
  );
}
