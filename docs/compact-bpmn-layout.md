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
    • step advance 128 px; column gap derived from stepGap
    • lane height ≥ 112 px and ≥ rotated actor label length
 → reconcileBpmnRoutes (unchanged manual/feedback semantics)
 → BpmnModel { width, height, lanes, nodes, edges }
 → <SopBpmn> intrinsic SVG width/height/viewBox
    • rotated labels centered in header lane
    • CSS max-width 100%; height auto; no forced minimum
 → preview/print
```

The renderer never creates empty padding in order to fill a fixed 52rem × 18rem canvas. Smaller intrinsic SVGs are not upscaled, and larger SVGs shrink proportionally to fit their available width. A4 landscape remains controlled by the existing document print CSS.

## E — expected failures and invariants

- Long actor names can escape vertically: expand only that lane's height based on a conservative measured character budget. The browser acceptance also checks the rotated text bounding rect lies inside its lane header.
- Narrow viewports may downscale too far: preserve aspect ratio and never clip; text readability should be reviewed on actual mobile/printed output. Do not truncate task labels.
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
4. Canvas follows intrinsic width/height, does not inflate small diagrams and shrinks proportionally in narrower viewports.
5. Printed diagram generates a nonempty A4 landscape PDF; source screenshot and PDF remain CI artifacts.
6. Existing public `BpmnLayoutOptions` continue to work, no new design settings or unrelated UI changes.
