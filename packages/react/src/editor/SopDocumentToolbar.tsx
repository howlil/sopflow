import styles from "./SopDocumentToolbar.module.css";

export type SopDocumentMode = "preview" | "steps";
export type SopDiagramKind = "flowchart" | "bpmn";

export interface SopDocumentToolbarProps {
  mode: SopDocumentMode;
  onModeChange: (mode: SopDocumentMode) => void;
  diagramKind: SopDiagramKind;
  onDiagramKindChange: (kind: SopDiagramKind) => void;
  manualEditing: boolean;
  onManualEditingChange: (editing: boolean) => void;
  readOnly?: boolean;
  manualEditingSupported?: boolean;
}

export function SopDocumentToolbar({
  mode,
  onModeChange,
  diagramKind,
  onDiagramKindChange,
  manualEditing,
  onManualEditingChange,
  readOnly = false,
  manualEditingSupported = true,
}: SopDocumentToolbarProps) {
  return (
    <div
      className={styles.toolbar}
      role="toolbar"
      aria-label="Kontrol dokumen SOP"
      data-sopflow-document-toolbar
    >
      {!readOnly ? (
        <div className={styles.group}>
          <button
            type="button"
            className={styles.button}
            data-active={mode === "steps" || undefined}
            aria-pressed={mode === "steps"}
            onClick={() => onModeChange(mode === "steps" ? "preview" : "steps")}
          >
            {mode === "steps" ? "Diagram" : "Langkah"}
          </button>

          <button
            type="button"
            className={styles.button}
            data-active={manualEditing || undefined}
            aria-pressed={manualEditing}
            disabled={!manualEditingSupported || mode === "steps"}
            onClick={() => onManualEditingChange(!manualEditing)}
          >
            Edit Manual
          </button>
        </div>
      ) : null}

      {!readOnly ? (
        <span className={styles.divider} aria-hidden="true" />
      ) : null}

      <fieldset className={styles.tabs}>
        <legend className={styles.srOnly}>Jenis diagram</legend>
        <button
          type="button"
          className={styles.tab}
          data-active={diagramKind === "flowchart" || undefined}
          aria-pressed={diagramKind === "flowchart"}
          disabled={mode === "steps"}
          onClick={() => onDiagramKindChange("flowchart")}
        >
          Flowchart
        </button>
        <button
          type="button"
          className={styles.tab}
          data-active={diagramKind === "bpmn" || undefined}
          aria-pressed={diagramKind === "bpmn"}
          disabled={mode === "steps"}
          onClick={() => onDiagramKindChange("bpmn")}
        >
          BPMN
        </button>
      </fieldset>
    </div>
  );
}
