# @sopflow/adapter-sop-ta

Compatibility adapter between legacy `sop-ta` procedure rows and canonical `@sopflow/core` `SOPDocument` workflows.

## Installation

```bash
pnpm add @sopflow/adapter-sop-ta @sopflow/core
```

## API

- `importSopTaDocument(input)` and `tryImportSopTaDocument(input)` — convert legacy `SopTaProcedureRow[]` into a canonical `SOPDocument` with strict diagnostic reporting.
- `validateSopTaCompatibility(document)` — verify whether a `SOPDocument` can be represented losslessly in the legacy `sop-ta` format.
- `exportSopTaDocument(document)` and `exportSopTaPatchItems(document)` — export a compatible `SOPDocument` back to legacy `sop-ta` rows.

## License

MIT
