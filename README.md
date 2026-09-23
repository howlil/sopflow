# Sopflow

Sopflow adalah toolkit TypeScript untuk memodelkan dan mengembangkan structured Standard Operating Procedure (SOP).

## Workspace

```text
packages/core      @sopflow/core — domain, schema, graph, validation, operations, history
packages/diagram   @sopflow/diagram — workflow projection, layout, routing, SVG models
packages/react     @sopflow/react — reusable React editor and diagram presentation
apps/playground    integration consumer/workbench untuk mencoba package Sopflow
```

## Mulai

```bash
pnpm install
pnpm check
pnpm --filter playground start
```

## Package

Package dibagi menurut ownership: [`@sopflow/core`](./packages/core) memiliki domain dan workflow invariant, [`@sopflow/diagram`](./packages/diagram) memiliki projection/layout/routing framework-agnostic, dan [`@sopflow/react`](./packages/react) memiliki presentation serta interaction React. `apps/playground` hanya consumer integrasi.

Playground mencakup route projection, step mutation, decision branches, graph
diagnostics, validation evidence, undo/redo, strict dan draft operation batches,
serta parse/export `SOPDocument` melalui public core API.

## Roadmap

Roadmap pengembangan tersedia di [`docs/ROADMAP.md`](./docs/ROADMAP.md).

## Lisensi

MIT
