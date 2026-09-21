import type {
  SOPDocument,
  SopOperation,
  StepId,
  ValidationIssue,
} from "@sopflow/core";
import type { SopHeaderValue } from "../types.js";
import { SopHeaderView } from "../header/SopHeaderView.js";
import { SopStepsEditor } from "../steps/SopStepsEditor.js";
import { ValidationPanel } from "../validation/ValidationPanel.js";
import styles from "./SopDocumentCanvas.module.css";

export interface SopDocumentCanvasProps {
  document: SOPDocument;
  header: SopHeaderValue;
  issues: ValidationIssue[];
  selectedStepId: StepId | null;
  onSelectedStepChange: (stepId: StepId | null) => void;
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
  onOperation,
  onOperations,
  disabled = false,
}: SopDocumentCanvasProps) {
  return (
    <main className={styles.canvas}>
      <div className={styles.document} data-sopflow-page="a4">
        <SopHeaderView document={document} header={header} />

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
