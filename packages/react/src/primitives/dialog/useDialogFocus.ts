import { useEffect, useRef, type KeyboardEvent } from "react";

export interface UseDialogFocusOptions {
  open: boolean;
  onClose: () => void;
}

export function useDialogFocus({ open, onClose }: UseDialogFocusOptions) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const frame = requestAnimationFrame(() => {
      const dialog = dialogRef.current;

      if (!dialog) {
        return;
      }

      const firstFocusable = getFocusableElements(dialog)[0];

      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        dialog.focus();
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      event.stopPropagation();
      return;
    }

    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const focusable = getFocusableElements(dialog);

    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);

    if (!first || !last) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }

    event.stopPropagation();
  }

  return {
    dialogRef,
    handleKeyDown,
  };
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const elements = root.querySelectorAll<HTMLElement>(
    [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "a[href]",
      '[tabindex]:not([tabindex="-1"])',
    ].join(","),
  );

  return Array.from(elements).filter(
    (element) => element.getClientRects().length > 0,
  );
}
