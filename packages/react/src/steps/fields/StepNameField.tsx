import { AutoResizeTextarea } from "../../primitives/AutoResizeTextarea.js";

export interface StepNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
}

export function StepNameField({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  error = false,
}: StepNameFieldProps) {
  return (
    <AutoResizeTextarea
      aria-label="Kegiatan"
      value={value}
      placeholder="Kegiatan"
      disabled={disabled}
      readOnly={readOnly}
      error={error}
      minRows={1}
      maxRows={5}
      onChange={onChange}
    />
  );
}
