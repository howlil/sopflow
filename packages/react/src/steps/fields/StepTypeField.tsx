import type { Step } from "@sopflow/core";
import { Select as ArcSelect } from "../../components/arc/select/select.js";
import styles from "./StepTypeField.module.css";

export interface StepTypeFieldProps {
  step: Step;
  steps?: readonly Step[];
  orderByStepId?: ReadonlyMap<string, number>;
  onChange: (type: "task" | "decision") => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function StepTypeField({
  step,
  steps = [],
  orderByStepId,
  onChange,
  disabled = false,
  readOnly = false,
}: StepTypeFieldProps) {
  const branchSummary =
    step.type === "decision"
      ? decisionBranchSummary(step, steps, orderByStepId)
      : null;

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
      <ArcSelect
        label="Tipe langkah"
        compact
        wideMenu
        value={step.type}
        disabled={disabled}
        options={[
          {
            value: "task",
            label: cannotCollapseDecision
              ? "Task — satukan cabang dulu"
              : "Task",
            disabled: cannotCollapseDecision,
          },
          { value: "decision", label: "Decision" },
        ]}
        onValueChange={(value) => onChange(value as "task" | "decision")}
      />

      {branchSummary ? (
        <span className={styles.branchSummary}>{branchSummary}</span>
      ) : null}
    </div>
  );
}

function decisionBranchSummary(
  step: Extract<Step, { type: "decision" }>,
  steps: readonly Step[],
  orderByStepId?: ReadonlyMap<string, number>,
): string {
  const orderById =
    orderByStepId ??
    new Map(
      steps.map((candidate, index) => [candidate.id, index + 1] as const),
    );

  const yes = orderById.get(step.yes) ?? "?";
  const no = orderById.get(step.no) ?? "?";

  return `Ya → ${yes} · Tidak → ${no}`;
}
