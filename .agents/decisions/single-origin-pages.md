# Single-origin Cloudflare Pages for SOPFlow

Status: accepted

## Context

SOPFlow publishes a marketing landing page and a separate React playground that consumes released npm packages. Both must be reachable at `sopflow.howlil.site` (`/` and `/playground/`). No server-side application state, API, authentication or independent scaling is required.

## Decision

Compose both builds into one static Pages artifact using `scripts/build-site.mjs`. Serve marketing files at the origin root and the Vite playground from `/playground/`. Build that Vite bundle with `--base=/playground/`. Preserve standalone playground build semantics and package-release pinning. Include explicit `404.html`, an optional canonical slash redirect, asset-integrity checks, and Pages HTTP/browser smoke in CI.

## Why

One static deploy satisfies the two public URLs without a runtime proxy or independent infrastructure. It avoids changing package/domain ownership and works with Cloudflare's file-system route semantics.

Alternatives rejected for now: two Pages sites with Worker/proxy dispatch (extra runtime boundary) and merging landing into the React SPA (unnecessary coupling).

## Consequences

Landing and playground deploy together, so a failed composite test blocks both. Released `@sopflow/*` libraries reach the playground only after npm pins/lockfile are updated. The demo does not persist SOP documents. A future requirement for independently deployable sites or server-owned document state merits revisiting this ADR.
