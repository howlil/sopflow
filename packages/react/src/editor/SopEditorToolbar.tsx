import styles from "./SopEditorToolbar.module.css";

export interface SopEditorToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  disabled?: boolean;
}

export function SopEditorToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  disabled = false,
}: SopEditorToolbarProps) {
  return (
    <div
      className={styles.toolbar}
      role="toolbar"
      aria-label="Kontrol editor SOP"
      data-disabled={disabled || undefined}
    >
      <button
        type="button"
        className={styles.button}
        disabled={disabled || !canUndo}
        onClick={onUndo}
      >
        Undo
      </button>

      <button
        type="button"
        className={styles.button}
        disabled={disabled || !canRedo}
        onClick={onRedo}
      >
        Redo
      </button>
    </div>
  );
}
