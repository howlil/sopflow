import type { ButtonHTMLAttributes, Ref } from "react";
import { Button as ArcButton } from "../components/arc/button/button.js";
import "../styles/uiarc-scoped.css";
import "../styles/token.css";

export type ButtonVariant = "secondary" | "primary" | "danger" | "ghost";
export type ButtonSize = "compact" | "default";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional internal DOM ref for roving toolbar focus, React 18 compatible. */
  buttonRef?: Ref<HTMLButtonElement>;
}

/** Stable @sopflow/react Button API over the official Arc UI implementation. */
export function Button({
  variant = "secondary",
  size = "compact",
  buttonRef,
  ...props
}: ButtonProps) {
  return (
    <ArcButton
      {...props}
      ref={buttonRef}
      data-sopflow-root
      variant={variant}
      size={size === "compact" ? "sm" : "md"}
    />
  );
}
