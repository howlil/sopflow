import type { Step } from "@sopflow/core";
import styles from "./StepTypeField.module.css";

export interface StepTypeFieldProps {
  step: Step;
  onChange: (type: "task" | "decision") => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function StepTypeField({
  step,
  onChange,
  disabled = false,
  readOnly = false,
}: StepTypeFieldProps) {
  if (readOnly) {
    return (
      <span className={styles.value}>
        {step.type === "start"
          ? "Mulai"
          : step.type === "end"
            ? "Selesai"
            : step.type === "decision"
              ? "Keputusan"
              : "Proses"}
      </span>
    );
  }

  if (step.type === "start") {
    return <span className={styles.fixedType}>Start</span>;
  }

  if (step.type === "end") {
    return <span className={styles.fixedType}>End</span>;
  }

  const cannotCollapseDecision =
    step.type === "decision" && step.yes !== step.no;

  return (
    <select
      className={styles.select}
      value={step.type}
      disabled={disabled}
      aria-label="Tipe langkah"
      title={
        cannotCollapseDecision
          ? "Satukan target cabang Ya dan Tidak sebelum mengubah menjadi Task"
          : undefined
      }
      onChange={(event) => onChange(event.target.value as "task" | "decision")}
    >
      <option value="task" disabled={cannotCollapseDecision}>
        {cannotCollapseDecision ? "Task — satukan cabang dulu" : "Task"}
      </option>

      <option value="decision">Decision</option>
    </select>
  );
}
