import { useState } from "react";
import type { Step } from "@sopflow/core";

import styles from "./StepActions.module.css";

export interface StepActionsProps {
  step: Step;
  onAddAfter: () => void;
  onDelete: () => void;
  onConfigureDecision?: () => void;
  disabled?: boolean;
}

export function StepActions({
  step,
  onAddAfter,
  onDelete,
  onConfigureDecision,
  disabled = false,
}: StepActionsProps) {
  const [open, setOpen] = useState(false);

  if (disabled) {
    return null;
  }

  return (
    <div className={styles.menu}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={`Aksi untuk ${step.name || "langkah"}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        •••
      </button>

      {open ? (
        <div className={styles.content}>
          {step.type === "decision" ? (
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                onConfigureDecision?.();
              }}
            >
              Atur cabang decision
            </button>
          ) : null}

          {step.type !== "decision" ? (
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                setOpen(false);
                onAddAfter();
              }}
            >
              Tambah langkah setelah ini
            </button>
          ) : null}

          {step.type !== "start" && step.type !== "end" ? (
            <button
              type="button"
              className={styles.dangerItem}
              onClick={() => {
                onDelete();
              }}
            >
              Hapus langkah
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
