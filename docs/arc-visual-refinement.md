# SOPFlow visual refinement — Design Thinking / Arc UI migration

**Current implementation:** see [design-graph-uiarc-migration.md](design-graph-uiarc-migration.md) for completed Arc integrations, explicit accessibility exceptions and open release gates. The historical phase plan below describes the original roadmap, not the current TODO list.

Status: **P0 foundation implemented on the `design/uiarc-monochrome-foundation` branch. P1–P4 pending validation.**

## Intent, user flow and invariants

This is an **appearance-only refinement**. The existing single-page workbench is the intended user experience.

```text
Host SOPDocument
  -> controlled SopWorkspace / SopEditor
  -> [unchanged] inline step editor ↔ document preview
  -> [unchanged] Flowchart/BPMN projection
  -> [unchanged] printable A4 landscape
```

No new routes, sidebar, persistent draft storage, wizard, graph behavior, document schema, or export format. Do not rearrange toolbar, canvas, inspector, or formal table. Do not swap visual selection and print semantics.

## Ownership and component policy

Use **real official Arc UI source** for generic user-interface components, installed via the
[Arc registry](https://uiarc.dev/docs/installation). Do **not** manually recreate an Arc
button, select, input, dialog, tooltip, segmented control, or their animations.
A thin SOPFlow adapter is allowed to preserve documented `@sopflow/react` props and
controlled host behavior, but not to reproduce the visual primitive.

Arc free source: https://github.com/kuratlielia/arc-library (MIT; preserve notice).
Registry: `@uiarc` → `https://uiarc.dev/r/{name}.json`.

Use official Arc motion tokens. Marketing-type reveals are inappropriate inside the workbench.
For interactive states prefer Arc `snappy` or `smooth` springs: smooth settling,
without slowing typing, drag/pan, selection, or route recalculation. Honor reduced motion.

**Do not import Arc's global `foundation.css` unscoped in the library.** Arc CSS variables
are global by default; SOPFlow must not override the host app's `:root` tokens. Build a
scoped variable bridge under `[data-sopflow-root]` and ensure portaled dialogs inherit the
scope. Preserve the printed document's fonts, margins, border and pagination separately.

## Current inventory → official Arc component plan

| SOPFlow UI owner | Official Arc component | Scope / risks |
| --- | --- | --- |
| `primitives/Button`, step actions, add/remove buttons | `button` | Preserve compact/default size and disabled props; no fake async success. |
| `primitives/Select`, step types and durations | `select` | Arc uses Radix controlled values, not native `<select>`; adapt `onChange`, `name`, options and form semantics; validate tests. |
| Single-line header/actor fields | `input` | Keep existing labels, errors, controlled text and focus; avoid duplicate inline labels. |
| `AutoResizeTextarea`, notes/output/input fields | `textarea` | Arc textarea does not auto-resize; preserve SOPFlow resize semantics before replacing the underlying textarea. |
| `primitives/Dialog`, DeleteActor/DeleteStep/Decision dialogs | `dialog` | Verify externally controlled open, alertdialog, Escape, focus return, portals and reduced motion. |
| Toolbar icon labels | `tooltip` | Visible on hover AND keyboard focus; no icon-only controls without accessible names. |
| Toolbar mode groups | `segmented-control` only where semantics match | Arc supports no disabled option in current API. Preserve the disabled Flowchart/BPMN behavior in steps mode. |
| More-actions trigger | Arc dropdown-menu, after API verification | Preserve keyboard and deletion semantics. |
| Async host save (future) | `action-button` only if persistence exists | Do not invent a save action or success state. |

No component-library replacement for SOP-specific document table, SOP actor-lane rendering,
graph geometry, route handles, step mutations, or validation logic. Those remain owned by
`@sopflow/react`, `@sopflow/diagram`, or `@sopflow/core` as before.

### Phase graph (Now → Next → Later)

**P0 / Now — Visual baseline (branch changes):**
- Neutral SOPFlow tokens and independent pill radius; legacy aliases preserved.
- Plus Jakarta Sans for playground chrome; fallback remains.
- UI-only toolbar/buttons/inputs selection styling; no changes to flowchart geometry.
- Source: Arc's official MIT foundation easing `(.22,1,.36,1)`, entrance `(.16,1,.3,1)`, and durations 160/240/480ms.
- Print output CSS and document size constants untouched.

**P1 / Next — Real Arc primitives:**
1. Set up the registry and scoped foundation in the React package, not in the domain packages.
2. `pnpm dlx shadcn@latest add @uiarc/arc-foundation @uiarc/button @uiarc/input @uiarc/select @uiarc/dialog @uiarc/textarea`.
3. Copy/install source as supplied, preserve MIT headers, and install its exact dependencies.
4. Run `pnpm install` to update `pnpm-lock.yaml` (commit lockfile).
5. Wrap only where the existing public API differs; migrate low-risk Button first.
6. Validate React 18 compatibility or explicitly plan a versioned React 19 requirement before shipping.

**P2 — Component motion:**
- Install official Arc tooltip and matching toolbar selection component(s).
- Reuse Arc `motionTokens.spring.smooth`/`morph` through Arc implementations.
- Animation boundaries: controls, dialogs, discrete selection indicators only.
- No animation on A4 paper, rows' measured geometry, BPMN/flowchart coordinates, or text input.

**P3 — Surface sweep:**
- Audit all 43 visual specimens in the component inventory: workspace, inspector,
  steps, actor editor, header, validation, empty/error/loading, dialogs, flowchart, BPMN,
  and playground shell.
- Every generic primitive must either use Arc or have a documented compatibility
  exception that is behavioral (e.g. native table cell editor where Arc's labelled
  form Input would break a dense spreadsheet interaction).
- Apply neutral tokens consistently; no new layout structure, no decorative cards.

**P4 — Proof and integration:**
- `pnpm lint && pnpm check:arch && pnpm typecheck && pnpm test && pnpm build`
- E2E: edit start/task/decision/end, actor select, delete/cancel, inspector,
  keyboard tabs, menu focus, Edit↔Preview, Flowchart↔BPMN, manual routing.
- Viewports 360, 768, 1024, 1440: compare screenshots at equal widths and scroll positions;
  changes must be visual skin, not geometry.
- Print/PDF: A4 landscape, actor columns, edge overlays, pagination and repeatable line breaks.
- Motion: `prefers-reduced-motion`, no dragging lag or layout-measurement regression.
- Publish/merge only after gates pass.

## Design Thinking proof model

| Concern | Success condition | Failure model | Smallest proof |
| --- | --- | --- | --- |
| Ownership | SOP document remains canonical | Arc wrapper mutates domain logic | Existing core/react tests |
| UI composition | Same workspace panels | Layout shifts or new tab/route | Visual before/after |
| Controlled components | Events unchanged | Radix select value/disabled mismatch | React Testing Library |
| A11y | Tab order, labels, dialog focus preserved | Portals/focus regress | Keyboard browser E2E |
| Motion | Slow settling, fast direct manipulation | Stutter, blur on inputs, stale overlays | reduced-motion / pointer smoke |
| Print | Official output unchanged | Font metrics affect pagination | Screenshot/PDF regression |
| Packaging | Host integration unbroken | React 18 peer or registry globals break | React 18/19 consumer smoke |

### Decision

Do not declare the 43-component conversion complete while only CSS foundation is
landed. A registry reference or imitation is not equivalent to installing actual Arc
source. Scope and CI status must be reported honestly.
