# SOPFlow npm Release Runbook

## Target packages

- `@sopflow/core`
- `@sopflow/diagram`
- `@sopflow/sop-ap`
- `@sopflow/adapter-sop-ta`
- `@sopflow/react`

The workspace root and `apps/playground` are private and must never be published.

## Automatic release flow

1. Open a feature PR with a changeset for every public API/package change: `pnpm changeset`.
2. CI checks lint, boundaries, types, tests, browser diagrams, and all five npm tarballs.
3. After a feature PR merges to `master`, `Version Packages` creates or updates a version PR. Review version bumps, changelogs and lockfile updates.
4. Merge the version PR and wait for a successful `CI` workflow for the exact `master` commit.
5. If the repository Actions variable `SOPFLOW_NPM_PUBLISH_ENABLED` is `true`, the `Publish npm` workflow publishes missing versions, in dependency order. A separate job creates per-package GitHub releases and tags.

All workflows are idempotent by package name and version. The initial publication is manual.

## Bootstrap: first publication to npm (one time)

The npm user is **`howlilabs`**, and the npm organization/scope is **`@sopflow`**.
These are not interchangeable: package names remain `@sopflow/core`, etc.

1. Verify **howlilabs** owns or can publish under the npm organization **sopflow**, enable 2FA and install Node.js 24 with npm 11+, pnpm 11.21.0.
2. Merge the release-fix PR and sync the latest `master`:

   ```bash
   git checkout master
   git pull --ff-only
   npm login
   npm whoami           # must print: howlilabs
   pnpm release:bootstrap
   ```

   The bootstrap command installs dependencies, runs all checks, builds and validates all five npm tarballs, and publishes any **missing** package versions in dependency order. It will prompt for npm two-factor authentication if required. This is an interactive local operation, **not an Actions job**, because npm requires an initial package publication before Trusted Publishing can be enabled. No `NPM_TOKEN` is required or should be shared.

3. Verify publication:

   ```bash
   npm view @sopflow/core@0.1.0 version
   npm view @sopflow/diagram@0.1.0 version
   npm view @sopflow/sop-ap@0.1.0 version
   npm view @sopflow/adapter-sop-ta@0.1.0 version
   npm view @sopflow/react@0.1.0 version
   ```

   If an exact version was published previously, bootstrap skips it instead of overwriting. npm package versions cannot be republished.

4. Open each package on npmjs.com and set **GitHub Actions Trusted Publisher**:
   - GitHub user/organization: `howlil` (NOT `howlilabs` or `sopflow`)
   - Repository: `sopflow`
   - Workflow file: `publish.yml`
   - Environment: leave blank
   - Allowed actions: enable **npm publish** (not stage-only)

   Repeat for all five packages. Complete the first trusted publication within npm's trust-validation window.

5. In GitHub repository Settings → Actions → General, enable permission to create pull requests from Actions; without that, the version PR cannot be opened. A PR made using the default `GITHUB_TOKEN` may not trigger PR CI automatically; either manually trigger checks with a human commit or use an authorized GitHub App token.

6. Only once every package is published and all five trusted publishers are configured, set the GitHub Actions **variable** `SOPFLOW_NPM_PUBLISH_ENABLED=true`. Never add a persistent `NPM_TOKEN` for regular releases.

7. For future changes, create `pnpm changeset` files in feature PRs and merge to `master`. Version Packages skips clean/no-changeset pushes rather than failing. Merge the generated version PR after review; successful CI then enables OIDC publication.

## Recovery & security

- To stop automatic publication immediately, set `SOPFLOW_NPM_PUBLISH_ENABLED=false`.
- The publishing job runs only after `CI` succeeds for a push to the current `master` head, never for forks/PRs or stale SHA results.
- The release job grants `id-token: write` but only `contents: read`. GitHub release creation is in a separate job with `contents: write` but no OIDC.
- If publication partially succeeded, rerun the workflow: already published exact versions are skipped.
- Non-404 npm registry failures stop publishing, instead of treating transient errors as absent versions.
- If npm succeeded but GitHub Release creation failed, create the missing release manually with `gh release create` after confirming that package version exists.
- Node 24 and npm 11.21.0 are pinned for OIDC. Public package provenance is automatically generated under npm Trusted Publishing.

The changeset CLI is pinned to version 3.0.3 via the root npm-exec script to avoid unrelated workspace lockfile dependency changes.
