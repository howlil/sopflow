import {
  useEffect,
  useRef,
  type ChangeEvent,
  type TextareaHTMLAttributes,
} from "react";
import styles from "./AutoResizeTextarea.module.css";

export interface AutoResizeTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
  maxRows?: number;
  error?: boolean;
  readOnly?: boolean;
}

export function AutoResizeTextarea({
  value,
  onChange,
  minRows = 1,
  maxRows = 5,
  error = false,
  readOnly = false,
  className,
  disabled,
  ...props
}: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    if (element.value !== value) {
      element.value = value;
    }

    const computedStyles = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(computedStyles.lineHeight) || 20;
    const paddingTop = Number.parseFloat(computedStyles.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computedStyles.paddingBottom) || 0;
    const minHeight = lineHeight * minRows + paddingTop + paddingBottom;
    const maxHeight = lineHeight * maxRows + paddingTop + paddingBottom;

    element.style.height = "auto";

    const nextHeight = Math.min(
      Math.max(element.scrollHeight, minHeight),
      maxHeight,
    );

    element.style.height = `${nextHeight}px`;
    element.style.overflowY =
      element.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, minRows, maxRows]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
  }

  return (
    <textarea
      {...props}
      ref={ref}
      value={value}
      disabled={disabled}
      readOnly={readOnly}
      rows={minRows}
      className={[styles.textarea, className].filter(Boolean).join(" ")}
      data-empty={!value || undefined}
      data-error={error || undefined}
      data-readonly={readOnly || undefined}
      onChange={handleChange}
    />
  );
}
