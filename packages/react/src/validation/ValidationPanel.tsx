import { useState } from "react";

import type { SopReadinessIssue } from "./readiness.js";
import styles from "./ValidationPanel.module.css";

export interface ValidationPanelProps {
  issues: readonly SopReadinessIssue[];
}

export function ValidationPanel({ issues }: ValidationPanelProps) {
  const ready = issues.length === 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      className={[styles.root, ready ? styles.ready : styles.invalid].join(" ")}
      data-sopflow-validation-panel
      data-ready={ready}
      aria-live="polite"
    >
      <div className={styles.heading}>
        <div className={styles.headingText}>
          <h2 className={styles.title}>Validasi SOP</h2>
          <span className={styles.status}>
            {ready ? "Siap" : `${issues.length} masalah`}
          </span>
        </div>

        {!ready ? (
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Sembunyikan masalah" : "Lihat masalah"}
          </button>
        ) : null}
      </div>

      {ready ? (
        <p className={styles.message}>
          Header dan alur SOP lengkap untuk preview atau cetak.
        </p>
      ) : expanded ? (
        <ul className={styles.issues}>
          {issues.map((issue) => (
            <li
              key={`${issue.kind}:${issue.code}:${issueDetail(issue)}:${issue.message}`}
            >
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function issueDetail(issue: SopReadinessIssue): string {
  return "field" in issue ? issue.field : (issue.stepId ?? "");
}
