import { AutoResizeTextarea } from "../../primitives/AutoResizeTextarea.js";

export interface NoteFieldProps {
  value?: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
}

export function NoteField({
  value = "",
  onChange,
  disabled = false,
  readOnly = false,
  error = false,
}: NoteFieldProps) {
  return (
    <AutoResizeTextarea
      value={value}
      aria-label="Keterangan"
      placeholder="Keterangan"
      disabled={disabled}
      readOnly={readOnly}
      error={error}
      minRows={1}
      maxRows={6}
      onChange={onChange}
    />
  );
}
