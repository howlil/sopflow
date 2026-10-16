import { useRef, type ReactNode } from "react";
import {
  Dialog as ArcDialog,
  DialogContent as ArcDialogContent,
} from "../components/arc/dialog/dialog.js";
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

/** Maintains the SOPFlow controlled-dialog contract using official Arc UI / Radix. */
export function Dialog({
  open,
  title,
  description,
  role = "dialog",
  children,
  footer,
  onClose,
}: DialogProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  if (!open) return null;

  return (
    <ArcDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ArcDialogContent
        title={title}
        description={description}
        role={role}
        className={styles.dialog}
        onOpenAutoFocus={() => {
          const active =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          const menuOrigin = document.querySelector<HTMLElement>(
            '[data-sopflow-dialog-return-focus="true"]',
          );
          returnFocusRef.current =
            !active || active === document.body || active.closest('[role="menu"]')
              ? (menuOrigin ?? active)
              : active;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        {children}
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </ArcDialogContent>
    </ArcDialog>
  );
}
