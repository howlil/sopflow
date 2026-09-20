import styles from "./InlineListField.module.css";

export interface InlineListFieldProps {
  value: string[];
  onChange: (value: string[]) => void;

  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  ariaLabel?: string;
}

export function InlineListField({
  value,
  onChange,
  placeholder = "Tambah item",
  disabled = false,
  error = false,
  ariaLabel,
}: InlineListFieldProps) {
  function updateItem(index: number, nextValue: string) {
    onChange(
      value.map((item, itemIndex) => (itemIndex === index ? nextValue : item)),
    );
  }

  function addItem() {
    if (disabled) return;

    onChange([...value, ""]);
  }

  function removeItem(index: number) {
    if (disabled) return;

    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div
      className={styles.field}
      data-empty={value.length === 0 || undefined}
      data-error={error || undefined}
      data-disabled={disabled || undefined}
    >
      {value.length > 0 ? (
        <ol className={styles.list}>
          {value.map((item, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: Items are positional controlled values.
              key={index}
              className={styles.item}
            >
              <textarea
                className={styles.input}
                value={item}
                disabled={disabled}
                rows={1}
                aria-label={ariaLabel ? `${ariaLabel} ${index + 1}` : undefined}
                placeholder={placeholder}
                onChange={(event) => updateItem(index, event.target.value)}
              />

              {!disabled ? (
                <button
                  type="button"
                  className={styles.removeButton}
                  aria-label={`Hapus item ${index + 1}`}
                  onClick={() => removeItem(index)}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className={styles.empty}>Belum ada data.</div>
      )}

      {!disabled ? (
        <button type="button" className={styles.addButton} onClick={addItem}>
          + Tambah
        </button>
      ) : null}
    </div>
  );
}
