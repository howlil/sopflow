import type { SOPDocument, StepId } from "@sopflow/core";
import { useState } from "react";

import { SopEditor, type SopDiagramKind } from "../SopEditor.js";
import type { SopHeaderValue } from "../types.js";

export type SopWorkspaceView = "editor" | "diagram";

export interface SopWorkspaceProps {
  value: SOPDocument;
  onChange?: (document: SOPDocument) => void;
  header: SopHeaderValue;
  onHeaderChange?: (header: SopHeaderValue) => void;
  view?: SopWorkspaceView;
  onViewChange?: (view: SopWorkspaceView) => void;
  diagramKind?: SopDiagramKind;
  onDiagramKindChange?: (kind: SopDiagramKind) => void;
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
  diagramKind,
  onDiagramKindChange,
  selectedStepId,
  onSelectedStepChange,
  readOnly = false,
  loading = false,
  error = null,
  className,
}: SopWorkspaceProps) {
  const [internalView, setInternalView] = useState<SopWorkspaceView>("diagram");

  const view = controlledView ?? internalView;

  function handleViewChange(next: "preview" | "steps") {
    const mapped: SopWorkspaceView = next === "steps" ? "editor" : "diagram";

    if (controlledView === undefined) {
      setInternalView(mapped);
    }

    onViewChange?.(mapped);
  }

  return (
    <SopEditor
      value={value}
      header={header}
      mode={view === "editor" ? "steps" : "preview"}
      onModeChange={handleViewChange}
      readOnly={readOnly}
      loading={loading}
      error={error}
      {...(onChange ? { onChange } : {})}
      {...(onHeaderChange ? { onHeaderChange } : {})}
      {...(diagramKind ? { diagramKind } : {})}
      {...(onDiagramKindChange ? { onDiagramKindChange } : {})}
      {...(selectedStepId !== undefined ? { selectedStepId } : {})}
      {...(onSelectedStepChange ? { onSelectedStepChange } : {})}
      {...(className ? { className } : {})}
    />
  );
}
