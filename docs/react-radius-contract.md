# SOPFlow React corner-radius contract

## Implementation graph (Design Thinking A/E/R)

```text
SOPFlow scoped tokens
  -> --sopflow-radius-control = 9999px  -> --radius-control (Arc)
  -> --sopflow-radius-surface = 16px    -> --radius-surface (Arc)
  -> --sopflow-radius-popover = 14px    -> --radius-panel (Arc)
  -> --sopflow-radius-inline = 10px     -> metadata/inline notices
  -> --sopflow-radius-document = 0px   -> printed SOP tables
  -> CSS Modules (including Radix portals with data-sopflow-root)
  -> computed border-radius in Chromium
```

**A — Successful result:** identical interactive controls have the same pill shape in compact/normal states. Density changes padding, font size or height, not geometric identity. Round icon controls remain round. Menus and dialogs use compact, flat rounded surfaces; data cards and status panels use the same surface radius. Printed procedure tables, grid lines and flowchart shapes are **not affected** by UI tokens.

**E — Expected failures:** A CSS module overrides its semantic token, a Radix portal renders outside the scoped root, or a host application's styles override SOPFlow styles. The Chrome source gate fails with the offending component's computed value. Styles remain scoped to `[data-sopflow-root]`.

**R — Runtime capability:** CSS custom properties, CSS Modules, DOM `getComputedStyle`, and isolated Chromium smoke test. No backend, persistence, network request or user-facing schema changes.

## Design Graph (C/V/N)

| Surface | C: content | V: variants | N: needs |
| --- | --- | --- | --- |
| Inputs, selects, compact textarea, buttons | Interactive label/value | Focus, disabled, compact, invalid | 9999px pill tokens and keyboard focus indicator |
| Small icon actions | Single action | Normal/pressed/disabled | Full circular shape |
| Menu, tooltip | Floating choices/details | Open/closed | 14px popover token, own portal root |
| Dialog, card, status or validation panel | Grouped information | Loading/error/normal | 16px surface token |
| Decision metadata | Inline information and errors | Info/error | 10px inline token |
| SOP procedure, A4 print | Formal document geometry | Preview/print | No rounded document cells |

**Scope limitation:** Multi-line text areas use surface rounding when not in compact single-line editing mode, since a giant pill on a tall textarea distorts its silhouette. Deliberately square checkboxes and printed SOP shapes retain their original geometry.

## Verification

The existing `scripts/check-source-opc-browser.sh` now also loads the isolated `apps/playground/radius-source-regression.html` entry. The test uses the actual CSS Modules on source, asserts computed radii on controls, compact fields, portal surfaces, metadata and SOP table, then fails CI if a control regresses. The normal playground still consumes the published `@sopflow/react` npm version, rather than linking the development workspace.

The added Changeset releases these styles as a patch version after the Version Packages PR is merged.
