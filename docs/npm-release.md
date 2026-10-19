# SOPFlow npm publishing (OIDC, no repeated OTP)

## Package identity

- **npm user:** `howlilabs` (interactive setup and 2FA only)
- **npm organization:** `sopflow` (namespace `@sopflow/*`)
- **GitHub repository:** `howlil/sopflow`
- **Authorized workflow file:** `.github/workflows/publish.yml`

Only five public packages are released: `@sopflow/core`, `@sopflow/diagram`,
`@sopflow/sop-ap`, `@sopflow/adapter-sop-ta`, and `@sopflow/react`.
Neither `apps/playground` nor the monorepo root is publishable.

## What happens after the one-time npm bootstrap

```text
Feature PR + Changeset
  -> merge to master
  -> Version Packages PR (automatic, only when changesets exist)
  -> merge version PR
  -> successful CI on master
  -> Publish npm (GitHub-hosted, OIDC)
  -> publish missing package versions in dependency order
  -> GitHub release per published package
```

npm issues temporary credentials to GitHub Actions from OIDC: **no npm token and no
OTP in CI**. The publisher grants the `npm publish` capability specifically to
`howlil/sopflow` / `publish.yml` without granting a reusable bearer token.
Every publish is tied to the current `master` commit and requires successful CI.

`Publish npm` also supports a manual **Run workflow** button on `master`.
Manual runs verify successful CI for the exact commit. Published versions are skipped
so rerunning is safe. The workflow checks the public npm registry first: if some
of the five packages do not exist yet, it ends without trying OIDC publication and
prints the missing names in the GitHub Actions summary. Registry errors other than
404 are considered failures.

**Automation is enabled by default** once the first publication and Trusted
Publisher configuration exist on npm. You do not need to create a GitHub variable
to turn it on. To pause npm publishing, set the repository Actions variable
`SOPFLOW_NPM_PUBLISH_ENABLED=false`. Delete that variable or set it to `true`
to resume.

## One-time bootstrap: npm account identity and OTP

npm requires an initial interactive publication before registering an OIDC trusted
publisher for a new package. 2FA is still mandatory for account administration and
the initial setup; **do not disable 2FA**.

1. Confirm npm user `howlilabs` has publishing rights in organization `sopflow`.
2. On your computer with Node.js 24, pnpm 11.21.0, npm 11.15+:

   ```powershell
   git switch master
   git pull --ff-only
   npm install -g npm@11.21.0
   npm login
   npm whoami
   pnpm release:bootstrap
   ```

   `npm whoami` must output `howlilabs`. Bootstrap will repair known legacy
   workspace names, run the existing tests/builds, produce all five inspected
   tarballs, then publish only versions missing on npm in dependency order.

3. Bootstrap then configures npm Trusted Publishing for all five packages via
   `npm trust github ... --allow-publish`. The **first** trust command requires
   interactive 2FA. In npm's browser prompt select the option to *skip 2FA for
   the next five minutes*; this avoids five successive trust approvals. The tool
   automatically spaces requests to avoid npm rate limits.

4. If first versions are already on npm (e.g. you published each package manually),
   skip the publication step and run `pnpm release:trust` to configure OIDC only.
   This command validates existing configurations rather than replacing them.
   For each package, trust settings must match:
   - GitHub account: `howlil`
   - Repository: `sopflow`
   - Workflow file: **`publish.yml`**
   - Environment: **not set**
   - Allowed action: **npm publish** (not stage-only)

5. Verify the published packages:

   ```powershell
   npm view @sopflow/core version
   npm view @sopflow/diagram version
   npm view @sopflow/sop-ap version
   npm view @sopflow/adapter-sop-ta version
   npm view @sopflow/react version
   ```

## First OIDC publication and validation

npm Trusted Publisher links **expire unless validated by a successful CI publish
within two days**. If all existing versions are already published, OIDC cannot
validate by republishing the same version. Prepare a legitimate changeset, merge
the automatic Version Packages PR, and let CI publish the **next** versions
within the validation window. Package versions are immutable in npm.

```powershell
pnpm changeset
git add .changeset
git commit -m "chore: describe the next package release"
git push
```

Review the generated Version Packages PR; merge it once CI passes. The
following master CI triggers `Publish npm` automatically.

Alternatively, run **Actions → Publish npm → Run workflow** after merging the
version PR to retry OIDC publication on the verified master commit. No local
`npm publish` commands and no OTP prompts are necessary for future releases.

## Common failures

| Symptom | What it means | Fix |
| --- | --- | --- |
| Publish workflow skipped | Publishing explicitly paused by Actions variable | Remove variable or set `SOPFLOW_NPM_PUBLISH_ENABLED=true` |
| First-publish check reports missing packages | Some `@sopflow/*` packages do not yet exist on npm | Use `pnpm release:bootstrap` once as `howlilabs` |
| OIDC 401/404 or token exchange rejected | npm trusted publisher expired, mismatch, or missing direct-publish permission | Reconfigure trust for `howlil/sopflow`, `publish.yml`, allow `npm publish` |
| npm 403 on local bootstrap | npm organization access/2FA approval is missing | Confirm `npm whoami`, org permissions and browser 2FA |
| No new published package | Source versions already exist or version PR not merged | Merge a changeset version PR; npm will never overwrite an existing version |
| CI cannot publish with npm token | Correct behavior: release job rejects `NODE_AUTH_TOKEN` | Remove token-based publisher config; use OIDC |

Once OIDC is validated, in each npm package's Settings → Publishing access,
consider **Require 2FA and disallow tokens**. Trusted Publishing continues to work;
this blocks legacy token-based publishing without making you type OTP in CI.
You should keep 2FA enabled for your npm user.

The CI release uses Node.js 24, npm 11.21.0, GitHub-hosted runners,
`id-token: write`, and automatic provenance. The npm registry, not GitHub,
is the authority for whether a version has actually been published.
