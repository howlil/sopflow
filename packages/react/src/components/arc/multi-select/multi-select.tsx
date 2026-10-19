"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import { ChevronDown, X } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { positionFloatingMenu } from "./floating-menu-position.js";
import type { FloatingMenuPosition } from "./floating-menu-position.js";
import { motionTokens } from "../lib/motion-tokens.js";
import styles from "./multi-select.module.css";

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  description?: string;
  maxVisible?: number;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

const enter = motionTokens.ease.enter;
const standard = motionTokens.ease.standard;
/** Each chip sits in a slot whose width opens and collapses on a spring, so neighbours travel with it and nothing overlaps. */
const slot: Variants = {
  hidden: { width: 0, opacity: 0 },
  shown: {
    width: "auto",
    opacity: 1,
    transition: {
      width: motionTokens.spring.smooth,
      opacity: { duration: motionTokens.duration.fast, ease: enter },
    },
  },
  gone: {
    width: 0,
    opacity: 0,
    transition: {
      width: motionTokens.spring.smooth,
      opacity: { duration: motionTokens.duration.instant, ease: standard },
    },
  },
};
/** The chip itself grows in from .9 with a soft blur and shrinks back as it leaves. */
const chip: Variants = {
  hidden: { scale: 0.9, filter: `blur(${motionTokens.blur.soft}px)` },
  shown: {
    scale: 1,
    filter: "blur(0px)",
    transition: {
      ...motionTokens.spring.snappy,
      filter: { duration: motionTokens.duration.standard, ease: enter },
    },
  },
  gone: {
    scale: 0.9,
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.instant, ease: standard },
  },
};
/** Reduced motion keeps short crossfades; resting states match the moving variants so server and client markup agree. */
const fade: Variants = {
  hidden: { opacity: 0 },
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: motionTokens.duration.instant },
  },
  gone: { opacity: 0, transition: { duration: motionTokens.duration.instant } },
};
const slotFade: Variants = {
  hidden: { opacity: 0 },
  shown: {
    width: "auto",
    opacity: 1,
    transition: { duration: motionTokens.duration.instant },
  },
  gone: { opacity: 0, transition: { duration: motionTokens.duration.instant } },
};
const chipStill: Variants = {
  hidden: { scale: 1, filter: "blur(0px)" },
  shown: { scale: 1, filter: "blur(0px)" },
  gone: { scale: 1, filter: "blur(0px)" },
};
/** The overflow count rolls: a larger number rises from below, a smaller one drops from above. */
const roll: Variants = {
  hidden: (direction: number) => ({
    opacity: 0,
    y: `${direction * 0.5}em`,
    filter: `blur(${motionTokens.blur.subtle}px)`,
  }),
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: motionTokens.duration.standard, ease: enter },
  },
  gone: (direction: number) => ({
    opacity: 0,
    y: `${direction * -0.5}em`,
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.instant, ease: standard },
  }),
};

