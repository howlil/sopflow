# SOPFlow agent routing

Read [engineering boundaries](.agents/engineering.md) before changing ownership.
Follow contract → shapes → happy path → failures → boundary → verification.
Preserve package public APIs and ensure `pnpm check` passes before integration.

## UI refinement mandate

For any generic user-interface primitive or interaction motion, search the
[Arc UI registry](https://uiarc.dev/docs/installation) and install the official
component and motion source **before** writing a new one. Never imitate Arc by
recreating its internals from memory. Keep a thin domain adapter only if necessary
for backwards-compatible SOPFlow props and controlled events.

Follow the [Arc refinement contract](docs/arc-visual-refinement.md). Preserve the
single-page workbench layout, A4 print contract and semantic graph. Scope Arc's
style variables; never import its unscoped foundation CSS into consumers.
