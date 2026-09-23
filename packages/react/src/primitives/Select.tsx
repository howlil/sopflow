import type { SelectHTMLAttributes } from "react";
import styles from "./Select.module.css";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={[styles.select, className].filter(Boolean).join(" ")}
    />
  );
}
