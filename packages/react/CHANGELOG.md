# @sopflow/react

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
