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
