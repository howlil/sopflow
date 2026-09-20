import { InlineTextField } from "./InlineTextField.js";
import styles from "./InstitutionEditor.module.css";

export interface InstitutionEditorProps {
  name: string;
  logoUrl?: string;

  onNameChange: (value: string) => void;
  disabled?: boolean;
}

export function InstitutionEditor({
  name,
  logoUrl,
  onNameChange,
  disabled = false,
}: InstitutionEditorProps) {
  return (
    <div
      className={styles.institution}
      data-empty={!name || undefined}
      data-disabled={disabled || undefined}
    >
      <div className={styles.logo}>
        {logoUrl ? (
          <img src={logoUrl} alt="" className={styles.logoImage} />
        ) : (
          <span className={styles.logoPlaceholder}>LOGO</span>
        )}
      </div>

      <InlineTextField
        ariaLabel="Nama institusi"
        value={name}
        placeholder="Nama institusi"
        disabled={disabled}
        onChange={onNameChange}
        multiline
      />
    </div>
  );
}
