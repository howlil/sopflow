import type { ReactNode } from "react";
import styles from "./FormField.module.css";

export interface FormFieldProps {
  label: string;
  children: ReactNode;
  className?: string | undefined;
  htmlFor?: string | undefined;
  labelId?: string | undefined;
}

export function FormField({
  label,
  children,
  className,
  htmlFor,
  labelId,
}: FormFieldProps) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      {htmlFor ? (
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className={styles.label} id={labelId}>
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
