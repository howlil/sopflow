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

## 5. Status tracking

- P0 monochrome foundation, official Arc Button and toolbar are already integrated in PR #54 and CI green.
- PR #55 vendors Input, Textarea, Select, MultiSelect, Dialog, Tooltip, DropdownMenu, SegmentedControl, Accordion and Alert source, plus pinned dependencies and a scoped Arc foundation.
- **Integrated with real SOPFlow call sites:** Arc Input in institution/metadata fields and ActorsEditor; Arc Textarea in dense step fields and header metadata (keeping auto-resize); Arc Select in StepTypeField (with forbidden decision-collapse option disabled). Native date/file field semantics and formal document renderers remain untouched.
- **Visual**: Lucide icons replace raw glyphs for step-action trigger, dialog close, status dismissal and actor chevron.
- **Remaining before declaring complete:** migrate actor MultiSelect, step DropdownMenu, modal Dialog, tooltips, optional inspector accordion and alert presentation; verify printed document equivalence and React 18 consumers.
- **Do not claim unconnected vendored components are integrated.** Implement adapters and migrate call sites, then test each controlled interaction before promotion.
- Both PRs remain draft until visual/print consumer proof and React peer compatibility are complete.
