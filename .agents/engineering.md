# SOPFlow engineering boundaries

## Contract and owners

This document is the architectural source of truth for code ownership. Public API
compatibility is defined by `packages/*/src/index.ts` and package export maps.

| Capability | Owner | Must not own |
| --- | --- | --- |
| Graph, schema, operations | `@sopflow/core` | DOM, renderers, SOP-AP policy |
| SOP-AP publication profile | `@sopflow/sop-ap` | Mutations, UI |
| Legacy SOP-TA format | `@sopflow/adapter-sop-ta` | Canonical graph policy |
| Workflow projection, route geometry | `@sopflow/diagram` | React or document persistence |
| Controlled editor, DOM measurement | `@sopflow/react` | Domain graph semantics |
| Integration/browser proof | `apps/playground` | Domain ownership |

Within `diagram`:
- `config`: persistent *semantic-edge-keyed* manual routes, migration and equality.
- `procedure/model.ts`: pure document-to-rows projection.
- `procedure/routing.ts`: route selection and measured geometry, not persistence.
- `bpmn/model.ts`: orchestration of BPMN projection; `bpmn/routing.ts`,
  `bpmn/scoring.ts`, and `bpmn/geometry.ts` own distinct algorithms.
- `flowchart/formal`: SOP-AP-specific orthogonal and OPC calculations.
- Historical top-level modules re-export supported entry points; do not add new
  logic to these shims.

Within `react`, the formal procedure renderer lives under
`diagram/procedure`; its deprecated one-page implementation is explicitly
isolated as `LegacySinglePageProcedureView.tsx`.

Adapter import and export depend on shared conversion helpers; export depends
on compatibility validation, never the reverse.

## Change graph

`Host SOPDocument → core graph → diagram projection → renderer → DOM`

`Host persisted configs → config migration → route planner → React output`

The **semantic graph edge** owns route identity. Pagination is ephemeral:
reflow must not remove saved route overrides. Draft edits may be invalid; strict
publication and strict legacy conversion remain separate boundaries.

## Failure and recovery

- Unparseable source: reject at adapter/core boundary, retain caller's data.
- Deleting a semantic edge: prune orphaned routes, not routes local to a page.
- Resize/print: recompute presentation, never mutate workflow data.
- Broken geometry refactor: restore routing parity against existing fixtures.
- Breaking public API: reject PR, restore previous exports and type signatures.

## Verification

```sh
pnpm check:arch
pnpm check
bash scripts/check-browser-diagrams.sh
```

`check:arch` is intentionally implemented with Node built-ins so the guard
does not introduce runtime dependencies. It checks actual source imports,
forbidden ownership edges, and cycles. It is not a substitute for typecheck,
package pack tests, or browser screenshots.

### Historical exception

The BPMN manual-route repair function is still located in the formal
flowchart internals. Its extraction requires geometric parity tests and
is deliberately tracked separately rather than moving code by name alone.
