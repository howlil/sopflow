# @sopflow/react

## 0.3.7

### Patch Changes

- 08d06b9: Improve SOP formal flowchart manual route editing without moving or resizing SOP objects. Selected connectors display a blue path and matching arrow, endpoint controls are hollow squares, and waypoint controls are visually distinct. Preserve print-only black document routes and cancel or commit pointer gestures safely.

## 0.3.6

### Patch Changes

- Updated dependencies [2dc8cfe]
  - @sopflow/core@0.2.1
  - @sopflow/diagram@0.2.3

## 0.3.5

### Patch Changes

- 052ebf7: Keep SOP editing actions compact by moving Add Step next to the procedure heading and replacing actor Delete text with an accessible icon. Make validation issues navigate to their exact header, actor, or step field, apply localized error feedback, and clear the active highlight after resolving the issue.

## 0.3.4

### Patch Changes

- cf26972: Consolidate SOP-AP validation into the `@sopflow/core/sop-ap` subpath and remove the standalone SOP-AP runtime dependency from React. Preserve all SOP editing and diagram routing behavior while reducing the npm distribution to three public packages.
- Updated dependencies [cf26972]
  - @sopflow/core@0.2.0
  - @sopflow/diagram@0.2.2

## 0.3.3

### Patch Changes

- af49240: Ensure SOP-AP steps have a single actor in the editor and diagram projection while preserving compatibility with generic workflows and legacy data. Make manual orthogonal route editing collision-safe, prevent unnecessary actor updates, and validate strict SOP-TA imports before deduplication.
- Updated dependencies [af49240]
  - @sopflow/diagram@0.2.1

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
