import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { addCalendarDays, formatISODate, parseISODate } from "./date-utils.js";
import styles from "./SopDatePicker.module.css";

export interface SopDatePickerProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  label: string;
  "data-sopflow-header-field"?: string;
}

/** Local-calendar dates, not instants: never pass SOP dates through UTC. */
export function SopDatePicker({
  value,
  onValueChange,
  disabled = false,
  label,
  "data-sopflow-header-field": field,
}: SopDatePickerProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseISODate(value);
  const [focused, setFocused] = useState(() => selected ?? new Date());
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  function openCalendar() {
    if (disabled) return;
    setFocused(selected ?? new Date());
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open) return;
    function measure() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const bounds = trigger.getBoundingClientRect();
      const width = Math.min(280, window.innerWidth - 16);
      const left = Math.max(
        8,
        Math.min(bounds.left, window.innerWidth - width - 8),
      );
      const spaceBelow = window.innerHeight - bounds.bottom;
      const top =
        spaceBelow >= 322 || bounds.top < 322
          ? Math.min(bounds.bottom + 5, window.innerHeight - 322)
          : bounds.top - 327;
      setPosition({ left, top: Math.max(8, top) });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (
        !triggerRef.current?.contains(event.target as Node) &&
        !popupRef.current?.contains(event.target as Node)
      )
        close();
    }
    window.addEventListener("pointerdown", outside);
    return () => window.removeEventListener("pointerdown", outside);
  }, [open, close]);

  const focusedKey = formatISODate(focused);
  useLayoutEffect(() => {
    if (!open) return;
    const target = popupRef.current?.querySelector<HTMLButtonElement>(
      `[data-iso="${focusedKey}"]`,
    );
    target?.focus({ preventScroll: true });
  }, [open, focusedKey]);

  function shiftMonth(amount: number) {
    setFocused((previous) => {
      const date = new Date(
        previous.getFullYear(),
        previous.getMonth() + amount,
        1,
      );
      date.setDate(
        Math.min(
          previous.getDate(),
          new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
        ),
      );
      return date;
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const movement: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      shiftMonth(event.key === "PageUp" ? -1 : 1);
      return;
    }
    const delta = movement[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    setFocused((previous) => addCalendarDays(previous, delta));
  }

  const year = focused.getFullYear();
  const month = focused.getMonth();
  const dayCount = new Date(year, month + 1, 0).getDate();
  const weekdayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthName = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(focused);
  const dateText = selected
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(selected)
    : "Pilih tanggal";

  return (
    <div className={styles.root}>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        className={styles.trigger}
        data-sopflow-header-field={field}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : openCalendar())}
      >
        <span data-placeholder={!selected || undefined}>{dateText}</span>
        <CalendarDays size={15} aria-hidden="true" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              data-sopflow-root
              ref={popupRef}
              id={id}
              role="dialog"
              aria-label={label}
              className={styles.popup}
              style={position}
              onKeyDown={handleKeyDown}
            >
              <div className={styles.month}>
                <button
                  type="button"
                  aria-label="Bulan sebelumnya"
                  onClick={() => shiftMonth(-1)}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <strong>{monthName}</strong>
                <button
                  type="button"
                  aria-label="Bulan berikutnya"
                  onClick={() => shiftMonth(1)}
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
              <div className={styles.calendar}>
                {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(
                  (day) => (
                    <span
                      className={styles.weekday}
                      key={day}
                      aria-hidden="true"
                    >
                      {day}
                    </span>
                  ),
                )}
                {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
                  .slice(0, weekdayOffset)
                  .map((day) => (
                    <span key={`blank-${day}`} aria-hidden="true" />
                  ))}
                {Array.from({ length: dayCount }, (_, index) => {
                  const date = new Date(year, month, index + 1);
                  const iso = formatISODate(date);
                  const isSelected = value === iso;
                  const isFocused = formatISODate(focused) === iso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={styles.day}
                      data-focused={isFocused}
                      data-iso={iso}
                      aria-label={new Intl.DateTimeFormat("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(date)}
                      aria-pressed={isSelected}
                      onClick={() => {
                        onValueChange(iso);
                        close(true);
                      }}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
              <div className={styles.bottom}>
                <button
                  type="button"
                  onClick={() => {
                    onValueChange("");
                    close(true);
                  }}
                >
                  Kosongkan
                </button>
                <button type="button" onClick={() => setFocused(new Date())}>
                  Hari ini
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
