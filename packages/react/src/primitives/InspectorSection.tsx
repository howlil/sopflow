import type { ReactNode } from "react";
import styles from "./InspectorSection.module.css";

export interface InspectorSectionProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  headingLevel?: "h2" | "h3";
  className?: string | undefined;
}

export function InspectorSection({
  title,
  children,
  actions,
  headingLevel = "h2",
  className,
}: InspectorSectionProps) {
  const Heading = headingLevel;

  return (
    <section className={[styles.section, className].filter(Boolean).join(" ")}>
      <div
        className={styles.heading}
        data-has-actions={actions ? "true" : undefined}
      >
        <Heading className={styles.title}>{title}</Heading>
        {actions}
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
