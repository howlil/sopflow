# @sopflow/sop-ap

SOP Administrasi Pemerintahan (SOP-AP) header metadata, procedure validation, and publication readiness rules for `@sopflow/core`.

## Installation

```bash
pnpm add @sopflow/sop-ap @sopflow/core
```

## API

- `validateSopApHeader(document, header)` — validates institution name, SOP number, title, ISO dates, and required metadata lists.
- `validateSopApProcedure(document)` — validates SOP-AP step requirements (single actor per step, task inputs/outputs/duration, distinct decision targets).
- `getSopApReadinessIssues(document, header)` and `isSopApReady(document, header)` — combined publication readiness check.

## License

MIT
