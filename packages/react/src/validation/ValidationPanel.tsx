import { Button } from "../primitives/Button.js";
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
          <Button variant="ghost"
            type="button"
            className={styles.toggle}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Sembunyikan masalah" : "Lihat masalah"}
          </Button>
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
              {issue.kind === "schema" && issue.path.length > 0
                ? `${issue.path.join(".")}: ${issue.message}`
                : issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function issueDetail(issue: SopReadinessIssue): string {
  if (issue.kind === "schema") return issue.path.join(".");
  return "field" in issue ? issue.field : (issue.stepId ?? "");
}
