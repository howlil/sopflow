import type { ValidationIssue } from "@sopflow/core";
import styles from "./ValidationPanel.module.css";

export interface ValidationPanelProps {
  issues: ValidationIssue[];
}

export function ValidationPanel({ issues }: ValidationPanelProps) {
  if (issues.length === 0) {
    return (
      <section className={styles.panel} data-empty="true">
        <p className={styles.success}>Tidak ada masalah pada workflow.</p>
      </section>
    );
  }

  return (
    <section
      className={styles.panel}
      data-error="true"
      aria-label="Validasi SOP"
    >
      <header className={styles.header}>
        <strong>{issues.length} masalah</strong>
      </header>

      <ul className={styles.list}>
        {issues.map((issue) => (
          <li
            key={`${issue.code}-${issue.stepId ?? "document"}-${issue.message}`}
            className={styles.issue}
          >
            <span className={styles.message}>{issue.message}</span>

            {issue.stepId ? (
              <code className={styles.stepId}>{issue.stepId}</code>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
