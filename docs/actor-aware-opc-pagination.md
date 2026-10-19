# Actor-aware off-page connectors and physical page packing

Implementation contract for the `@sopflow/diagram` planner and `@sopflow/react` formal procedure renderer. Reference: `howlil/sop-ta` flowchart pagination + OPC row layout. The document schema and semantic edge IDs remain unchanged.

## 1. Shapes (A, E, R)

```text
SOPDocument
  → ProcedureModel { rows, actorColumns, graph.edges }
  → FormalProcedurePageModel { rows, topOpc, bottomOpc, routingRows, edges }
  → OPC pair { semanticEdgeId, letter, fromActorId, toActorId }
  → OPC endpoint { variant: in|out, pageIndex, side: top|bottom }
  → DOM actor header bounds + per-page OPC anchor rect
  → FormalFlowchartGeometry → routed SVG edges
```

- **A:** a stable list of visible procedure-table rows, with OPC anchors rendered outside `<table>` and kept in the same page coordinate space as the edge router.
- **E:** invalid/unresolved actor references, physically oversized rows, fonts or DOM bounds not yet available, and failed print layout. Unknown actor IDs are not silently mapped into the first actor column. A single physically oversized row remains intact rather than being split into two invalid partial rows.
- **R:** pure procedure graph/pagination functions in `@sopflow/diagram`; browser DOM measurements, ResizeObserver, print CSS in `@sopflow/react`. No network, database, or Effect runtime dependency.

## 2. Actor ownership and visual layout

A cross-page connection has **two independent actor alignments**:

```text
Page 1: last relevant step in Admin actor lane
         └─ edge source → OPC-out A, aligned with Admin lane, BELOW table

Page 2: OPC-in A, aligned with Student lane, ABOVE table
         └─ edge target → first relevant Student step
```

`variant=out` always uses `opc.fromActorId`; `variant=in` always uses `opc.toActorId`. The same letter is reused on both endpoint anchors, but their X coordinates can differ. Loopback endpoints retain the existing semantic side policy (out at top on the later page; in at bottom on the earlier page). For multi-actor steps, the current `primaryActorId` defined by the first valid actor in the model remains authoritative.

- The JSX marker must be a sibling of the procedure table, not a `<tr>`, `<td>` or an element nested inside `<table>`.
- The marker's horizontal position is the center of its **actual page-specific actor header cell**, measured in the local page coordinate system. Before DOM measurement, use the exact normalized table colgroup widths as a provisional fallback.
- `null` denotes the real fallback `Pelaksana` lane. Unknown non-null actor IDs must not be defaulted to column zero.
- Multiple markers in the same lane stack vertically with the OPC slot height and spacing; the external strip reserves the total stack height.
- Both OPC anchors are regular routing shapes measured by the existing `SopProcedurePage` geometry pass. Expand the vertical routing bounds to include the external anchors.

## 3. Physical page capacity

When `pageHeightPx` is supplied:

```
available = pageHeightPx
          - first/nextPageReservedHeightPx
          - measuredTableHeaderHeightPx

candidateTotal = SUM(measuredOrEstimatedProcedureRowHeight)
               + height(top OPC stacks)
               + height(bottom OPC stacks)
```

`height(OPC strip)` is zero if no crossing edges, else
`60 * maxPerActorStack + 8 * (maxPerActorStack - 1) + 16` px.
This matches `SopProcedurePage` strip layout.

The page planner evaluates candidate contiguous ranges of actual procedure rows. For each candidate it derives the crossing edges relative to the proposed page boundaries, groups OPCs by the **correct source or destination actor**, and computes the strip heights. It chooses the longest fitting row prefix per page, keeping row order unchanged. Unlike iterative splitting, this calculation knows the OPC overhead *for that very candidate boundary*, so it cannot oscillate between two page breaks.

Explicit `firstPageRows/nextPageRows` remain available for standalone consumers without a physical page budget. `SopDocumentCanvas` supplies the A4 physical budget; `SopProcedureView` subsequently measures table header and row heights for correction.

A row higher than the available budget is allocated its own page, without semantic splitting. Browser/print review should treat the resulting physical overflow as a known nonrecoverable layout warning, not silently clip source content.

## 4. Execution, trust boundary, runtime and resource lifecycle

- One pure pagination computation per relevant input/measurement change, followed by React render and one DOM measurement pass. The router runs on the geometry of the current page only.
- `ResizeObserver` observes the view/page during a mounted component lifetime and disconnects on cleanup. Measurement comparisons ignore <=1px noise to avoid rerender oscillation.
- The browser DOM is a measured capability, not a trusted persistent data source; all source edge/step IDs are derived from the validated `SOPDocument`.
- Manual route overrides remain keyed by semantic edge ID, so repagination may change page-local segment IDs without deleting the stored cross-page route.
- No external IO, retry loop or background worker is added. Pagination is deterministic for a fixed model, page height, and measured row heights.

## 5. Acceptance checks

1. Admin step on Page 1 connected to Student step on Page 2: Page 1 **bottom** OPC-out shares X with Admin header; Page 2 **top** OPC-in shares X with Student header; both have the same label.
2. No `[data-sopflow-opc]` descendant anywhere under `<table>`; visible `tbody tr` count equals actual procedure rows.
3. Forward, loopback, decision branches and duplicate same-actor OPCs still have valid semantic edge IDs, stable labels and route anchors.
4. Overhead of OPC top/bottom and repeated table header changes page capacity. No phantom OPC activity rows are counted.
5. A4 `@media print` keeps external OPC strips with the related table; long text or a physically oversized row must not silently clip content.
6. All package CI checks pass. The separate `apps/playground/opc-source-regression.html` entry and `vite.source-opc.config.ts` deliberately alias **all three local source packages** exclusively for CI acceptance, while normal playground retains published npm `0.1.0` packages. Chrome tests source actor X alignment, SVG routes, outside-table DOM, page capacity, and creates PNG/PDF print evidence. This is automated structural/geometry smoke proof, **not** a golden-image or full multi-printer visual comparison.

## 6. Files changed

- `packages/diagram/src/flowchart/formal/pagination.ts`: correct null/unknown actor ownership in placements.
- `packages/diagram/src/procedurePagination.ts`: external connector-aware page packing.
- `packages/react/src/diagram/procedure/SopProcedurePage.tsx`: outside-table strips, per-page actor centers, routing anchor measurement.
- `packages/react/src/diagram/procedure/SopProcedureView.tsx`: repeated header and row-height measurement.
- `packages/react/src/editor/SopDocumentCanvas.tsx`: reserve physical page space without double-counting table chrome.
- `packages/react/src/diagram/procedure/SopProcedureView.module.css`: actor strips and print break containment.

## 7. Follow-up after code acceptance

A minor Changeset for `@sopflow/diagram` and `@sopflow/react` is included. After merging the Version Packages PR, let CI publish the next npm version, update the normal `apps/playground` dependency pins, and run the default npm-consumer browser regression. Keep the isolated source gate as a separate test. Do not silently link the normal playground back to workspace packages.
