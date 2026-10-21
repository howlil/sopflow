# SOPFlow npm-consumer playground

The app deliberately loads published `@sopflow/*` packages from npm, not the
workspace React source. Its default fixture is a five-step, valid SOP-AP
document representing an approval and archiving process.

- `/` — **valid SOP**: Staff submits; Manager decides; Admin archives and completes.
  One actor per step; input, output, note, and duration are populated.
- `/?scenario=issues` — **validation scenario**: Same SOP, but the submit-step
  "Kelengkapan" and the header "Dasar hukum" are missing. Use Problems to navigate
  directly to the broken field, verify the error highlight, and fix it.
- `/?unified-regression` — same invalid fixture, plus automated consumer assertions.

Fixtures live in `src/demoFixtures.ts`. These are fictional training examples,
not authoritative legal requirements. Browser acceptance in CI uses the root
`pnpm-lock.yaml` to keep the npm-consumer build reproducible.
