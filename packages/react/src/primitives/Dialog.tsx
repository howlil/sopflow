import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "./dialog/useDialogFocus.js";
import styles from "./Dialog.module.css";

export interface DialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  role?: "dialog" | "alertdialog";
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

export function Dialog({
  open,
  title,
  description,
  role = "dialog",
  children,
  footer,
  onClose,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const { dialogRef, handleKeyDown } = useDialogFocus({
    open,
    onClose,
  });

  if (!open) return null;

  return createPortal(
    <div className={styles.backdrop} data-sopflow-root>
      <button
        type="button"
        className={styles.backdropClose}
        aria-label="Tutup dialog dengan klik di luar"
        tabIndex={-1}
        onClick={onClose}
      />

      {/* biome-ignore lint/a11y/noStaticElementInteractions: Dialog owns keyboard focus trapping. */}
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: Dialog role is intentionally configurable for alert dialogs. */}
      <div
        ref={dialogRef}
        className={styles.dialog}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        {...(description ? { "aria-describedby": descriptionId } : {})}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>

            {description ? (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className={styles.closeButton}
            aria-label="Tutup dialog"
            tabIndex={-1}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={styles.body}>{children}</div>

        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>,
    globalThis.document.body,
  );
}
