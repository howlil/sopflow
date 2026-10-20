# BPMN manual path editing — extracted reusable manager

## Research source and implementation decision

Reference: `howlil/sop-ta/client/src/features/sop/diagram/edit/EditableOrthogonalPath.tsx`, `orthogonal-path-edit.util.ts`, and `path-shape-guard.util.ts`.

SOP-TA keeps a *local drag session* with a snapshot of the original route, renders transient preview updates, performs snapping/collision checks and commits a validated path on pointer release. It preserves the last valid path on invalid edits and handles cancel/cleanup. SOPFlow previously persisted `onDiagramConfigChange` on every `pointermove`, re-running the entire BPMN layout during one drag.

Rather than copying React handlers, SOPFlow extracts the pure, source-independent geometry transformation into `@sopflow/diagram` (its existing npm package) while leaving drag-session lifetime and view state in `@sopflow/react`.

## $design-thinking graph (A / E / R)

```text
Pointer down
 → capture pointerId, mode, originPath, originPoint
 → Pointer move
    → previewManualPathDrag(origin + absolute delta, snap endpoint)
    → update *local* React route preview only
    → do not call consumer onChange / re-run BPMN model
 → Pointer up
    → compare preview to origin; skip no-op
    → commitManualPathEdit(preview)
       → validate orthogonality, bounds, obstacles, occupied segments
       → repair using shared formal route algorithms when necessary
       → encode FormalRouteChange with endpoint sides and distances
    → emit exactly one onChange
    → SopBpmn persists route using existing setProcedureManualRoute
 → config survives subsequent re-render
```

**A — Successful:** local dashed geometry follows the pointer; only a finalized path is persisted; double click waypoint insertion, keyboard editing, deletion and manual reset retain existing behavior. The diagram package exports `previewManualPathDrag`, `commitManualPathEdit` and `manualPathPreviewEquals` as reusable operations for other clients.

**E — Failures:** `pointercancel` discards preview without saving; no-op drag does not emit; invalid edit falls back to existing repair or remains unchanged if unrepairable. If the editor unmounts, ephemeral session is dropped. No API/schema migration.

**R — Capabilities:** pure @sopflow/diagram geometry, React local state and SVG pointer capture; no dependency, background tasks or network access. The drag lifecycle is owned by the React component; persistence remains owned by the integrator through `onDiagramConfigChange`.

## Boundaries and regressions

- Session state is never stored in `SopDiagramConfig`. Only committed, validated `FormalRouteChange` crosses the document boundary.
- Grid snapping, arrowhead endpoint semantics, collision and route repair remain in existing @sopflow/diagram helpers.
- Test pure geometry operations and React drag transaction: `pointermove` must leave `onChange` untouched, `pointerup` emits once, and `pointercancel` emits zero times.
- Keep semantic/manual BPMN route fixtures, persisted legacy routes, node selection, Chrome screenshot/PDF and package CI.
- SOP-TA supports richer anchor highlighting, endpoint port hysteresis and throttled rerouting. Those are not duplicated yet because SOPFlow has different SVG renderers, existing snap policy and route planner; adding them requires separate acceptance tests.
