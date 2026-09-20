import styles from "./InlineTextField.module.css";

export interface InlineTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
  multiline?: boolean;
  ariaLabel?: string;
}

export function InlineTextField({
  value,
  onChange,
  placeholder,
  disabled = false,
  readOnly = false,
  error = false,
  multiline = false,
  ariaLabel,
}: InlineTextFieldProps) {
  const commonProps = {
    value,
    placeholder,
    disabled,
    readOnly,
    "aria-label": ariaLabel,
    "data-empty": value.length === 0 || undefined,
    "data-error": error || undefined,
    "data-readonly": readOnly || undefined,
  };

  if (multiline) {
    return (
      <textarea
        {...commonProps}
        className={styles.field}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <input
      {...commonProps}
      className={styles.field}
      type="text"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
