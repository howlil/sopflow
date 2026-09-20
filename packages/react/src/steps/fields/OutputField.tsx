import { AutoResizeTextarea } from "../../primitives/AutoResizeTextarea.js";

export interface OutputFieldProps {
  value?: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
}

export function OutputField({
  value = "",
  onChange,
  disabled = false,
  readOnly = false,
  error = false,
}: OutputFieldProps) {
  return (
    <AutoResizeTextarea
      value={value}
      aria-label="Output"
      placeholder="Output"
      disabled={disabled}
      readOnly={readOnly}
      error={error}
      minRows={1}
      maxRows={5}
      onChange={onChange}
    />
  );
}
