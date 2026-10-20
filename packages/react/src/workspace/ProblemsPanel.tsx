import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

import type { SopReadinessIssue } from "../validation/readiness.js";
import { problemKey } from "./resolveProblemTarget.js";
import styles from "./ProblemsPanel.module.css";

export interface ProblemsPanelProps {
  issues: readonly SopReadinessIssue[];
  runtimeError?: string | null;
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
  onNavigate: (issue: SopReadinessIssue) => void;
  navigationFeedback?: string | null;
}

export function ProblemsPanel({
  issues,
  runtimeError = null,
  expanded,
  onExpandedChange,
  onNavigate,
  navigationFeedback = null,
}: ProblemsPanelProps) {
  const count = issues.length + (runtimeError ? 1 : 0);

  return (
    <section className={styles.root} data-sopflow-problems>
      {expanded ? (
        <div className={styles.panel} id="sopflow-problems-list">
          <div className={styles.panelHeader}>
            <strong>Validation issues</strong>
            <button
              type="button"
              className={styles.close}
              aria-label="Close Problems"
              onClick={() => onExpandedChange(false)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.list}>
            {runtimeError ? (
              <div className={styles.runtimeError} role="alert">
                <AlertCircle size={15} aria-hidden="true" />
                <div>
                  <strong>Diagram error</strong>
                  <p>{runtimeError}</p>
                </div>
              </div>
            ) : null}
            {issues.map((issue) => (
              <button
                type="button"
                key={problemKey(issue)}
                className={styles.item}
                onClick={() => onNavigate(issue)}
              >
                <AlertCircle size={14} aria-hidden="true" />
                <span className={styles.message}>{issue.message}</span>
                <span className={styles.kind}>{issue.kind}</span>
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            ))}
            {count === 0 ? (
              <div className={styles.empty}>No problems found</div>
            ) : null}
          </div>
          {navigationFeedback ? (
            <p className={styles.feedback} role="status">
              {navigationFeedback}
            </p>
          ) : null}
        </div>
      ) : null}

      <footer className={styles.footer}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={expanded ? "sopflow-problems-list" : undefined}
          onClick={() => onExpandedChange(!expanded)}
        >
          <AlertCircle size={14} aria-hidden="true" />
          <span>Problems</span>
          {count > 0 ? <span className={styles.count}>{count}</span> : null}
          {expanded ? (
            <ChevronDown size={13} aria-hidden="true" />
          ) : (
            <ChevronUp size={13} aria-hidden="true" />
          )}
        </button>
        <span className={styles.paperLabel}>A4 landscape</span>
      </footer>
    </section>
  );
}
