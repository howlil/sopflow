import { GitBranch, Ellipsis, Plus, Trash2 } from "lucide-react";
import type { Step } from "@sopflow/core";
import { DropdownMenu } from "../components/arc/dropdown-menu/dropdown-menu.js";
import type { DropdownItem } from "../components/arc/dropdown-menu/dropdown-menu.js";
import styles from "./StepActions.module.css";

export interface StepActionsProps {
  step: Step;
  onAddAfter: () => void;
  onDelete: () => void;
  onConfigureDecision?: () => void;
  disabled?: boolean;
}

/** SOP action policy remains domain-specific; UI and keyboard interaction are Arc-owned. */
export function StepActions({
  step,
  onAddAfter,
  onDelete,
  onConfigureDecision,
  disabled = false,
}: StepActionsProps) {
  if (disabled) return null;

  const items: DropdownItem[] = [];
  if (step.type === "decision") {
    items.push({
      label: "Atur cabang decision",
      icon: <GitBranch size={15} aria-hidden="true" />,
      onSelect: onConfigureDecision,
      disabled: !onConfigureDecision,
    });
  } else {
    items.push({
      label: "Tambah langkah setelah ini",
      icon: <Plus size={15} aria-hidden="true" />,
      onSelect: onAddAfter,
    });
  }
  if (step.type !== "start" && step.type !== "end") {
    items.push({
      label: "Hapus langkah",
      icon: <Trash2 size={15} aria-hidden="true" />,
      destructive: true,
      separatorBefore: true,
      onSelect: onDelete,
    });
  }
  return (
    <div className={styles.menu}>
      <DropdownMenu
        compact
        label={`Aksi untuk ${step.name || "langkah"}`}
        icon={<Ellipsis size={16} aria-hidden="true" />}
        items={items}
      />
    </div>
  );
}