/** A check that draws itself when an option is picked and retracts when it is removed. */
function CheckMark({ reduce }: { reduce: boolean | null }) {
  return (
    <svg
      className={styles.check}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d="M4 12.5 9 17.5 20 6.5"
        initial={reduce ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        exit={reduce ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
        transition={
          reduce
            ? { duration: motionTokens.duration.instant }
            : {
                pathLength: {
                  duration: motionTokens.duration.standard,
                  ease: enter,
                },
                opacity: { duration: motionTokens.duration.instant },
              }
        }
      />
    </svg>
  );
}

export function MultiSelect({
  label,
  options,
  value,
  defaultValue = [],
  onValueChange,
  placeholder = "Select options",
  description,
  maxVisible = 2,
  disabled = false,
  className,
  compact = false,
}: MultiSelectProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<FloatingMenuPosition | null>(
    null,
  );
  const [internal, setInternal] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selected = value ?? internal;
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const labelFor = (item: string) =>
    options.find((option) => option.value === item)?.label ?? item;
  const visible = selected
    .slice(0, maxVisible)
    .map((item) => ({ value: item, label: labelFor(item) }));
  const remaining = Math.max(0, selected.length - visible.length);
  // A closed menu forgets its highlight, so the next open starts clean instead of on a stale hovered row.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setActiveIndex(-1);
  }
  const [previousRemaining, setPreviousRemaining] = useState(remaining);
  const [countDirection, setCountDirection] = useState(1);
  if (previousRemaining !== remaining) {
    setPreviousRemaining(remaining);
    setCountDirection(remaining > previousRemaining ? 1 : -1);
  }

  // The table and editor are both scroll containers. Render the listbox in a
  // body portal and position from its trigger's viewport rect, not its <td>.
  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    let frame = 0;
    const updatePosition = () => {
      const rect = trigger.getBoundingClientRect();
      const next = positionFloatingMenu(
        rect,
        menu.scrollHeight,
        window.innerWidth,
        window.innerHeight,
      );
      setMenuPosition((current) =>
        current &&
        current.top === next.top &&
        current.left === next.left &&
        current.width === next.width &&
        current.maxHeight === next.maxHeight &&
        current.side === next.side
          ? current
          : next,
      );
    };
    const schedulePosition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    };

    updatePosition();
    // Capture scroll events from nested scrollports, including horizontal
    // scrolling in the editable procedure table.
    document.addEventListener("scroll", schedulePosition, true);
    window.addEventListener("resize", schedulePosition);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedulePosition);
    observer?.observe(trigger);
    observer?.observe(menu);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedulePosition, true);
      window.removeEventListener("resize", schedulePosition);
      observer?.disconnect();
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const update = (next: string[]) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };
  const toggle = (option: MultiSelectOption) => {
    if (disabled || option.disabled) return;
    update(
      selectedSet.has(option.value)
        ? selected.filter((item) => item !== option.value)
        : [...selected, option.value],
    );
  };
  const clear = () => {
    update([]);
    setOpen(false);
  };
  const enabled = options
    .map((option, index) => (option.disabled ? -1 : index))
    .filter((index) => index >= 0);
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    // A step table listens for Enter, Space, and arrows. Those keys belong to
    // the open select and must not select/navigate the parent procedure row.
    if (["Enter", " ", "Escape", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.stopPropagation();
    }
    if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      toggle(options[activeIndex]!);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((current) => !current);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (
      (event.key === "ArrowDown" || event.key === "ArrowUp") &&
      enabled.length
    ) {
      event.preventDefault();
      setOpen(true);
      const current = enabled.indexOf(activeIndex);
      const next =
        current < 0
          ? event.key === "ArrowDown"
            ? 0
            : enabled.length - 1
          : event.key === "ArrowDown"
            ? (current + 1) % enabled.length
            : (current - 1 + enabled.length) % enabled.length;
      setActiveIndex(enabled[next]!);
    }
  };
  const reduce = useReducedMotion();

  return (
    <div
      ref={rootRef}
      className={[styles.field, className].filter(Boolean).join(" ")}
      data-compact={compact || undefined}
    >
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div className={styles.control}>
        <button
          ref={triggerRef}
          type="button"
          className={`${styles.trigger} ${selected.length ? styles.hasClear : ""}`}
          data-sopflow-actor-trigger={compact || undefined}
          disabled={disabled}
          aria-labelledby={`${labelId} ${valueId}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? `${id}-listbox` : undefined}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={onKeyDown}
        >
          <span id={valueId} className={styles.srOnly}>
            {selected.length ? selected.map(labelFor).join(", ") : placeholder}
          </span>
          <span className={styles.value} aria-hidden="true">
            <AnimatePresence initial={false}>
              {visible.map((item) => (
                <motion.span
                  key={`chip-${item.value}`}
                  className={styles.slot}
                  variants={reduce ? slotFade : slot}
                  initial="hidden"
                  animate="shown"
                  exit="gone"
                >
                  <motion.span
                    className={styles.chip}
                    variants={reduce ? chipStill : chip}
                  >
                    {item.label}
                  </motion.span>
                </motion.span>
              ))}
              {remaining > 0 && (
                <motion.span
                  key="more"
                  className={styles.slot}
                  variants={reduce ? slotFade : slot}
                  initial="hidden"
                  animate="shown"
                  exit="gone"
                >
                  <motion.span
                    className={styles.more}
                    variants={reduce ? chipStill : chip}
                  >
                    +
                    <span className={styles.count}>
                      <AnimatePresence initial={false} custom={countDirection}>
                        <motion.span
                          key={remaining}
                          custom={countDirection}
                          variants={reduce ? fade : roll}
                          initial="hidden"
                          animate="shown"
                          exit="gone"
                        >
                          {remaining}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  </motion.span>
                </motion.span>
              )}
              {!selected.length && (
                <motion.span
                  key="placeholder"
                  className={styles.placeholder}
                  variants={fade}
                  initial="hidden"
                  animate="shown"
                  exit="gone"
                >
                  {placeholder}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          <ChevronDown
            className={styles.chevron}
            size={16}
            aria-hidden="true"
          />
        </button>
        <AnimatePresence initial={false}>
          {selected.length > 0 && !disabled && (
            <motion.button
              type="button"
              aria-label="Clear selections"
              className={styles.clear}
              onClick={clear}
              initial={
                reduce
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      scale: 0.6,
                      filter: `blur(${motionTokens.blur.subtle}px)`,
                    }
              }
              animate={{
                opacity: 1,
                scale: 1,
                filter: "blur(0px)",
                transition: reduce
                  ? { duration: motionTokens.duration.instant }
                  : {
                      ...motionTokens.spring.snappy,
                      opacity: { duration: motionTokens.duration.fast },
                    },
              }}
              exit={{
                opacity: 0,
                ...(reduce
                  ? {}
                  : {
                      scale: 0.6,
                      filter: `blur(${motionTokens.blur.subtle}px)`,
                    }),
                transition: {
                  duration: motionTokens.duration.instant,
                  ease: standard,
                },
              }}
              whileTap={{
                scale: reduce ? 1 : 0.96,
                transition: {
                  duration: motionTokens.duration.instant,
                  ease: standard,
                },
              }}
            >
              <X size={14} aria-hidden="true" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      {description && <span className={styles.description}>{description}</span>}
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  ref={menuRef}
                  data-sopflow-root
                  data-side={menuPosition?.side ?? "bottom"}
                  id={`${id}-listbox`}
                  className={styles.menu}
                  role="listbox"
                  aria-label={label}
                  aria-multiselectable="true"
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    left: menuPosition?.left ?? -10000,
                    top: menuPosition?.top ?? -10000,
                    width: menuPosition?.width ?? 0,
                    maxHeight: menuPosition?.maxHeight ?? 0,
                    visibility: menuPosition ? "visible" : "hidden",
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Tab") event.stopPropagation();
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      setOpen(false);
                      triggerRef.current?.focus();
                    } else if (event.key === "Tab") {
                      setOpen(false);
                    } else if (
                      (event.key === "ArrowDown" || event.key === "ArrowUp") &&
                      enabled.length
                    ) {
                      event.preventDefault();
                      const current = enabled.indexOf(activeIndex);
                      const next =
                        current < 0
                          ? event.key === "ArrowDown"
                            ? 0
                            : enabled.length - 1
                          : event.key === "ArrowDown"
                            ? (current + 1) % enabled.length
                            : (current - 1 + enabled.length) % enabled.length;
                      setActiveIndex(enabled[next]!);
                      const target =
                        menuRef.current?.querySelectorAll<HTMLButtonElement>(
                          '[role="option"]',
                        )[enabled[next]!];
                      target?.focus();
                    }
                  }}
                  initial={
                    reduce
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          y: menuPosition?.side === "top" ? 6 : -6,
                          scale: 0.97,
                        }
                  }
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: reduce
                      ? { duration: motionTokens.duration.instant }
                      : {
                          ...motionTokens.spring.snappy,
                          opacity: {
                            duration: motionTokens.duration.fast,
                            ease: enter,
                          },
                        },
                  }}
                  exit={{
                    opacity: 0,
                    ...(reduce ? {} : { y: -4, scale: 0.98 }),
                    transition: {
                      duration: motionTokens.duration.instant,
                      ease: standard,
                    },
                  }}
                >
                  {options.map((option, index) => (
                    <button
                      type="button"
                      role="option"
                      id={`${id}-option-${index}`}
                      aria-selected={selectedSet.has(option.value)}
                      aria-disabled={option.disabled || undefined}
                      key={option.value}
                      className={styles.option}
                      data-active={activeIndex === index}
                      disabled={option.disabled}
                      onPointerMove={() => {
                        if (activeIndex !== index) setActiveIndex(index);
                      }}
                      onClick={() => toggle(option)}
                    >
                      <span>{option.label}</span>
                      <AnimatePresence initial={false}>
                        {selectedSet.has(option.value) && (
                          <CheckMark key="check" reduce={reduce} />
                        )}
                      </AnimatePresence>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}
