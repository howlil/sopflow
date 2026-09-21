import type { SOPDocument, StepId, ValidationIssue } from "@sopflow/core";
import { SopHeaderView } from "../header/SopHeaderView.js";
import { SopProcedureView } from "../steps/SopProcedureView.js";
import type { SopHeaderValue } from "../types.js";
import styles from "./SopDocumentCanvas.module.css";

export interface SopDocumentCanvasProps {
  document: SOPDocument;
  header: SopHeaderValue;
  issues: readonly ValidationIssue[];
  selectedStepId: StepId | null;
  onSelectedStepChange?: (stepId: StepId | null) => void;
}

export function SopDocumentCanvas({
  document,
  header,
  issues,
  selectedStepId,
  onSelectedStepChange,
}: SopDocumentCanvasProps) {
  return (
    <main className={styles.canvas}>
      <div className={styles.document} data-sopflow-page="a4">
        <SopHeaderView document={document} header={header} />

        <section className={styles.content}>
          <SopProcedureView
            document={document}
            issues={issues}
            selectedStepId={selectedStepId}
            {...(onSelectedStepChange ? { onSelectedStepChange } : {})}
          />
        </section>
      </div>
    </main>
  );
}
