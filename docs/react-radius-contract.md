# SOPFlow React compact UI contract

## Scope

This contract governs interactive editor surfaces only. It does not change the
`@sopflow/core` document, diagram geometry, A4 paper, or printed SOP tables.
Import the React package stylesheet when consuming `@sopflow/react`.

## Shape and density

| Surface | Token / target | Behavior |
| --- | --- | --- |
| Actions and standalone buttons | `--sopflow-radius-action: 9999px` | Capsule action |
| Icon actions | circular | 28–32px icon affordance |
| Dense form input/select trigger | `--sopflow-radius-field: 10px` | 36px control |
| Floating menu container | `--sopflow-radius-popover: 14px` | Bounded by available viewport |
| Individual menu item | `--sopflow-radius-menu-item: 8px` | 32–36px min-height, never vertical pill |
| Modal / dialog surface | `--sopflow-radius-dialog: 16px` | Fit-content with viewport scroll |
| Inline info and warning panel | `--sopflow-radius-inline: 10px` | No giant rounded alert |
| A4 and SOP tables | `--sopflow-radius-document: 0px` | Keep formal document layout |

A compact menu must never force its popup width to a narrow table column when
the option labels are longer. Constrain popup width to viewport; keep disabled
option text legible, allowing limited wrapping only when a reasonable minimum
width cannot be accommodated. The trigger retains its actual column width.

## Token ownership

- `uiarc-scoped.css` initializes the upstream Arc variables under `[data-sopflow-root]`.
- `token.css` is the **final SOPFlow bridge/override**, including portal roots.
- Domain components consume the semantic SOPFlow tokens; do not override portal
  positioning, z-index, or menu geometry with ad hoc per-dialog selectors.
- The public `primitives/Select` native select remains a compatibility export.
  Internal step/decision fields use the Arc Select adapter.

## Surface<C, V, N> interface graph

```text
Steps table/card
  ├─ Type/Duration Select
  │    ├─ Closed → Open → Selected → Closed
  │    └─ Disabled option → cannot commit
  ├─ Decision Editor Dialog
  │    ├─ Edit targets → Save valid decision
  │    └─ Cancel/Escape → return to invoker
  └─ Delete Step Dialog
       ├─ Replacement required → select valid successor
       └─ Cancel/Escape → return to invoker
Inspector
  ├─ Actor row → change label
  └─ Delete Actor Dialog → show references → confirm/cancel
```

C: form values and actions; V: idle/open/selected/disabled/error;
N: a valid step/actor/document and target candidates, where relevant.

## Proof

Run `pnpm check`, source-browser regression scripts, and a consumer playground
smoke run with published package. Check 360/768/1024/1440px viewport and narrow
embedded containers; test keyboard, pointer, reduced motion, portal clipping,
dialog focus, and SOP print output. Never conflate a source test with the pinned
published `@sopflow/react` package.
