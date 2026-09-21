import type {
  SOPDocument,
  Step,
  StepId,
  ValidationIssue,
} from "@sopflow/core";
import styles from "./SopProcedureView.module.css";

export interface SopProcedureViewProps {
  document: SOPDocument;
  selectedStepId?: StepId | null;
  onSelectedStepChange?: (stepId: StepId | null) => void;
  issues?: readonly ValidationIssue[];
  className?: string;
}

export function SopProcedureView({
  document,
  selectedStepId = null,
  onSelectedStepChange,
  issues = [],
  className,
}: SopProcedureViewProps) {
  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-sopflow-procedure-view
      aria-label="Prosedur SOP"
    >
      <table className={styles.table}>
        <colgroup>
          <col className={styles.numberColumn} />
          <col className={styles.activityColumn} />
          <col className={styles.actorColumn} />
          <col className={styles.inputColumn} />
          <col className={styles.durationColumn} />
          <col className={styles.outputColumn} />
          <col className={styles.noteColumn} />
        </colgroup>

        <thead>
          <tr>
            <th rowSpan={2}>No</th>
            <th rowSpan={2}>Kegiatan</th>
            <th rowSpan={2}>Pelaksana</th>
            <th colSpan={3}>Mutu Baku</th>
            <th rowSpan={2}>Keterangan</th>
          </tr>
          <tr>
            <th>Kelengkapan</th>
            <th>Waktu</th>
            <th>Output</th>
          </tr>
        </thead>

        <tbody>
          {document.steps.length === 0 ? (
            <tr>
              <td colSpan={7} className={styles.empty}>
                Belum ada langkah SOP.
              </td>
            </tr>
          ) : (
            document.steps.map((step, index) => {
              const selected = selectedStepId === step.id;
              const issueCount = issues.filter(
                (issue) => issue.stepId === step.id,
              ).length;

              return (
                <tr
                  key={step.id}
                  className={styles.row}
                  data-sopflow-procedure-step-id={step.id}
                  data-selected={selected || undefined}
                  data-error={issueCount > 0 || undefined}
                  tabIndex={onSelectedStepChange ? 0 : undefined}
                  aria-selected={selected || undefined}
                  onClick={() => onSelectedStepChange?.(step.id)}
                  onKeyDown={(event) => {
                    if (
                      onSelectedStepChange &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      onSelectedStepChange(step.id);
                    }
                  }}
                >
                  <td className={styles.number}>{index + 1}</td>
                  <td className={styles.activity}>
                    <div className={styles.activityName}>
                      {step.name.trim() || "—"}
                    </div>
                    <div className={styles.activityMeta}>
                      <span>{stepTypeLabel(step)}</span>
                      {step.type === "decision" ? (
                        <span>{decisionSummary(step, document)}</span>
                      ) : null}
                      {issueCount > 0 ? (
                        <span className={styles.issue}>
                          {issueCount} masalah
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>{actorNames(step, document)}</td>
                  <td>{display(step.input)}</td>
                  <td>{durationLabel(step)}</td>
                  <td>{display(step.output)}</td>
                  <td>{display(step.note)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}

function display(value: string | undefined): string {
  return value?.trim() || "—";
}

function stepTypeLabel(step: Step): string {
  switch (step.type) {
    case "start":
      return "Mulai";
    case "end":
      return "Selesai";
    case "decision":
      return "Decision";
    case "task":
      return "Proses";
  }
}

function actorNames(step: Step, document: SOPDocument): string {
  const names = step.actorIds
    .map((actorId) => document.actors.find((actor) => actor.id === actorId)?.name)
    .filter((name): name is string => Boolean(name?.trim()));

  return names.length > 0 ? names.join(", ") : "—";
}

function durationLabel(step: Step): string {
  if (!step.duration) return "—";

  const unitLabels = {
    minute: "menit",
    hour: "jam",
    day: "hari",
    week: "minggu",
    month: "bulan",
    year: "tahun",
  } as const;

  return `${step.duration.value} ${unitLabels[step.duration.unit]}`;
}

function decisionSummary(
  step: Extract<Step, { type: "decision" }>,
  document: SOPDocument,
): string {
  const orderById = new Map(
    document.steps.map((candidate, index) => [candidate.id, index + 1]),
  );

  return `Ya → ${orderById.get(step.yes) ?? "?"} · Tidak → ${orderById.get(step.no) ?? "?"}`;
}
