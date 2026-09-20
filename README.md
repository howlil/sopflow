# Sopflow

Sopflow adalah toolkit TypeScript untuk memodelkan dan mengembangkan structured Standard Operating Procedure (SOP).

## Workspace

```text
packages/core      @sopflow/core — domain, schema, graph, validation, operations, history
apps/playground    consumer workbench untuk mencoba seluruh feature package core
```

## Mulai

```bash
pnpm install
pnpm check
pnpm --filter playground start
```

## Package

Package utama adalah [`@sopflow/core`](./packages/core). Core engine tidak bergantung pada React, database, browser, atau provider AI. Dokumentasi API package tersedia di [`packages/core/README.md`](./packages/core/README.md).

Playground mencakup route projection, step mutation, decision branches, graph
diagnostics, validation evidence, undo/redo, strict dan draft operation batches,
serta parse/export `SOPDocument` melalui public core API.

## Roadmap

Roadmap pengembangan tersedia di [`docs/ROADMAP.md`](./docs/ROADMAP.md).

## Lisensi

MIT
