import type { SopSignatory } from "./types.js";
import { InlineTextField } from "./InlineTextField.js";
import styles from "./SignatoryEditor.module.css";

export interface SignatoryEditorProps {
  value?: SopSignatory;
  onChange: (value: SopSignatory) => void;
  disabled?: boolean;
}

export function SignatoryEditor({
  value,
  onChange,
  disabled = false,
}: SignatoryEditorProps) {
  const signatory: SopSignatory = value ?? {
    name: "",
    role: "",
    identifier: "",
  };

  function update<K extends keyof SopSignatory>(
    key: K,
    nextValue: SopSignatory[K],
  ) {
    onChange({
      ...signatory,
      [key]: nextValue,
    });
  }

  return (
    <div
      className={styles.signatory}
      data-empty={!signatory.name || undefined}
      data-disabled={disabled || undefined}
    >
      <InlineTextField
        ariaLabel="Jabatan penandatangan"
        value={signatory.role ?? ""}
        placeholder="Jabatan"
        disabled={disabled}
        onChange={(value) => update("role", value)}
      />

      <div className={styles.signatureSpace}>
        <span className={styles.signaturePlaceholder}>Tanda tangan</span>
      </div>

      <InlineTextField
        ariaLabel="Nama penandatangan"
        value={signatory.name}
        placeholder="Nama"
        disabled={disabled}
        onChange={(value) => update("name", value)}
      />

      <InlineTextField
        ariaLabel="Nomor identitas penandatangan"
        value={signatory.identifier ?? ""}
        placeholder="Nomor identitas"
        disabled={disabled}
        onChange={(value) => update("identifier", value)}
      />
    </div>
  );
}
