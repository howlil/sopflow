import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Button as ArcButton } from "../components/arc/button/button.js";
import "../styles/token.css";

export type ButtonVariant = "secondary" | "primary" | "danger" | "ghost";
export type ButtonSize = "compact" | "default";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Stable @sopflow/react Button API over the official Arc UI implementation. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "secondary", size = "compact", ...props }, ref) {
    return (
      <ArcButton
        {...props}
        ref={ref}
        data-sopflow-root
        variant={variant}
        size={size === "compact" ? "sm" : "md"}
      />
    );
  },
);
