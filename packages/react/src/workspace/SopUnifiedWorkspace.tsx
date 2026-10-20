import {
  GitFork,
  List,
  Minus,
  PanelRight,
  PenLine,
  Plus,
  Workflow,
} from "lucide-react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import {
  SopWorkspace,
  type SopWorkspaceProps,
  type SopWorkspaceView,
} from "./SopWorkspace.js";
import type { SopDiagramKind } from "../SopEditor.js";
import type { SopReadinessIssue } from "../validation/readiness.js";
import { getSopReadinessIssues } from "../validation/readiness.js";
import { ProblemsPanel } from "./ProblemsPanel.js";
import { resolveProblemTarget } from "./resolveProblemTarget.js";
import styles from "./SopUnifiedWorkspace.module.css";

type UnifiedView = "flowchart" | "bpmn" | "steps";

const A4_LANDSCAPE_WIDTH_PX = (297 * 96) / 25.4;
const MIN_ZOOM_PERCENT = 25;
const MAX_ZOOM_PERCENT = 200;
const MIN_INSPECTOR_WIDTH = 220;
const MAX_INSPECTOR_WIDTH = 370;
const MIN_CANVAS_WIDTH = 320;

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}
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
  const [inspectorWidth, setInspectorWidth] = useState(258);
  const [isCompact, setIsCompact] = useState(false);
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [zoomPercent, setZoomPercent] = useState(100);
  const [fitScale, setFitScale] = useState(1);
  const dragPointerId = useRef<number | null>(null);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [issues, setIssues] = useState<readonly SopReadinessIssue[]>(() =>
    getSopReadinessIssues(value, workspaceProps.header),
  );
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<
    | { kind: "header"; field: string }
    | { kind: "step"; stepId: string }
    | { kind: "actors" }
    | { kind: "steps" }
    | null
  >(null);
  const [navigationFeedback, setNavigationFeedback] = useState<string | null>(
    null,
  );
  const shellRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const effectiveScale = zoomMode === "fit" ? fitScale : zoomPercent / 100;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const pane = shellRef.current?.querySelector<HTMLElement>(
      "[data-sopflow-main-pane]",
    );
    if (!stage || !pane) return;
    const measure = () => {
      const stageWidth = stage.clientWidth;
      if (stageWidth <= 0) return;
      setIsCompact(stageWidth <= 620);
      const content = getComputedStyle(pane);
      const horizontalPadding =
        (Number.parseFloat(content.paddingLeft) || 0) +
        (Number.parseFloat(content.paddingRight) || 0);
      const freeWidth = Math.max(0, pane.clientWidth - horizontalPadding - 8);
      if (freeWidth > 0) {
        setFitScale(clamp(freeWidth / A4_LANDSCAPE_WIDTH_PX, 0.25, 1));
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  function changeZoom(delta: number) {
    const current = zoomMode === "fit" ? fitScale * 100 : zoomPercent;
    const next = clamp(
      Math.round((current + delta) / 10) * 10,
      MIN_ZOOM_PERCENT,
      MAX_ZOOM_PERCENT,
    );
    setZoomPercent(next);
    setZoomMode("manual");
  }

  function resizeInspector(nextWidth: number) {
    const available = stageRef.current?.clientWidth ?? 0;
    if (!available) return;
    const maximum = Math.max(
      MIN_INSPECTOR_WIDTH,
      Math.min(MAX_INSPECTOR_WIDTH, available - MIN_CANVAS_WIDTH),
    );
    setInspectorWidth(clamp(nextWidth, MIN_INSPECTOR_WIDTH, maximum));
  }

  function onInspectorPointerDown(event: PointerEvent<HTMLHRElement>) {
    if (isCompact || !inspectorOpen || event.button !== 0) return;
    dragPointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function onInspectorPointerMove(event: PointerEvent<HTMLHRElement>) {
    if (dragPointerId.current !== event.pointerId) return;
    const stage = stageRef.current;
    if (!stage) return;
    resizeInspector(stage.getBoundingClientRect().right - event.clientX);
  }

  function onInspectorPointerEnd(event: PointerEvent<HTMLHRElement>) {
    if (dragPointerId.current !== event.pointerId) return;
    dragPointerId.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  }

  function onInspectorResizeKeyDown(event: KeyboardEvent<HTMLHRElement>) {
    if (isCompact || !inspectorOpen) return;
    const step = event.shiftKey ? 25 : 10;
    let delta = 0;
    if (event.key === "ArrowLeft") delta = step;
    if (event.key === "ArrowRight") delta = -step;
    if (event.key === "Home") delta = MIN_INSPECTOR_WIDTH - inspectorWidth;
    if (event.key === "End") delta = MAX_INSPECTOR_WIDTH - inspectorWidth;
    if (!delta) return;
    event.preventDefault();
    resizeInspector(inspectorWidth + delta);
  }

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

  const handleReadinessChange = useCallback(
    (nextIssues: readonly SopReadinessIssue[]) => {
      setIssues(nextIssues);
      workspaceProps.onReadinessChange?.(nextIssues);
    },
    [workspaceProps.onReadinessChange],
  );

  function handleSelectedStepChange(stepId: string | null) {
    setSelectedStep(stepId);
    workspaceProps.onSelectedStepChange?.(stepId);
  }

  function navigateToIssue(issue: SopReadinessIssue) {
    setNavigationFeedback(null);
    setPendingNavigation(null);
    const target = resolveProblemTarget(issue);
    if (target.kind === "header") {
      setInspectorOpen(true);
      setPendingNavigation(target);
      return;
    }
    if (target.kind === "actors") {
      setInspectorOpen(true);
      setPendingNavigation({ kind: "actors" });
      return;
    }
    if (
      target.kind === "step" &&
      value.steps.some((step) => step.id === target.stepId)
    ) {
      setManualEditing(false);
      changeView("steps");
      handleSelectedStepChange(target.stepId);
      setPendingNavigation(target);
      return;
    }
    if (target.kind === "steps" || target.kind === "step") {
      changeView("steps");
      setPendingNavigation({ kind: "steps" });
      return;
    }
    setNavigationFeedback(
      "This issue has no direct field target. Review the document and validation details.",
    );
  }

  useLayoutEffect(() => {
    if (!pendingNavigation) return;
    const shell = shellRef.current;
    if (!shell) return;
    let target: HTMLElement | undefined;
    if (pendingNavigation.kind === "actors") {
      target =
        shell.querySelector<HTMLElement>("[data-sopflow-actors]") ?? undefined;
    } else if (pendingNavigation.kind === "steps") {
      target =
        shell.querySelector<HTMLElement>(
          '[aria-label="Navigasi langkah SOP"]',
        ) ?? undefined;
    } else {
      const attr =
        pendingNavigation.kind === "header"
          ? "data-sopflow-header-field"
          : "data-sopflow-step-id";
      const expected =
        pendingNavigation.kind === "header"
          ? pendingNavigation.field
          : pendingNavigation.stepId;
      target = Array.from(
        shell.querySelectorAll<HTMLElement>(`[${attr}]`),
      ).find(
        (node) =>
          (pendingNavigation.kind === "header"
            ? node.dataset.sopflowHeaderField
            : node.dataset.sopflowStepId) === expected,
      );
    }
    if (target) {
      if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "nearest" });
      }
      target.focus({ preventScroll: true });
    } else {
      setNavigationFeedback(
        "The target is not available. Review the relevant section manually.",
      );
    }
    setPendingNavigation(null);
  }, [pendingNavigation]);

  return (
    <section
      ref={shellRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-sopflow-unified-workspace
      data-compact={isCompact || undefined}
      data-zoom-mode={zoomMode}
      style={
        {
          "--sopflow-unified-inspector-width": `${inspectorWidth}px`,
        } as CSSProperties
      }
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
          <fieldset className={styles.zoomControls} aria-label="Canvas zoom">
            <button
              type="button"
              className={styles.zoomButton}
              aria-label="Zoom out"
              title="Zoom out"
              disabled={effectiveScale <= MIN_ZOOM_PERCENT / 100}
              onClick={() => changeZoom(-10)}
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.zoomLabel}
              aria-label="Fit to viewport"
              title="Fit to viewport"
              onClick={() => setZoomMode("fit")}
            >
              {zoomMode === "fit" ? "Fit" : `${zoomPercent}%`}
            </button>
            <button
              type="button"
              className={styles.zoomButton}
              aria-label="Zoom in"
              title="Zoom in"
              disabled={effectiveScale >= MAX_ZOOM_PERCENT / 100}
              onClick={() => changeZoom(10)}
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </fieldset>
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

      <div className={styles.workspaceStage} ref={stageRef}>
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
          previewScale={effectiveScale}
          selectedStepId={
            workspaceProps.selectedStepId !== undefined
              ? workspaceProps.selectedStepId
              : selectedStep
          }
          onSelectedStepChange={handleSelectedStepChange}
          onReadinessChange={handleReadinessChange}
        />
        {inspectorOpen && !isCompact ? (
          <hr
            className={styles.inspectorResize}
            data-sopflow-inspector-resize
            aria-label="Resize Properties"
            aria-orientation="vertical"
            aria-valuemin={MIN_INSPECTOR_WIDTH}
            aria-valuemax={Math.max(
              MIN_INSPECTOR_WIDTH,
              Math.min(
                MAX_INSPECTOR_WIDTH,
                (stageRef.current?.clientWidth ?? 900) - MIN_CANVAS_WIDTH,
              ),
            )}
            aria-valuenow={inspectorWidth}
            tabIndex={0}
            onPointerDown={onInspectorPointerDown}
            onPointerMove={onInspectorPointerMove}
            onPointerUp={onInspectorPointerEnd}
            onPointerCancel={onInspectorPointerEnd}
            onKeyDown={onInspectorResizeKeyDown}
          />
        ) : null}
      </div>
      <ProblemsPanel
        issues={issues}
        runtimeError={workspaceProps.error ?? null}
        expanded={problemsOpen}
        onExpandedChange={setProblemsOpen}
        onNavigate={navigateToIssue}
        navigationFeedback={navigationFeedback}
      />
    </section>
  );
}
