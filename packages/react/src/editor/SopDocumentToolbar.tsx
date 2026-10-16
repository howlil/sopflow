import { useRef, type KeyboardEvent } from "react";

import { Eye, List, PenLine, GitFork, Workflow } from "lucide-react";
import { Button } from "../components/arc/button/button.js";
import { Tooltip } from "../components/arc/tooltip/tooltip.js";
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
          <Tooltip content="Preview">
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className={styles.tab}
              data-active={mode === "preview" || undefined}
              aria-pressed={mode === "preview"}
              aria-label="Preview"
              onClick={() => onModeChange("preview")}
            >
              <ToolbarIcon type="preview" />
            </Button>
          </Tooltip>
          <Tooltip content="Edit langkah">
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className={styles.tab}
              data-active={mode === "steps" || undefined}
              aria-pressed={mode === "steps"}
              aria-label="Edit langkah"
              onClick={() => onModeChange("steps")}
            >
              <ToolbarIcon type="steps" />
            </Button>
          </Tooltip>
        </fieldset>
      ) : null}

      {!readOnly ? (
        <div className={styles.group}>
          <Tooltip content="Edit Manual">
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className={styles.button}
              data-active={manualEditing || undefined}
              aria-pressed={manualEditing}
              aria-label="Edit Manual"
              disabled={!manualEditingSupported || mode === "steps"}
              onClick={() => onManualEditingChange(!manualEditing)}
            >
              <ToolbarIcon type="manual" />
            </Button>
          </Tooltip>
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
        <Tooltip content="Flowchart">
          <Button
            size="sm"
            variant="ghost"
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
            onKeyDown={(event) => handleDiagramKeyDown(event, "flowchart")}
            onClick={() => onDiagramKindChange("flowchart")}
          >
            <ToolbarIcon type="flowchart" />
          </Button>
        </Tooltip>
        <Tooltip content="BPMN">
          <Button
            size="sm"
            variant="ghost"
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
            onKeyDown={(event) => handleDiagramKeyDown(event, "bpmn")}
            onClick={() => onDiagramKindChange("bpmn")}
          >
            <ToolbarIcon type="bpmn" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

type ToolbarIconType = "preview" | "steps" | "manual" | "flowchart" | "bpmn";

function ToolbarIcon({ type }: { type: ToolbarIconType }) {
  const props = {
    className: styles.icon,
    size: 16,
    strokeWidth: 1.6,
    "aria-hidden": true as const,
  };
  if (type === "preview") return <Eye {...props} />;
  if (type === "steps") return <List {...props} />;
  if (type === "manual") return <PenLine {...props} />;
  if (type === "flowchart") return <GitFork {...props} />;
  return <Workflow {...props} />;
}
