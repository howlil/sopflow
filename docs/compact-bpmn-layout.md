# Compact BPMN pool — design-thinking implementation contract

Reference implementation: `howlil/sop-ta` `BpmnPage.tsx` and `bpmnDiagramMetrics.ts`. SOPFlow keeps its **single SVG layout** and semantic/manual route engine; only density, lane header geometry, intrinsic sizing and responsive/print presentation change.

## A — success graph

```text
SOPDocument
 → projectWorkflow
 → layoutBpmnGraph (unchanged semantic ranks)
 → measureBpmnNode (max task width 168 px)
 → calculate compact lane/column bounds
    • header 36 px, canvas padding 8 px
    • initial step advance 128 px, retry 144/160 px only for unsafe routing
    • explicit caller-specified stepGap bypasses automatic retry
    • column gap derived from stepGap
    • lane height ≥ 112 px and ≥ rotated actor label length
 → reconcileBpmnRoutes (unchanged manual/feedback semantics)
 → BpmnModel { width, height, lanes, nodes, edges }
 → <SopBpmn presentation="intrinsic" | "document">
    • intrinsic: keep the compact SVG model width/height/viewBox
    • document: observe the host content box (unzoomed CSS pixels)
    • expand only the swimlane grid and SVG width to max(model.width, hostWidth)
    • draw one frame, one actor separator and one separator per lane boundary
    • keep model node positions, edge points and route edits unchanged
    • CSS max-width 100%; height auto; no forced minimum
 → preview/print
```

Standalone/intrinsic rendering never inflates small diagrams for a fixed canvas. Document rendering fills the full width of the SOP content grid (the same 267mm available to the SOP header), even when the workflow only occupies a few columns. Only swimlane backgrounds/borders expand; activity symbols, labels and connections never stretch in model coordinates. Oversized models shrink proportionally to fit the available page width. Routing-aware spacing retries are deterministic and bounded. A4 landscape remains controlled by the document print CSS.

## E — expected failures and invariants

- Long actor names can escape vertically: expand only that lane's height based on a conservative measured character budget. The browser acceptance also checks the rotated text bounding rect lies inside its lane header.
- Narrow viewports may downscale too far: preserve aspect ratio and never clip; text readability should be reviewed on actual mobile/printed output. Do not truncate task labels.
- ResizeObserver reports host box changes for document mode; absent it, fall back to a window resize listener. Always measure clientWidth, not zoomed boundingClientRect, to keep SVG and A4 header units aligned.
- Dense decision/feedback diagrams might need more routing space: retain baseline 112px lane height, branch/feedback routing corridors, manual route repair, diagnostic scoring and tests for the dense SOP-TA regression. Do not shrink all lanes to match a styling target.
- Persisted diagram routes are semantic configuration, not re-generated: explicit route overrides remain handled by `reconcileBpmnRoutes`; no migration or destructive clearing.
- Existing integrators passing `BpmnLayoutOptions` overrides remain supported, including the old 116px header and 24px padding.
- Printable A4 should scale content within its allocated area; automated Chromium PDF is a smoke artifact rather than a full print-layout visual golden test.

## R — capabilities and scope

- Pure calculations in `@sopflow/diagram`; no network, database, timers, or new runtime dependencies.
- React SVG and CSS sizing in `@sopflow/react`; same click, keyboard selection, and manual route editing.
- Isolated source-only Vite browser page validates actual DOM geometry; normal `apps/playground` still consumes published npm packages, not workspace-linked code.
- Targeted unit/DOM/Chrome and A4-print regressions run in existing CI. No persisted schema change.

## Code-review acceptance

1. Compact defaults reduce pool width versus previous explicit layout values without losing steps, connections or routes.
2. Long actor labels are centered, rotated, and fit inside their own swimlane.
3. Node task labels preserve multiline content; branches, feedback, self-loops and manual overrides do not regress.
4. Standalone canvas follows intrinsic width/height without inflating small diagrams. A4 document mode stretches the swimlane grid to the same available width as the header without modifying node or connector positions.
5. Printed diagram generates a nonempty A4 landscape PDF; source screenshot and PDF remain CI artifacts.
6. Existing public `BpmnLayoutOptions` continue to work; `presentation` is an optional React-level rendering prop, not persisted SOP state.
