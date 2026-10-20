# SOP-AP single-actor and manual routing — implementation contract

## Scope and source

Implementation branch: `fix/sop-ap-single-actor-manual-routing-20261021`.
SOP-TA source: `client/src/pages/penyusun/sop/hooks/use-prosedur-editor.ts`,
`client/src/features/sop/diagram/edit/EditableOrthogonalPath.tsx`, and
`client/src/pages/penyusun/sop/hooks/use-penyusun-diagram-config.ts`.
SOPFlow core remains backwards-compatible for non-SOP-AP consumers.

## Invariants

1. A valid SOP-AP step refers to **exactly one** known actor. Step ID, not its
   activity label or visual position, establishes identity. Multiple different
   steps may share the same label and/or actor.
2. A single step projects to one procedure row and one BPMN node. Its lane is
   the exact single assigned actor. Missing, unknown, or multiple actor IDs
   must not be silently resolved by selecting the first one.
3. Semantic edge identity is independent of row order and node coordinates.
   Flowchart and BPMN route overrides remain separately persisted, keyed by
   canonical workflow edge IDs. Repositioning does not alter topology.
4. A manual path preview is ephemeral. Only a fully validated/repairable
   orthogonal path is emitted, exactly once on a completed drag. Cancellation
   emits nothing. Consumer applications own persistence, revision and autosave.

## $design-thinking graph: Shapes / A / E / R

```text
SOPDocument(actorIds: ActorId[], steps: Step[], presentationOrder?)
  -> validate SOP-AP cardinality (exactly one actor per step)
  -> single-actor editor assignment: [selectedActorId]
  -> projectWorkflow(document) -> WorkflowGraph(nodes, semantic edges)
  -> buildProcedureModel / buildBpmnModel
       valid actor       -> matching actor lane
       invalid cardinality -> fallback lane + diagnostic
  -> create automatic routes
  -> apply semantic-edge manual overrides when geometrically valid
  -> interact with route:
       pointerdown -> snapshot(origin, pointer)
       pointermove -> threshold -> immutable local preview
       endpoint drag -> preferred-side hysteresis and active anchor indicator
       pointerup -> commitManualPathEdit
                  -> validate -> repair with all constraints -> validate
                  -> onChange if valid and non-no-op
       pointercancel -> drop preview (no external mutation)
  -> controlled onDiagramConfigsChange
  -> consumer persistence
```

A (success): actor replacement and route edit preserve step IDs, edges,
and independent route configurations.

E (expected failures): `INVALID_ACTOR_COUNT`, `UNKNOWN_ACTOR_REFERENCE`,
`MULTIPLE_ACTOR_ASSIGNMENT`, invalid geometry, occupied-edge crossing, failed
repair, and consumer persistence failure. UI shows legacy conflicts rather than
coercing them. The diagram uses an unassigned fallback. A failed manual route
edit emits no change. Application-specific network/revision failures remain
with the consumer, not the library.

R (capabilities): `@sopflow/core` provides model and mutations;
`@sopflow/core/sop-ap` validates SOP-AP readiness;
`@sopflow/diagram` owns geometry and semantic overrides;
`@sopflow/react` owns pointer lifetimes, visual feedback and callback;
the consuming application owns persistent storage and concurrency.

Execution policy: no network access or background synchronization in the
component library. Pointer previews are local; subsequent updates may be
coalesced into an animation frame. Commit is guarded against no-op and
cancellation. RequestAnimationFrame tasks are disposed on cancel/unmount.

## $design-graph: Surface<C,V,N> and moves

- Step actor field: content actor names and one selection. Variants:
  empty, valid-single, legacy-multi-conflict, disabled, read-only, unknown.
  Needs actor list and edit permission. A selection replaces the full
  `actorIds` array; it never appends to it. Existing conflicting data are
  preserved until the user makes a new selection.
- Procedure / BPMN: content one activity or node per StepId, single actor
  location, edges from workflow graph. Variants valid and fallback diagnostic.
  Needs document, graph and geometry.
- Manual route: content chosen route, draggable endpoints, waypoints, segment,
  and the active anchor edge. Variants idle/selected/preview/committed/invalid.
  Needs manual-edit mode, writable config callback and geometry.
  Moves: select -> pointer down -> local preview -> pointer up (commit),
  or pointercancel (revert), or reset.
- Viewport and print: preserve semantic identity at different sizes; do not
  persist route-specific DOM position as workflow identity.

## Milestone implementation and review boundaries

**M1** React actor field:
`MultiSelect` adds opt-in `selectionMode="single"`, preserving its existing
multi-select default for unrelated consumers. `ActorField` uses the exclusive
mode; `useStepEditorController` refuses multi-actor writes. SOP-AP validation
remains owned by `@sopflow/sop-ap`. Review: no silent legacy normalization.

**M2** Diagram projection:
`procedure/model.ts`, `bpmn/layout.ts`, and `bpmn/model.ts` only assign an
actor lane for exactly one known actor. Ambiguous assignments use the fallback
lane; BPMN emits `MULTIPLE_ACTOR_ASSIGNMENT`. Review: step/node/edge identity
and normal-route fixtures remain unchanged.

**M3** Route correctness:
`commitManualPathEdit` passes occupied segments to repair and revalidates its
output against all original constraints before emitting. Review: no invalid
repair result can cross the persistence boundary.

**M4** Pointer interaction:
Threshold prevents jitter edits; the latest snapped side is preferred during
subsequent moves; the active anchor side is highlighted; first preview is
immediate and later previews can be frame-coalesced. Cancel/unmount cleans up
the local interaction. Review: one commit on release, zero on cancel.

**M5** SOP-TA adapter and route regression:
Strict SOP-TA import reports `INVALID_ACTOR_COUNT` for legacy multi-actor
rows. Legacy `importSopTaDocument` stays lossless to preserve existing callers.
Export remains strictly validated. Semantic route configs are preserved through
step reorder and actor reassignment; stale edges can still be pruned. Review:
no silent ID discard, no schema migration or fabricated persistence layer.

## Verification targets

- Unit: select Staff -> Manager writes `["manager"]`.
- Unit: legacy `["staff","manager"]` remains until explicitly resolved.
- Unit: BPMN ambiguous actor gets one node on fallback lane and diagnostic.
- Unit: valid actor reassignment changes only lane, never semantic edge IDs.
- Unit: invalid overlapping manual edit does not commit.
- Interaction: below-threshold drag does not emit; pointercancel discards.
- Integration: strict import rejects multi-actor; legacy path preserves them.
- Config: flowchart/BPMN persisted routes stay independent and keyed by StepId.
- Run repository `pnpm check` and playwright/source regressions in CI when
  available; code review is not a substitute for execution evidence.

No packages are published, branches merged, or SOP-TA API/DB records mutated
by this work.
