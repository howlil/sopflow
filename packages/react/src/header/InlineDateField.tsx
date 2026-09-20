import styles from "./InlineDateField.module.css";

export interface InlineDateFieldProps {
  value: string;
  onChange: (value: string) => void;

  disabled?: boolean;
  error?: boolean;
  ariaLabel?: string;
}

export function InlineDateField({
  value,
  onChange,
  disabled = false,
  error = false,
  ariaLabel,
}: InlineDateFieldProps) {
  return (
    <input
      type="date"
      className={styles.field}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      data-empty={!value || undefined}
      data-error={error || undefined}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
