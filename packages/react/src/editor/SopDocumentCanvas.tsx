import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type {
  SOPDocument,
  SopOperation,
  StepId,
  ValidationIssue,
} from "@sopflow/core";
import type { SopDiagramConfig } from "@sopflow/diagram";
import { SopBpmn } from "../diagram/SopBpmn.js";
import { SopHeaderView } from "../header/SopHeaderView.js";
import { SopProcedureView } from "../diagram/SopProcedureView.js";
import { SopStepsEditor } from "../steps/SopStepsEditor.js";
import type { SopHeaderValue } from "../header/types.js";
import {
  SopDocumentToolbar,
  type SopDiagramKind,
  type SopDocumentMode,
} from "./SopDocumentToolbar.js";
import styles from "./SopDocumentCanvas.module.css";

interface ProcedurePageBudget {
  readonly pageHeightPx: number;
  readonly firstPageReservedHeightPx: number;
  readonly nextPageReservedHeightPx: number;
}

const PROCEDURE_TABLE_CHROME_RESERVE_PX = 120;

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
  diagramConfig: SopDiagramConfig;
  onDiagramConfigChange: (config: SopDiagramConfig) => void;
  manualEditingSupported?: boolean;
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
  diagramConfig,
  onDiagramConfigChange,
  manualEditingSupported = true,
  disabled = false,
  readOnly = false,
}: SopDocumentCanvasProps) {
  const diagramPanelId = useId();
  const documentRef = useRef<HTMLDivElement>(null);
  const diagramPanelRef = useRef<HTMLElement>(null);
  const [procedurePageBudget, setProcedurePageBudget] =
    useState<ProcedurePageBudget | null>(null);

  const measureProcedurePageBudget = useCallback(() => {
    if (mode === "steps" || diagramKind !== "flowchart") {
      setProcedurePageBudget(null);
      return;
    }

    const page = documentRef.current;
    const panel = diagramPanelRef.current;
    if (!page || !panel) return;

    const style = getComputedStyle(page);
    const pageHeight = Number.parseFloat(style.minHeight);
    const paddingTop = Number.parseFloat(style.paddingTop);
    const paddingBottom = Number.parseFloat(style.paddingBottom);
    if (
      !Number.isFinite(pageHeight) ||
      !Number.isFinite(paddingTop) ||
      !Number.isFinite(paddingBottom)
    ) {
      return;
    }

    const contentHeight = Math.max(1, pageHeight - paddingTop - paddingBottom);
    const pageRect = page.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const consumedBeforeDiagram = Math.max(
      0,
      panelRect.top - (pageRect.top + paddingTop),
    );
    const firstPageReservedHeightPx = Math.min(
      contentHeight - 1,
      consumedBeforeDiagram + PROCEDURE_TABLE_CHROME_RESERVE_PX,
    );
    const nextPageReservedHeightPx = Math.min(
      contentHeight - 1,
      PROCEDURE_TABLE_CHROME_RESERVE_PX,
    );
    const next: ProcedurePageBudget = {
      pageHeightPx: contentHeight,
      firstPageReservedHeightPx,
      nextPageReservedHeightPx,
    };

    setProcedurePageBudget((current) =>
      current &&
      current.pageHeightPx === next.pageHeightPx &&
      current.firstPageReservedHeightPx === next.firstPageReservedHeightPx &&
      current.nextPageReservedHeightPx === next.nextPageReservedHeightPx
        ? current
        : next,
    );
  }, [diagramKind, mode]);

  useLayoutEffect(() => {
    measureProcedurePageBudget();

    const page = documentRef.current;
    const panel = diagramPanelRef.current;
    if (!page || !panel || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measureProcedurePageBudget);
    observer.observe(page);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [measureProcedurePageBudget]);

  return (
    <div className={styles.canvasStage} data-sopflow-canvas-stage>
      <main className={styles.canvas}>
        <div
          ref={documentRef}
          className={styles.document}
          data-sopflow-page="a4"
        >
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
                diagramPanelId={diagramPanelId}
                readOnly={readOnly}
                manualEditingSupported={
                  diagramKind === "flowchart" && manualEditingSupported
                }
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
            ) : (
              <section
                ref={diagramPanelRef}
                id={diagramPanelId}
                className={styles.diagramPanel}
                role="tabpanel"
                aria-labelledby={`${diagramPanelId}-tab-${diagramKind}`}
                data-sopflow-diagram-panel
                data-diagram-kind={diagramKind}
              >
                {diagramKind === "bpmn" ? (
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
                    diagramConfig={diagramConfig}
                    onDiagramConfigChange={onDiagramConfigChange}
                    {...(procedurePageBudget
                      ? {
                          pageHeightPx: procedurePageBudget.pageHeightPx,
                          firstPageReservedHeightPx:
                            procedurePageBudget.firstPageReservedHeightPx,
                          nextPageReservedHeightPx:
                            procedurePageBudget.nextPageReservedHeightPx,
                        }
                      : {})}
                  />
                )}
              </section>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
