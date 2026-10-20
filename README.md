<p align="center">
  <img src="./assets/brand/logo.svg" alt="SOPFlow logo" width="420" />
</p>

# Sopflow

Sopflow adalah TypeScript toolkit untuk memodelkan, mengedit, dan memvisualisasikan **Standard Operating Procedure (SOP)**. Repository ini berisi reusable packages dan React playground, bukan backend administrasi atau sistem approval produksi.

## Packages

| Package | Ownership |
| --- | --- |
| `@sopflow/core` | SOPDocument, schema, graph invariants, operations, undo/redo primitives; SOP-AP profile at `@sopflow/core/sop-ap` |
| `@sopflow/diagram` | Framework-independent workflow projection, layout, routing, and SVG models |
| `@sopflow/react` | React SOP workspace, editor, inspector, flowchart/BPMN surfaces |
| `apps/playground` | Integration consumer and browser diagram regression fixtures |

Dependency flow: `core → diagram → react → playground`. The SOP-AP profile lives in the core subpath; the legacy SOP-TA adapter is retained as the private `integrations/sop-ta` workspace. Core and diagram remain framework-agnostic.

## Development

```bash
pnpm install
pnpm check
pnpm --filter playground start
```

`pnpm check` runs Biome, TypeScript checks, tests, and builds. CI also verifies package tarballs and headless-browser diagram regressions.

### Playground runs the published npm release

`apps/playground` now consumes the **published `@sopflow/core`, `@sopflow/diagram`
and `@sopflow/react` packages from the public npm registry**, pinned to explicit registry versions defined in `apps/playground/package.json` through pnpm's `npmjs:` registry source. React transitively installs only its declared runtime dependencies. The SOP-AP validator is included in core's dedicated `./sop-ap` export. The playground no
longer aliases Vite or TypeScript imports to local `packages/*/src`, including
during Vite dev.

```bash
pnpm install --frozen-lockfile
pnpm --filter playground dev
```

The default playground uses `SopUnifiedWorkspace` from the pinned published React release. It provides a unified top bar, responsive
inspector, connected Problems panel, zoom and print-safe A4 document preview.
See [Unified workspace](./docs/UNIFIED_WORKSPACE.md).

Changes made directly in `packages/*` will **not** appear in the playground
until their next npm release and a deliberate update of the pinned playground
versions and lockfile. Library packages continue to use `workspace:*` for
local development. CI checks installed playground package paths and artifacts
to prevent accidental workspace linking.


### Repair legacy workspace package names

All three publishable packages must be named under the `@sopflow/*` scope.
`howlilabs` is the **npm publisher account**, not a package scope. Old local checkouts
may still reference `@sopflow/react`, `@sopflow/core`, and related aliases,
which causes `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` before installation.

After updating `master`, run:

```bash
node scripts/repair-workspace-names.mjs
pnpm install --no-frozen-lockfile
pnpm check:package-names
```

The repair script modifies **only recognized package names and dependency keys** in
the three public package manifests and playground manifest. It refuses unknown aliases and
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
