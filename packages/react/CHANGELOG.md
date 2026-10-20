# @sopflow/react

## 0.3.2

### Patch Changes

- e4bbe8c: Render BPMN swimlanes at full SOP document content width without extra outer borders, while preserving intrinsic standalone diagrams and existing node/route positions.

## 0.3.1

### Patch Changes

- 3d78310: Fix the UIArc dialog overlay so confirmation modals remain visible, standardize compact SOP form controls and Steps actions, replace native date/time inputs with styled calendar and duration selectors, provide stable actor labels, and repair inspector textarea autosizing and keyboard focus behavior with browser regression coverage.

## 0.3.0

### Minor Changes

- 30ab21f: Add the optional unified SOP workspace with a compact top bar, connected Problems panel, issue navigation, responsive inspector, screen-only zoom and print-safe A4 rendering. Existing `SopWorkspace` embeds keep the legacy layout and default behavior.

## 0.2.0

### Minor Changes

- 7932eb0: Render off-page connectors as actor-aligned strips outside SOP procedure tables, independently position source and target actor endpoints, and account for stacked cross-page connectors in A4 height-aware pagination.
- 07c4d5e: Use compact intrinsic BPMN pool geometry with narrow vertical actor headers, tighter whitespace, responsive SVG sizing, and source-level geometry and A4 print browser regressions.
- ab83fea: Expose reusable manual orthogonal route edit preview/commit operations, and make React BPMN/procedure path dragging transactional: render a temporary preview and persist one validated edit on release while cancelling safely.

### Patch Changes

- e9712a9: Render the compact actor multi-select listbox in a viewport-positioned portal instead of inside the horizontally scrollable procedure table. Flip, shift, limit menu height, and track nested scrolling while preserving multi-selection and keyboard dismissal.
- 6592ee1: Unify pill-shaped form controls and icon actions across normal and compact editor modes while preserving rounded menus, dialogs and cards and square SOP document geometry. Add computed-style Chrome regression checks.
- Updated dependencies [7932eb0]
- Updated dependencies [07c4d5e]
- Updated dependencies [ab83fea]
  - @sopflow/diagram@0.2.0
