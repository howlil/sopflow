# @sopflow/diagram

## 0.2.1

### Patch Changes

- af49240: Ensure SOP-AP steps have a single actor in the editor and diagram projection while preserving compatibility with generic workflows and legacy data. Make manual orthogonal route editing collision-safe, prevent unnecessary actor updates, and validate strict SOP-TA imports before deduplication.

## 0.2.0

### Minor Changes

- 7932eb0: Render off-page connectors as actor-aligned strips outside SOP procedure tables, independently position source and target actor endpoints, and account for stacked cross-page connectors in A4 height-aware pagination.
- 07c4d5e: Use compact intrinsic BPMN pool geometry with narrow vertical actor headers, tighter whitespace, responsive SVG sizing, and source-level geometry and A4 print browser regressions.
- ab83fea: Expose reusable manual orthogonal route edit preview/commit operations, and make React BPMN/procedure path dragging transactional: render a temporary preview and persist one validated edit on release while cancelling safely.
