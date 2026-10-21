# @sopflow/core

## 0.2.1

### Patch Changes

- 2dc8cfe: Harden SOP-AP readiness diagnostics for malformed documents, detect every cycle member using iterative SCCs, avoid recursive graph-ordering stack overflows, and preserve undo/redo history across semantic no-op edits.

## 0.2.0

### Minor Changes

- cf26972: Consolidate SOP-AP validation into the `@sopflow/core/sop-ap` subpath and remove the standalone SOP-AP runtime dependency from React. Preserve all SOP editing and diagram routing behavior while reducing the npm distribution to three public packages.
