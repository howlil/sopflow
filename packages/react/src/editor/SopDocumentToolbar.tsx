import { useRef, type KeyboardEvent } from "react";

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
  diagramPanelId: string;
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
  diagramPanelId,
  readOnly = false,
  manualEditingSupported = true,
}: SopDocumentToolbarProps) {
  const diagramTabRefs = useRef<
    Partial<Record<SopDiagramKind, HTMLButtonElement | null>>
  >({});

  function handleDiagramKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    current: SopDiagramKind,
  ) {
    const kinds: SopDiagramKind[] = ["flowchart", "bpmn"];
    const currentIndex = kinds.indexOf(current);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % kinds.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + kinds.length) % kinds.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = kinds.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const next = kinds[nextIndex] as SopDiagramKind;
    onDiagramKindChange(next);
    requestAnimationFrame(() => diagramTabRefs.current[next]?.focus());
  }

  return (
    <div
      className={styles.toolbar}
      role="toolbar"
      aria-label="Kontrol dokumen SOP"
      data-sopflow-document-toolbar
    >
      {!readOnly ? (
        <fieldset className={[styles.tabs, styles.modeTabs].join(" ")}>
          <legend className={styles.srOnly}>Mode dokumen</legend>
          <button
            type="button"
            className={styles.tab}
            data-active={mode === "preview" || undefined}
            aria-pressed={mode === "preview"}
            aria-label="Preview"
            title="Preview"
            onClick={() => onModeChange("preview")}
          >
            <ToolbarIcon type="preview" />
          </button>
          <button
            type="button"
            className={styles.tab}
            data-active={mode === "steps" || undefined}
            aria-pressed={mode === "steps"}
            aria-label="Edit langkah"
            title="Edit langkah"
            onClick={() => onModeChange("steps")}
          >
            <ToolbarIcon type="steps" />
          </button>
        </fieldset>
      ) : null}

      {!readOnly ? (
        <div className={styles.group}>
          <button
            type="button"
            className={styles.button}
            data-active={manualEditing || undefined}
            aria-pressed={manualEditing}
            aria-label="Edit Manual"
            title="Edit Manual"
            disabled={!manualEditingSupported || mode === "steps"}
            onClick={() => onManualEditingChange(!manualEditing)}
          >
            <ToolbarIcon type="manual" />
          </button>
        </div>
      ) : null}

      {!readOnly ? (
        <span className={styles.divider} aria-hidden="true" />
      ) : null}

      <div
        className={[styles.tabs, styles.diagramTabs].join(" ")}
        role="tablist"
        aria-label="Jenis diagram"
      >
        <button
          type="button"
          className={styles.tab}
          id={`${diagramPanelId}-tab-flowchart`}
          role="tab"
          aria-selected={diagramKind === "flowchart"}
          aria-controls={diagramPanelId}
          tabIndex={diagramKind === "flowchart" ? 0 : -1}
          disabled={mode === "steps"}
          ref={(element) => {
            diagramTabRefs.current.flowchart = element;
          }}
          data-active={diagramKind === "flowchart" || undefined}
          aria-label="Flowchart"
          title="Flowchart"
          onKeyDown={(event) => handleDiagramKeyDown(event, "flowchart")}
          onClick={() => onDiagramKindChange("flowchart")}
        >
          <ToolbarIcon type="flowchart" />
        </button>
        <button
          type="button"
          className={styles.tab}
          id={`${diagramPanelId}-tab-bpmn`}
          role="tab"
          aria-selected={diagramKind === "bpmn"}
          aria-controls={diagramPanelId}
          tabIndex={diagramKind === "bpmn" ? 0 : -1}
          disabled={mode === "steps"}
          ref={(element) => {
            diagramTabRefs.current.bpmn = element;
          }}
          data-active={diagramKind === "bpmn" || undefined}
          aria-label="BPMN"
          title="BPMN"
          onKeyDown={(event) => handleDiagramKeyDown(event, "bpmn")}
          onClick={() => onDiagramKindChange("bpmn")}
        >
          <ToolbarIcon type="bpmn" />
        </button>
      </div>
    </div>
  );
}

type ToolbarIconType = "preview" | "steps" | "manual" | "flowchart" | "bpmn";

function ToolbarIcon({ type }: { type: ToolbarIconType }) {
  const commonProps = {
    className: styles.icon,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (type === "preview") {
    return (
      <svg {...commonProps} aria-hidden="true">
        <path d="M1.5 8s2.2-4 6.5-4 6.5 4 6.5 4-2.2 4-6.5 4-6.5-4-6.5-4Z" />
        <circle cx="8" cy="8" r="1.8" />
      </svg>
    );
  }

  if (type === "steps") {
    return (
      <svg {...commonProps} aria-hidden="true">
        <path d="M5 4h8M5 8h8M5 12h8" />
        <circle cx="2.5" cy="4" r=".7" fill="currentColor" stroke="none" />
        <circle cx="2.5" cy="8" r=".7" fill="currentColor" stroke="none" />
        <circle cx="2.5" cy="12" r=".7" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (type === "manual") {
    return (
      <svg {...commonProps} aria-hidden="true">
        <path d="m9.8 2.3 3.9 3.9-7.6 7.5-3.5.6.6-3.5 7.6-7.5Z" />
        <path d="m8.4 3.7 3.9 3.9" />
      </svg>
    );
  }

  if (type === "flowchart") {
    return (
      <svg {...commonProps} aria-hidden="true">
        <rect x="5.25" y="1.75" width="5.5" height="3" rx="1" />
        <rect x="1.75" y="11.25" width="5.5" height="3" rx="1" />
        <rect x="8.75" y="11.25" width="5.5" height="3" rx="1" />
        <path d="M8 4.75v3M8 7.75H4.5v3.5M8 7.75h3.5v3.5" />
      </svg>
    );
  }

  return (
    <svg {...commonProps} aria-hidden="true">
      <circle cx="3.25" cy="8" r="2" />
      <rect x="9" y="2.25" width="4" height="3.5" rx=".7" />
      <rect x="9" y="10.25" width="4" height="3.5" rx=".7" />
      <path d="M5.25 8h2.25M7.5 8V4h1.5M7.5 8v4h1.5" />
    </svg>
  );
}
