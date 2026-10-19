<p align="center">
  <img src="./assets/brand/logo.svg" alt="SOPFlow logo" width="420" />
</p>

# Sopflow

Sopflow adalah TypeScript toolkit untuk memodelkan, mengedit, dan memvisualisasikan **Standard Operating Procedure (SOP)**. Repository ini berisi reusable packages dan React playground, bukan backend administrasi atau sistem approval produksi.

## Packages

| Package | Ownership |
| --- | --- |
| `@sopflow/core` | SOPDocument, schema, graph invariants, operations, undo/redo primitives |
| `@sopflow/diagram` | Framework-independent workflow projection, layout, routing, and SVG models |
| `@sopflow/sop-ap` | SOP Administrasi Pemerintahan header/procedure readiness rules |
| `@sopflow/adapter-sop-ta` | Legacy sop-ta procedure format compatibility |
| `@sopflow/react` | React SOP workspace, editor, inspector, flowchart/BPMN surfaces |
| `apps/playground` | Integration consumer and browser diagram regression fixtures |

Dependency flow: `core → diagram/sop-ap/adapter → react → playground`. Core and diagram remain framework-agnostic.

## Development

```bash
pnpm install
pnpm check
pnpm --filter playground start
```

`pnpm check` runs Biome, TypeScript checks, tests, and builds. CI also verifies package tarballs and headless-browser diagram regressions.

### Repair legacy workspace package names

All five publishable packages must be named under the `@sopflow/*` scope.
`howlilabs` is the **npm publisher account**, not a package scope. Old local checkouts
may still reference `@howlil/sopflow-react`, `@howlil/sopflow`, and related aliases,
which causes `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` before installation.

After updating `master`, run:

```bash
node scripts/repair-workspace-names.mjs
pnpm install --no-frozen-lockfile
pnpm check:package-names
```

The repair script modifies **only recognized package names and dependency keys** in
the five package manifests and playground manifest. It refuses unknown aliases and
conflicting dependency ranges; unrelated changes are left intact. If `git pull`
is blocked by uncommitted local edits, back them up first with `git stash -u`
and reapply only the needed work after pulling. `pnpm release:bootstrap` also
runs the repair before its first install.


## Document and integration contract

- `SOPDocument` stores semantic workflow steps and actors. `next`/`yes`/`no` define execution.
- `presentationOrder` controls authored row order, not execution.
- `applyOperations()` supports intermediate drafts. `applyValidatedOperations()` and `parseSop()` both enforce schema and semantic validity.
- `SopWorkspace` accepts controlled `value`, `header`, and optional per-kind `diagramConfigs`. The consuming application owns persistence; manual route overrides are not part of `SOPDocument`.
- `@sopflow/sop-ap` validates government-specific readiness separately from core invariants.
- Playground demonstrates the React workspace and validation states. Core history/JSON operation functions are available through `@sopflow/core`, but are not primary playground UI features.

See [core contract](./docs/CORE_CONTRACT.md), [product contract](./PRODUCT.md), [design contract](./DESIGN.md), and [roadmap](./docs/ROADMAP.md).

## License

MIT
