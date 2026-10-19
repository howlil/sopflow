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

## Bootstrap: one-time prerequisites

1. Create the **npm** organization `sopflow`, separate from the GitHub repository; verify your npm account has publishing rights to all five names and enable 2FA.
2. From a clean checkout of `master`, build and verify (do not publish automatically):

   ```bash
   pnpm install --frozen-lockfile
   pnpm check
   mkdir -p /tmp/sopflow-packs
   pnpm --filter @sopflow/core pack --pack-destination /tmp/sopflow-packs
   pnpm --filter @sopflow/diagram pack --pack-destination /tmp/sopflow-packs
   pnpm --filter @sopflow/sop-ap pack --pack-destination /tmp/sopflow-packs
   pnpm --filter @sopflow/adapter-sop-ta pack --pack-destination /tmp/sopflow-packs
   pnpm --filter @sopflow/react pack --pack-destination /tmp/sopflow-packs
   node scripts/npm-release.mjs verify
   ```

3. Use `npm login` and publish each first version (currently 0.1.0) **from the inspected tarballs** with `npm publish /tmp/sopflow-packs/<filename>.tgz --access public` in this order: core, diagram, sop-ap, adapter-sop-ta, react. A package must already exist before it can have an OIDC trusted publisher.
4. On npmjs.com, open each package's settings, add **GitHub Actions Trusted Publisher** with owner `howlil`, repo `sopflow`, workflow filename `publish.yml`, and no environment. Choose **Allow npm publish**, not stage-only. Repeat for all five packages.
5. On GitHub, allow Actions to create PRs under Settings → Actions → General. Note: PRs created by the default `GITHUB_TOKEN` may not trigger PR CI checks automatically. If checks are required, use a GitHub App token for the version action or explicitly re-trigger checks with an authorized human commit.
6. When npm bootstrap and trusted publishers have been verified, set the GitHub repository Actions **variable** `SOPFLOW_NPM_PUBLISH_ENABLED=true`. Until then it must be absent or `false`. Do **not** create an `NPM_TOKEN` secret.
7. Merge a future Version Packages PR to test automated publishing. Check installed packages, npm provenance, and GitHub releases.

## Recovery & security

- To stop automatic publication immediately, set `SOPFLOW_NPM_PUBLISH_ENABLED=false`.
- The publishing job runs only after `CI` succeeds for a push to the current `master` head, never for forks/PRs or stale SHA results.
- The release job grants `id-token: write` but only `contents: read`. GitHub release creation is in a separate job with `contents: write` but no OIDC.
- If publication partially succeeded, rerun the workflow: already published exact versions are skipped.
- Non-404 npm registry failures stop publishing, instead of treating transient errors as absent versions.
- If npm succeeded but GitHub Release creation failed, create the missing release manually with `gh release create` after confirming that package version exists.
- Node 24 and npm 11.21.0 are pinned for OIDC. Public package provenance is automatically generated under npm Trusted Publishing.

The changeset CLI is pinned to version 3.0.3 via the root npm-exec script to avoid unrelated workspace lockfile dependency changes.
