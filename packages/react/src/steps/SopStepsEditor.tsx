import {
  getPresentationSteps,
  type SOPDocument,
  type SopOperation,
  type StepId,
  type ValidationIssue,
} from "@sopflow/core";
import { useEffect, useRef } from "react";
import styles from "./SopStepsEditor.module.css";
import { AddStepButton } from "./AddStepButton.js";
import { EmptyStepsState } from "./EmptyStepsState.js";
import { SopStepCard } from "./SopStepCard.js";
import { SopStepRow } from "./SopStepRow.js";
import { useStepKeyboardNavigation } from "./hooks/useStepKeyboardNavigation.js";

export interface SopStepsEditorProps {
  document: SOPDocument;
  issues: ValidationIssue[];
  selectedStepId: StepId | null;
  onSelectedStepChange: (stepId: StepId | null) => void;
  onOperation: (operation: SopOperation) => void;
  onOperations: (operations: SopOperation[]) => void;
  disabled?: boolean;
}
export function SopStepsEditor({
  document,
  issues,
  selectedStepId,
  onSelectedStepChange,
  onOperation,
  onOperations,
  disabled = false,
}: SopStepsEditorProps) {
  const editorRef = useRef<HTMLElement>(null);
  const steps = getPresentationSteps(document);
  const handleKeyDown = useStepKeyboardNavigation({
    document,
    selectedStepId,
    onSelectedStepChange,
  });
  const keyboardNavigationProps = {
    tabIndex: 0,
    onKeyDown: handleKeyDown,
  };

  useEffect(() => {
    if (!selectedStepId) {
      return;
    }

    const root = editorRef.current;

    if (!root) {
      return;
    }

    const candidates = root.querySelectorAll<HTMLElement>(
      "[data-sopflow-step-id]",
    );
    const selectedElement = Array.from(candidates).find(
      (element) =>
        element.dataset.sopflowStepId === selectedStepId &&
        element.getClientRects().length > 0,
    );

    if (!selectedElement) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    selectedElement.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedStepId]);

  return (
    <section
      ref={editorRef}
      className={styles.editor}
      aria-label="Navigasi langkah SOP"
      data-empty={steps.length === 0 || undefined}
      data-disabled={disabled || undefined}
      {...keyboardNavigationProps}
    >
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Edit langkah / prosedur</h2>

          <p className={styles.description}>
            Nomor mengikuti urutan baris. Geser tabel secara horizontal untuk
            melihat semua kolom.
          </p>
        </div>
      </div>

      {steps.length === 0 ? (
        disabled ? (
          <div className={styles.emptyReadonly}>Belum ada langkah SOP.</div>
        ) : (
          <EmptyStepsState document={document} onOperations={onOperations} />
        )
      ) : (
        <>
          <div className={styles.desktop}>
            <section
              className={styles.tableViewport}
              aria-label="Editor langkah SOP; gulir horizontal untuk melihat kolom lainnya"
              data-sopflow-steps-scroll
            >
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.numberColumn}>No</th>
                    <th className={styles.activityColumn}>Kegiatan</th>
                    <th className={styles.typeColumn}>Tipe</th>
                    <th className={styles.actorColumn}>Pelaksana</th>
                    <th className={styles.inputColumn}>Kelengkapan</th>
                    <th className={styles.durationColumn}>Waktu</th>
                    <th className={styles.outputColumn}>Output</th>
                    <th className={styles.noteColumn}>Keterangan</th>
                    <th className={styles.actionColumn}>Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {steps.map((step, index) => (
                    <SopStepRow
                      key={step.id}
                      step={step}
                      index={index}
                      document={document}
                      issues={issues}
                      selected={selectedStepId === step.id}
                      onSelect={() => onSelectedStepChange(step.id)}
                      onOperation={onOperation}
                      onOperations={onOperations}
                      disabled={disabled}
                    />
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <div className={styles.mobile}>
            {steps.map((step, index) => (
              <SopStepCard
                key={step.id}
                step={step}
                index={index}
                document={document}
                issues={issues}
                selected={selectedStepId === step.id}
                onSelect={() => onSelectedStepChange(step.id)}
                onOperation={onOperation}
                onOperations={onOperations}
                disabled={disabled}
              />
            ))}
          </div>

          {!disabled ? (
            <AddStepButton document={document} onOperations={onOperations} />
          ) : null}
        </>
      )}
    </section>
  );
}
