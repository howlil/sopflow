import { GitFork, List, PanelRight, PenLine, Workflow } from "lucide-react";
import { useState } from "react";

import {
  SopWorkspace,
  type SopWorkspaceProps,
  type SopWorkspaceView,
} from "./SopWorkspace.js";
import type { SopDiagramKind } from "../SopEditor.js";
import styles from "./SopUnifiedWorkspace.module.css";

type UnifiedView = "flowchart" | "bpmn" | "steps";
type ManagedProps =
  | "view"
  | "onViewChange"
  | "diagramKind"
  | "onDiagramKindChange"
  | "manualEditing"
  | "onManualEditingChange"
  | "inspectorOpen"
  | "onInspectorOpenChange"
  | "toolbarPlacement"
  | "inspectorTogglePlacement";

export interface SopUnifiedWorkspaceProps
  extends Omit<SopWorkspaceProps, ManagedProps> {
  /** Optional app identity in the compact toolbar. Defaults to SOPFlow. */
  brandLabel?: string;
}

/**
 * Opt-in workbench layout. The ordinary SopWorkspace API and its
 * in-document toolbar remain unchanged for existing consumers.
 */
export function SopUnifiedWorkspace({
  brandLabel = "SOPFlow",
  className,
  value,
  ...workspaceProps
}: SopUnifiedWorkspaceProps) {
  const [view, setView] = useState<UnifiedView>("flowchart");
  const [lastDiagramKind, setLastDiagramKind] =
    useState<SopDiagramKind>("flowchart");
  const [manualEditing, setManualEditing] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const workspaceView: SopWorkspaceView =
    view === "steps" ? "editor" : "diagram";
  const diagramKind = view === "steps" ? lastDiagramKind : view;
  const readOnly = workspaceProps.readOnly ?? false;
  const loading = workspaceProps.loading ?? false;
  const routeEditingAvailable =
    !readOnly &&
    !loading &&
    (workspaceProps.diagramConfigs === undefined ||
      workspaceProps.onDiagramConfigsChange !== undefined);

  function changeView(next: UnifiedView) {
    if (next === "steps") {
      setManualEditing(false);
    } else {
      setLastDiagramKind(next);
    }
    setView(next);
  }

  function handleWorkspaceViewChange(next: SopWorkspaceView) {
    if (next === "editor") {
      changeView("steps");
    } else {
      changeView(lastDiagramKind);
    }
  }

  function handleDiagramKindChange(next: SopDiagramKind) {
    setLastDiagramKind(next);
    if (view !== "steps") setView(next);
  }

  function toggleRoutes() {
    if (!routeEditingAvailable || view === "steps") return;
    setManualEditing((current) => !current);
  }

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-sopflow-unified-workspace
    >
      <header className={styles.topBar}>
        <div className={styles.identity}>
          <span className={styles.logo} aria-hidden="true">
            <Workflow size={17} strokeWidth={1.8} />
          </span>
          <strong className={styles.brand}>{brandLabel}</strong>
          <span className={styles.separator} aria-hidden="true" />
          <span className={styles.documentTitle} title={value.title}>
            {value.title || "Untitled SOP"}
          </span>
        </div>

        <nav className={styles.navigation} aria-label="Tampilan SOP">
          <div className={styles.switcher}>
            <button
              type="button"
              className={styles.tab}
              data-active={view === "flowchart"}
              aria-pressed={view === "flowchart"}
              onClick={() => changeView("flowchart")}
            >
              <GitFork size={15} aria-hidden="true" />
              Flowchart
            </button>
            <button
              type="button"
              className={styles.tab}
              data-active={view === "bpmn"}
              aria-pressed={view === "bpmn"}
              onClick={() => changeView("bpmn")}
            >
              <Workflow size={15} aria-hidden="true" />
              BPMN
            </button>
            {!readOnly ? (
              <button
                type="button"
                className={styles.tab}
                data-active={view === "steps"}
                aria-pressed={view === "steps"}
                onClick={() => changeView("steps")}
              >
                <List size={15} aria-hidden="true" />
                Steps
              </button>
            ) : null}
          </div>
          {!readOnly && view !== "steps" ? (
            <button
              type="button"
              className={styles.iconButton}
              data-active={manualEditing}
              aria-label="Edit routes"
              title={
                routeEditingAvailable
                  ? "Edit routes"
                  : "Route editing unavailable"
              }
              aria-pressed={manualEditing}
              disabled={!routeEditingAvailable}
              onClick={toggleRoutes}
            >
              <PenLine size={16} aria-hidden="true" />
            </button>
          ) : null}
        </nav>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconButton}
            data-active={inspectorOpen}
            aria-label="Toggle Properties"
            title="Toggle Properties"
            aria-pressed={inspectorOpen}
            onClick={() => setInspectorOpen((current) => !current)}
          >
            <PanelRight size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className={styles.workspaceStage}>
        <SopWorkspace
          {...workspaceProps}
          value={value}
          view={workspaceView}
          onViewChange={handleWorkspaceViewChange}
          diagramKind={diagramKind}
          onDiagramKindChange={handleDiagramKindChange}
          manualEditing={manualEditing}
          onManualEditingChange={setManualEditing}
          inspectorOpen={inspectorOpen}
          onInspectorOpenChange={setInspectorOpen}
          toolbarPlacement="external"
          inspectorTogglePlacement="external"
        />
      </div>
    </section>
  );
}
