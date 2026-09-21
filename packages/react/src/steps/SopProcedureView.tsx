import type { SOPDocument, Step, StepId, ValidationIssue } from "@sopflow/core";
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
  const actorColumns =
    document.actors.length > 0
      ? document.actors.map((actor) => ({
          id: actor.id as string | null,
          name: actor.name,
        }))
      : [{ id: null, name: "Pelaksana" }];
  const actorWidth = 24 / actorColumns.length;
  const totalColumns = actorColumns.length + 6;

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-sopflow-procedure-view
      aria-label="Prosedur SOP"
    >
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: "5%" }} />
          <col style={{ width: "24%" }} />
          {actorColumns.map((actor, index) => (
            <col
              key={actor.id ?? `fallback-${index}`}
              style={{ width: `${actorWidth}%` }}
            />
          ))}
          <col style={{ width: "14%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "12%" }} />
        </colgroup>

        <thead>
          <tr>
            <th rowSpan={2}>No</th>
            <th rowSpan={2}>Kegiatan</th>
            <th colSpan={actorColumns.length}>Pelaksana</th>
            <th colSpan={3}>Mutu Baku</th>
            <th rowSpan={2}>Ket</th>
          </tr>
          <tr>
            {actorColumns.map((actor, index) => (
              <th
                key={actor.id ?? `fallback-${index}`}
                className={styles.actorHeader}
              >
                {actor.name}
              </th>
            ))}
            <th>Kelengkapan</th>
            <th>Waktu</th>
            <th>Output</th>
          </tr>
        </thead>

        <tbody>
          {document.steps.length === 0 ? (
            <tr>
              <td colSpan={totalColumns} className={styles.empty}>
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
                    {step.type === "decision" || issueCount > 0 ? (
                      <div className={styles.activityMeta}>
                        {step.type === "decision" ? (
                          <span>{decisionSummary(step, document)}</span>
                        ) : null}
                        {issueCount > 0 ? (
                          <span className={styles.issue}>
                            {issueCount} masalah
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </td>

                  {actorColumns.map((actor, actorIndex) => {
                    const assigned =
                      actor.id === null
                        ? document.actors.length === 0
                        : step.actorIds.includes(actor.id);

                    return (
                      <td
                        key={actor.id ?? `fallback-${actorIndex}`}
                        className={styles.actorCell}
                        data-sopflow-actor-id={actor.id ?? undefined}
                      >
                        {assigned ? <ProcedureShape step={step} /> : null}
                      </td>
                    );
                  })}

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

function ProcedureShape({ step }: { step: Step }) {
  return (
    <svg
      className={styles.flowShape}
      data-kind={step.type}
      viewBox="0 0 36 28"
      aria-hidden="true"
    >
      {step.type === "decision" ? (
        <polygon points="18,2 34,14 18,26 2,14" />
      ) : step.type === "start" || step.type === "end" ? (
        <rect x="2" y="5" width="32" height="18" rx="9" />
      ) : (
        <rect x="2" y="5" width="32" height="18" />
      )}
    </svg>
  );
}

function display(value: string | undefined): string {
  return value?.trim() || "—";
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
