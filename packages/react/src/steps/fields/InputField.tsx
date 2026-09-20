import { AutoResizeTextarea } from "../../primitives/AutoResizeTextarea.js";

export interface InputFieldProps {
  value?: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
}

export function InputField({
  value = "",
  onChange,
  disabled = false,
  readOnly = false,
  error = false,
}: InputFieldProps) {
  return (
    <AutoResizeTextarea
      value={value}
      aria-label="Kelengkapan"
      placeholder="Kelengkapan"
      disabled={disabled}
      readOnly={readOnly}
      error={error}
      minRows={1}
      maxRows={5}
      onChange={onChange}
    />
  );
}
