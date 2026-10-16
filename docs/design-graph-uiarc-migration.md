# SOPFlow UIArc — Design Graph + Design Thinking Implementation

**Goal:** Preserve the existing one-page SOP workbench and exact SOP-AP document semantics while rebuilding the UI's native controls with official Arc UI and its motion. Reference: https://uiarc.dev/docs/installation and https://github.com/kuratlielia/arc-library.

## 1. Design graph (Job → Flow → Surfaces → Interaction → Proof)

```text
Host consumer / playground
  └── SopWorkspace (value, header, diagram configs)
      └── SopEditor: controlled state, select, mode, readOnly
          ├── ValidationPanel: typed diagnostic feedback
          ├── SopDocumentCanvas: A4 and document representations
          │   ├── SopDocumentToolbar: preview/steps + flowchart/BPMN + manual
          │   ├── SopStepsEditor: desktop table / narrow cards
          │   │   ├── SopStepRow / SopStepCard
          │   │   │   ├── StepNameField → AutoResizeTextarea
          │   │   │   ├── StepTypeField → Select
          │   │   │   ├── ActorField → multi actor selection
          │   │   │   ├── Duration/Input/Output/Note → textarea
          │   │   │   └── StepActions → decision/delete dialogs
          │   └── SopDiagram: Formal flowchart, BPMN, viewport + manual route editing
          └── Inspector
              ├── SopHeaderFields: institution, metadata, dates, signatory
              ├── ActorsEditor: CRUD + delete dialog
              └── Validation summaries
```

**Domain boundaries:** `SopOperation` and graph validation belong to `@sopflow/core`; projections/routing belong to `@sopflow/diagram`; formal SOP-AP output belongs to `@sopflow/sop-ap` and React document views. Never import Arc into these domain packages.

## 2. Inventory and migration decision

