import type { SOPDocument, StepId } from "@sopflow/core";
import { useState } from "react";

import { SopDiagram } from "../diagram/SopDiagram.js";
import { SopEditor } from "../SopEditor.js";
import type { SopHeaderValue } from "../types.js";
import styles from "./SopWorkspace.module.css";

export type SopWorkspaceView = "editor" | "diagram";

export interface SopWorkspaceProps {
  value: SOPDocument;
  onChange?: (document: SOPDocument) => void;
  header: SopHeaderValue;
  onHeaderChange?: (header: SopHeaderValue) => void;
  view?: SopWorkspaceView;
  onViewChange?: (view: SopWorkspaceView) => void;
  selectedStepId?: StepId | null;
  onSelectedStepChange?: (stepId: StepId | null) => void;
  readOnly?: boolean;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export function SopWorkspace({
  value,
  onChange,
  header,
  onHeaderChange,
  view: controlledView,
  onViewChange,
  selectedStepId: controlledSelectedStepId,
  onSelectedStepChange,
  readOnly = false,
  loading = false,
  error = null,
  className,
}: SopWorkspaceProps) {
  const [internalView, setInternalView] = useState<SopWorkspaceView>("editor");
  const [internalSelectedStepId, setInternalSelectedStepId] =
    useState<StepId | null>(null);

  const view = controlledView ?? internalView;
  const selectedStepId =
    controlledSelectedStepId !== undefined
      ? controlledSelectedStepId
      : internalSelectedStepId;

  function handleViewChange(next: SopWorkspaceView) {
    if (controlledView === undefined) {
      setInternalView(next);
    }

    onViewChange?.(next);
  }

  function handleSelectedStepChange(stepId: StepId | null) {
    if (controlledSelectedStepId === undefined) {
      setInternalSelectedStepId(stepId);
    }

    onSelectedStepChange?.(stepId);
  }

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-sopflow-root
      data-sopflow-workspace
    >
      <WorkspaceToolbar view={view} onViewChange={handleViewChange} />

      {view === "editor" ? (
        <SopEditor
          value={value}
          header={header}
          selectedStepId={selectedStepId}
          onSelectedStepChange={handleSelectedStepChange}
          readOnly={readOnly}
          loading={loading}
          error={error}
          {...(onChange ? { onChange } : {})}
          {...(onHeaderChange ? { onHeaderChange } : {})}
        />
      ) : (
        <SopDiagram
          document={value}
          selectedStepId={selectedStepId}
          onSelectedStepChange={handleSelectedStepChange}
        />
      )}
    </section>
  );
}

interface WorkspaceToolbarProps {
  view: SopWorkspaceView;
  onViewChange: (view: SopWorkspaceView) => void;
}

function WorkspaceToolbar({ view, onViewChange }: WorkspaceToolbarProps) {
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Tampilan SOP">
      <button
        type="button"
        className={styles.viewButton}
        data-active={view === "editor" || undefined}
        aria-pressed={view === "editor"}
        onClick={() => onViewChange("editor")}
      >
        Prosedur
      </button>

      <button
        type="button"
        className={styles.viewButton}
        data-active={view === "diagram" || undefined}
        aria-pressed={view === "diagram"}
        onClick={() => onViewChange("diagram")}
      >
        Diagram
      </button>
    </div>
  );
}
