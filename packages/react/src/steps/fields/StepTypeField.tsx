import type { Step } from "@sopflow/core";
import styles from "./StepTypeField.module.css";

export interface StepTypeFieldProps {
  step: Step;
  steps?: readonly Step[];
  onChange: (type: "task" | "decision") => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function StepTypeField({
  step,
  steps = [],
  onChange,
  disabled = false,
  readOnly = false,
}: StepTypeFieldProps) {
  const branchSummary =
    step.type === "decision" ? decisionBranchSummary(step, steps) : null;

  if (readOnly) {
    return (
      <div className={styles.stack}>
        <span className={styles.value}>
          {step.type === "start"
            ? "Mulai"
            : step.type === "end"
              ? "Selesai"
              : step.type === "decision"
                ? "Decision"
                : "Task"}
        </span>

        {branchSummary ? (
          <span className={styles.branchSummary}>{branchSummary}</span>
        ) : null}
      </div>
    );
  }

  if (step.type === "start" || step.type === "end") {
    return (
      <span className={styles.fixedType}>
        {step.type === "start" ? "Mulai" : "Selesai"}
      </span>
    );
  }

  const cannotCollapseDecision =
    step.type === "decision" && step.yes !== step.no;

  return (
    <div className={styles.stack}>
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
        onChange={(event) =>
          onChange(event.target.value as "task" | "decision")
        }
      >
        <option value="task" disabled={cannotCollapseDecision}>
          {cannotCollapseDecision ? "Task — satukan cabang dulu" : "Task"}
        </option>

        <option value="decision">Decision</option>
      </select>

      {branchSummary ? (
        <span className={styles.branchSummary}>{branchSummary}</span>
      ) : null}
    </div>
  );
}

function decisionBranchSummary(
  step: Extract<Step, { type: "decision" }>,
  steps: readonly Step[],
): string {
  const orderById = new Map(
    steps.map((candidate, index) => [candidate.id, index + 1] as const),
  );

  const yes = orderById.get(step.yes) ?? "?";
  const no = orderById.get(step.no) ?? "?";

  return `Ya → ${yes} · Tidak → ${no}`;
}
