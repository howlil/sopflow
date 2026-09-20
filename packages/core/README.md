# @sopflow/core

Core engine untuk memodelkan, memvalidasi, dan mengubah structured Standard Operating Procedure (SOP) di TypeScript.

Package ini framework-agnostic: tidak bergantung pada React, browser, database, atau provider AI.

## Instalasi

```bash
pnpm add @sopflow/core
```

Package ini adalah ESM dan mendukung Node.js 18 atau yang lebih baru.

## Contoh

```ts
import { applyOperation, parseSop, type SOPDocument } from "@sopflow/core"

const input: SOPDocument = {
  schemaVersion: "1",
  id: "example",
  title: "Example SOP",
  actors: [{ id: "staff", name: "Staff" }],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: ["staff"],
      next: "task",
    },
    {
      id: "task",
      type: "task",
      name: "Do something",
      actorIds: ["staff"],
      next: "end",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["staff"],
    },
  ],
}

const parsed = parseSop(input)

if (!parsed.success) {
  console.error(parsed.errors)
} else {
  const updated = applyOperation(parsed.data, {
    type: "update-step",
    step: {
      id: "task",
      type: "task",
      name: "Updated task",
      actorIds: ["staff"],
      next: "end",
    },
  })

  console.log(updated)
}
```

## API utama

- `parseSop(input)` memvalidasi input runtime dan semantic checks.
- `validateSop(document)` mengembalikan semantic issues.
- `applyOperation(document, operation)` menerapkan satu perubahan immutable.
- `applyOperations(document, operations)` menerapkan beberapa perubahan berurutan.
- `applyValidatedOperations(document, operations)` menerapkan batch lalu menolak hasil semantic invalid.
- `applyOperationInput(document, input)` memvalidasi operation JSON sebelum menerapkannya.
- `parseSopOperation(input)` mengubah unknown input menjadi operation terpercaya.
- `createHistory(document)`, `undo(history)`, dan `redo(history)` menyediakan undo/redo.
- `applyValidatedHistoryOperations(history, operations)` menyediakan batch strict
  yang hanya dicatat jika hasil akhirnya valid.
- Graph helpers membantu membaca reachability, hubungan antar-step, dan presentation order.
- `SopCoreError` menyediakan error code stabil untuk consumer.

## Contract

Core memiliki invariant workflow. `parseSop()` hanya mengembalikan dokumen yang
memiliki satu start, minimal satu end, edge dan actor reference yang valid, ID
unik, seluruh step reachable, dan seluruh non-end step dapat mencapai end.

`steps` adalah collection, bukan execution-order list. Gunakan `getOrderedSteps()`
untuk presentation order di editor atau renderer.

## Pengembangan

Jalankan dari root workspace:

```bash
pnpm install
pnpm check
pnpm pack:core
pnpm --filter playground start
```

`@sopflow/core` adalah package yang dipublikasikan. `playground` hanya aplikasi contoh dan integration consumer.

## Lisensi

MIT
