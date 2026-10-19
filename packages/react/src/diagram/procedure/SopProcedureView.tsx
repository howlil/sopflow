import type { SOPDocument, StepId, ValidationIssue } from "@sopflow/core";
import {
  buildFormalProcedurePages,
  buildProcedureModel,
  diagramConfigEquals,
  pruneProcedurePagedRoutes,
  type ProcedureManualTrunks,
  type SopDiagramConfig,
} from "@sopflow/diagram";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SopProcedurePage } from "./SopProcedurePage.js";
import { LegacySinglePageSopProcedureView } from "./LegacySinglePageProcedureView.js";
import styles from "./SopProcedureView.module.css";

export type SopManualPathOffsets = ProcedureManualTrunks;

export interface SopProcedureViewProps {
  document: SOPDocument;
  selectedStepId?: StepId | null;
  onSelectedStepChange?: (stepId: StepId | null) => void;
  issues?: readonly ValidationIssue[];
  manualEditing?: boolean;
  diagramConfig?: SopDiagramConfig;
  onDiagramConfigChange?: (config: SopDiagramConfig) => void;
  /** @deprecated Use diagramConfig. */
  manualPathOffsets?: SopManualPathOffsets;
  /** @deprecated Use onDiagramConfigChange. */
  onManualPathOffsetsChange?: (offsets: SopManualPathOffsets) => void;
  firstPageRows?: number;
  nextPageRows?: number;
  pageHeightPx?: number;
  firstPageReservedHeightPx?: number;
  nextPageReservedHeightPx?: number;
  className?: string;
}

export function SopProcedureView(props: SopProcedureViewProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [tableHeaderHeightPx, setTableHeaderHeightPx] = useState(0);
  const [measuredRowHeights, setMeasuredRowHeights] = useState<
    Readonly<Record<string, number>>
  >({});
  const model = useMemo(
    () => buildProcedureModel(props.document),
    [props.document],
  );
  const pages = useMemo(
    () =>
      buildFormalProcedurePages(model, {
        ...(props.firstPageRows !== undefined
          ? { firstPageRows: props.firstPageRows }
          : {}),
        ...(props.nextPageRows !== undefined
          ? { nextPageRows: props.nextPageRows }
          : {}),
        ...(props.pageHeightPx !== undefined
          ? { pageHeightPx: props.pageHeightPx, tableHeaderHeightPx }
          : {}),
        ...(props.firstPageReservedHeightPx !== undefined
          ? { firstPageReservedHeightPx: props.firstPageReservedHeightPx }
          : {}),
        ...(props.nextPageReservedHeightPx !== undefined
          ? { nextPageReservedHeightPx: props.nextPageReservedHeightPx }
          : {}),
        ...(Object.keys(measuredRowHeights).length > 0
          ? { measuredRowHeights }
          : {}),
      }),
    [
      model,
      props.firstPageReservedHeightPx,
      props.firstPageRows,
      props.nextPageReservedHeightPx,
      props.nextPageRows,
      props.pageHeightPx,
      tableHeaderHeightPx,
      measuredRowHeights,
    ],
  );
  const measureRenderedRows = useCallback(() => {
    if (props.pageHeightPx === undefined) {
      setMeasuredRowHeights((current) =>
        Object.keys(current).length === 0 ? current : {},
      );
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    const tableHeader = root.querySelector<HTMLElement>(
      "[data-sopflow-procedure-page] thead",
    );
    if (tableHeader) {
      const height = Math.round(tableHeader.getBoundingClientRect().height);
      if (height > 0) {
        setTableHeaderHeightPx((current) =>
          Math.abs(current - height) <= 1 ? current : height,
        );
      }
    }

    const next: Record<string, number> = {};
    for (const row of root.querySelectorAll<HTMLElement>(
      "[data-sopflow-procedure-step-id]",
    )) {
      const stepId = row.dataset.sopflowProcedureStepId;
      const height = row.getBoundingClientRect().height;
      if (stepId && Number.isFinite(height) && height > 0) {
        next[stepId] = Math.round(height);
      }
    }

    setMeasuredRowHeights((current) => {
      // Preserve measurements for rows moved to an unseen page by reflow.
      // Only current model rows may survive between measurements.
      const active = new Set(model.rows.map((row) => row.stepId));
      const combined = Object.fromEntries(
        Object.entries(current).filter(([id]) => active.has(id)),
      );
      Object.assign(combined, next);
      return measuredRowHeightMapsEqual(current, combined) ? current : combined;
    });
  }, [props.pageHeightPx, model.rows]);

  useLayoutEffect(() => {
    measureRenderedRows();

    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measureRenderedRows);
    observer.observe(root);
    return () => observer.disconnect();
  }, [measureRenderedRows]);

  const [internalDiagramConfig, setInternalDiagramConfig] =
    useState<SopDiagramConfig>({});
  const usesLegacyManualPaths =
    props.diagramConfig === undefined &&
    (props.manualPathOffsets !== undefined ||
      props.onManualPathOffsetsChange !== undefined);
  const rawDiagramConfig = props.diagramConfig ?? internalDiagramConfig;
  const diagramConfig = useMemo(
    () => pruneProcedurePagedRoutes(pages, rawDiagramConfig),
    [pages, rawDiagramConfig],
  );
  const updateDiagramConfig = useCallback(
    (next: SopDiagramConfig) => {
      if (props.diagramConfig === undefined) {
        setInternalDiagramConfig(next);
      }
      props.onDiagramConfigChange?.(next);
    },
    [props.diagramConfig, props.onDiagramConfigChange],
  );

  useEffect(() => {
    if (diagramConfigEquals(rawDiagramConfig, diagramConfig)) return;
    updateDiagramConfig(diagramConfig);
  }, [diagramConfig, rawDiagramConfig, updateDiagramConfig]);

  // Preserve the deprecated trunk-offset API without letting it constrain the
  // modern paginated renderer. Current editor consumers always use diagramConfig.
  if (usesLegacyManualPaths && pages.length <= 1) {
    return <LegacySinglePageSopProcedureView {...props} />;
  }

  return (
    <section
      ref={rootRef}
      className={[styles.paginatedRoot, props.className]
        .filter(Boolean)
        .join(" ")}
      data-sopflow-procedure-view
      data-sopflow-procedure-pages={pages.length}
      data-manual-editing={props.manualEditing || undefined}
      aria-label="Prosedur SOP"
    >
      {pages.map((page) => (
        <SopProcedurePage
          key={page.pageIndex}
          model={model}
          page={page}
          manualEditing={props.manualEditing ?? false}
          diagramConfig={diagramConfig}
          onDiagramConfigChange={updateDiagramConfig}
          {...(props.selectedStepId !== undefined
            ? { selectedStepId: props.selectedStepId }
            : {})}
          {...(props.onSelectedStepChange !== undefined
            ? { onSelectedStepChange: props.onSelectedStepChange }
            : {})}
          {...(props.issues !== undefined ? { issues: props.issues } : {})}
        />
      ))}
    </section>
  );
}

function measuredRowHeightMapsEqual(
  first: Readonly<Record<string, number>>,
  second: Readonly<Record<string, number>>,
): boolean {
  const firstIds = Object.keys(first);
  const secondIds = Object.keys(second);
  if (firstIds.length !== secondIds.length) return false;

  return firstIds.every(
    (stepId) =>
      second[stepId] !== undefined &&
      Math.abs((first[stepId] ?? 0) - (second[stepId] ?? 0)) <= 1,
  );
}