| Surface / UI | Source | Arc primitive | Boundary & required proof |
|---|---|---|---|
| Core action controls | primitives/Button | Official Button (integrated) | Public function export, default secondary, disable, refs |
| Toolbar Edit/Preview/manual/diagram | editor/SopDocumentToolbar | Arc Button integrated; Tooltip + segmented interaction candidate | ARIA tablist, keyboard arrows, disabled mode, DOM geometry |
| Native single-line text/date | header/SopHeaderFields | Arc Input, compact-labelled integration | Date/time/file constraints, focus, controlled changes |
| Dense free-text | primitives/AutoResizeTextarea | Arc Textarea + SOP auto-resize adapter | One-row minimum, max rows, zero layout shift |
| Native select | primitives/Select, fields/StepTypeField | Arc Radix Select adapter | Native event compatibility, branch-disabled option, keyboard |
| Actor multi-selection | fields/ActorField | Arc MultiSelect | Controlled string[] actor IDs, keyboard and no domain ordering mutation |
| Step action menu | steps/StepActions | Arc DropdownMenu + Lucide | Same actions, short icon trigger, close on select, keyboard |
| Confirmation/decision modal | primitives/Dialog, steps/*Dialog, actors/*Dialog | Arc Dialog | Dialog/alertdialog roles, initial focus, Escape, focus return |
| Inspector grouping | primitives/InspectorSection, header/* | Arc Accordion where semantics are collapsible | Default all-open, no field disappearance, unchanged ordering |
| Validation | validation/ValidationPanel, editor/EditorStatus | Arc Alert for surface + SOP diagnostics | Diagnostics remain actionable, aria-live stable |
| Step table desktop | SopStepsEditor, SopStepRow | SOP domain table; Arc inputs/buttons inside | No columns reordered; printable output unchanged |
| Mobile steps | SopStepCard | SOP domain card; Arc controls inside | Narrow viewport, no double labels |
| SOP header/document | SopHeaderView | Domain-only | Formal legal table, print pagination |
| Procedure table | SopProcedureView/Page | Domain-only | A4 landscape, actor columns and output labels |
| BPMN/flowchart | SopBpmn/SopFlowchart | Domain-only | Geometry, path projection, accessibility |
| Graph viewport/handles | SopDiagramViewport/EditableFormalFlowchartPath | Domain-only | Pan/zoom, route snapping unaffected |
| Playground shell | apps/playground | Arc visual foundation and Plus Jakarta Sans | No changes to editor contract |

The React package contains ~45 production TSX files including Arc Button. Components without interactive UI (geometry helpers, hooks) are retained; adding generic UIArc wrappers around core domain logic would be a regression rather than a rewrite.

## 3. UIArc source-of-truth policy

- Official MIT source is copied under `packages/react/src/components/arc/*`; not a lookalike from memory.
- Motion spring, easing and durations are sourced from official `arc/lib/motion-tokens`. No custom duplicated animation presets.
- SOPFlow adapters are *contracts*, not alternative visual implementations.
- Arc's global `:root` stylesheet must never be imported into public `@sopflow/react`. Scope the foundation to `[data-sopflow-root]`; portaled content must retain scoped variables.
- Preserve backwards-compatible React 18 consumers or explicitly version the breaking peer requirement (registry docs use React 19 as their baseline).
- Controls and buttons full-rounded where appropriate; table cells and A4 document must NOT be pill shaped.
- Brand is monochrome; semantic failure messages may retain accessible contrast/color if necessary.

## 4. States, failure paths and verification gates

| Component | States and errors | Smallest executable proof |
|---|---|---|
| Button | idle/hover/focus/press/disabled/reduced-motion | click + disabled/focus tests |
| Select | unselected/selected/disabled/keyboard/invalid | selection and forbidden decision-collapse test |
| Input/Textarea | empty/focus/error/readonly/auto-resize | controlled input tests, field height regression |
| Dropdown | open/close/focus/escape/delete option | action integration test |
| Dialog | open/close/escape/outside/cancel/confirm/focus return | keyboard trap and delete step tests |
| MultiSelect | none/one/many/actor deleted/readonly | actor ID projection and checkbox parity test |
| Toolbar | preview/steps/flowchart/BPMN/manual | existing ARIA/roving focus tests |
| Print + diagram | A4, actor lanes, connectors and label placement | browser screenshot + PDF comparison |

### Acceptance criteria
`pnpm install --frozen-lockfile && pnpm check`; CI package `pack`; browser diagram regression. Visual compare at 360/768/1024/1440; no added routes or persistent navigation, no overflow beyond existing intentional A4 scroll, no change to printed SOP model. Prefer complete keyboard and reduced-motion verification before merging.

## 5. Implementation status — 2026-10-16

### Applied to real workbench call sites

| Boundary | Source and integration | Verification |
| --- | --- | --- |
| Action and icon buttons | Official Arc Button, SOPFlow function adapter for the public export; all remaining React workbench native action buttons migrated, including inspector, header, actors and validation | Native click/disabled/public API tests, inspector focus refs |
| Input / Textarea | Official Arc Input and Textarea in header, actor name and step fields; compact label/height adapter, existing auto-resize height logic | Controlled field tests and typecheck |
| Select | Official Arc Radix Select in step type, decision branches, and remove/reconnect dialog; native exported `Select` retained only for backwards compatibility | Branch-rule regression tests; Radix keyboard option selection |
| Actor assignment | Official Arc MultiSelect, preserving canonical actor ID order, compact chips and readonly/disabled presentations | Controlled multi-actor and removal tests |
| Step action menu | Official Arc DropdownMenu + Lucide, domain actions selected by step type | End-to-end React integration tests and focus restore |
| Dialog | Official Arc Dialog with SOPFlow role/controlled adapter, Rich ReactNode description and first form-field focus | Escape, focus trap, cancel and delete tests |
| Toolbar and affordances | Official Arc Button + Tooltip and Lucide icons; original button group, roving ARIA tab interaction and disabled diagram tabs preserved | Keyboard tab regression and layout checks |
| Transient errors | Official Arc Alert for editor errors, dismiss and reappearance controlled by error state | EditorStatus regression tests |
| Formal output | Existing SOP document, page renderer, diagram and routing retained | Core tests + browser diagram regression |

### Explicit semantic exceptions

- `Accordion` source is available from Arc but **is not substituted for inspector sections**. Inspector sections are intentionally always visible; adding collapse states would change the approved UX and interrupt data entry.
- `SegmentedControl` source is available but **is not substituted for the diagram tablist**. The official API lacks SOPFlow's disabled-option and roving-focus semantics; official Arc buttons provide the look and motion without replacing the existing accessibility contract.
- `primitives/Select` remains a native, published **backwards-compatibility API**. All internal document selectors use official Arc; removing or silently changing the exported synthetic/native event type would be breaking.
- Native `input[type=file]` is still necessary for browser File APIs. SOP document tables, data, route handles and print markup are domain surfaces, not UI primitives.

### Design Thinking A/E/R implementation proof

`X → Graph → Effect<A,E,R>`: `X` = UI-only modernization, `A` = controlled document edits and previews, `E` = focus transitions / invalid decision branches / unavailable ResizeObserver / reduced-motion / React version mismatch, `R` = Arc source, Motion, Radix, DOM, package version and host contracts.

**Ordering and cardinality:** each UI selection maps to one existing SOPFlow domain handler; source of truth stays in the host's controlled SOP document. UIArc is not permitted to own or persist document state. Dialog focus and return-to-action ordering are covered by tests. Selections cannot bypass the decision branch guard. Resizing and tooltip morphing fail gracefully if `ResizeObserver` is absent.

**Trust and side effects:** UIArc components live in `packages/react` only, under a `data-sopflow-root` scoped foundation; portal content carries the scope. No Arc import enters `core`, `diagram`, or `sop-ap`.

### Verified and remaining release gates

- Latest GitHub CI for the workbench Button sweep succeeded: lint, architecture, typecheck, all React/core tests, production build, package pack and browser diagram regression.
- **Still required before merge:** React 18 *consumer* smoke test against packed `@sopflow/react`, visual before/after across all 43 specimens and responsive widths, keyboard-driven browser acceptance on Obsidian/host environments, and exact A4/print/PDF visual parity. Do not claim these have passed without their evidence.
- PR #54 provides the foundation; stacked draft PR #55 contains the complete compatible component integration. **Do not merge until the remaining gates are satisfied.**
