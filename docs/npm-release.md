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

There are two supported publishing credential paths:
- **Temporary bootstrap:** GitHub Actions uses the repository secret `NPM_KEY` as
  a granular npm token. The token must have **Packages and scopes → Read and write
  (publish and stage)** covering `@sopflow`, not merely organization Read/Write,
  and **Bypass 2FA** selected when the token was created. It must belong to
  npm user `howlilabs`. No OTP is required on the runner. This path can create
  the three as-yet-unpublished packages and publish further versions.
- **Long-term:** npm Trusted Publishing issues temporary credentials to GitHub
  Actions using OIDC. No `NPM_KEY`, OTP, or bearer-token rotation is required. The publisher grants the `npm publish` capability specifically to
`howlil/sopflow` / `publish.yml` without granting a reusable bearer token.
Every publish is tied to the current `master` commit and requires successful CI.

`Publish npm` also supports a manual **Run workflow** button on `master`.
Manual runs verify successful CI for the exact commit. Published versions are skipped
so rerunning is safe. The workflow checks the public npm registry first. If some packages do not exist
and no publish-capable `NPM_KEY` is configured, it **fails clearly** with an
actionable error instead of silently skipping publication. If `NPM_KEY` exists,
it validates the npm account and attempts to publish all five versions missing
from the registry. Package-by-package versions are immutable and are never
overwritten. Registry errors other than 404 are considered failures.

**Automation is enabled by default** when either a valid npm publish token
or a working Trusted Publisher is configured. You do not need to create a GitHub variable
to turn it on. To pause npm publishing, set the repository Actions variable
`SOPFLOW_NPM_PUBLISH_ENABLED=false`. Delete that variable or set it to `true`
to resume.

## Use the existing `NPM_KEY` GitHub Actions secret now

You already created a granular token on npm as `howlilabs` and placed it in
**Settings → Secrets and variables → Actions → Repository secrets → NPM_KEY**.
Do not commit this secret to the repo, put it into `.npmrc`, or paste it into
GitHub issues/chat/logs.

Check the token's **npm website** settings. It needs:
- **Packages and scopes:** `Read and write (publish and stage)`, covering the
  `@sopflow` scope or **all packages**, NOT only `Organizations: Read and write`.
- **Bypass 2FA:** enabled at creation time. If off, generate a replacement token
  with this checked. GitHub Actions cannot answer a 2FA challenge.
- A token expiry date in the future, and npm user `howlilabs` must have publish
  permission for the `sopflow` organization.
- For a package configured to disallow tokens, the workflow cannot bypass this;
  use OIDC Trusted Publishing for that package.

On `master`, go to
**GitHub → Actions → Publish npm → Run workflow**. This verifies that the
current commit passed CI. The workflow automatically chooses token mode if
`NPM_KEY` exists and is not empty, builds and verifies tarballs, and publishes
versions that are not already on npm. It records each published package and
creates GitHub releases. **No OTP prompt in GitHub Actions.**

To force the mode temporarily, use repository Actions variable
`SOPFLOW_NPM_AUTH=token`; this fails if the secret does not exist.
Avoid broad org-wide tokens for long-lived release automation; scope to
`@sopflow`, use short expiration and rotate/revoke after migration.

**Important 2026 npm policy:** bypass-2FA granular tokens with direct publish
permissions are scheduled to lose direct publishing in **January 2027**.
This route solves initial publication but is not the durable solution.

After the five packages exist, configure Trusted Publisher for each package:
`howlil/sopflow`, workflow `publish.yml`, direct `npm publish` permission.
Publish a genuinely **new version** via the CI workflow within two days of
creating trust so npm validates the identity binding. Then set
`SOPFLOW_NPM_AUTH=oidc` in repository Actions variables; OIDC is selected even
if you have not yet deleted `NPM_KEY`. Once OIDC succeeds, delete and revoke
the `NPM_KEY` secret/token.

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
| First-publish reports missing packages | Missing package requires `NPM_KEY` or interactive bootstrap | Use the token-mode release, or `pnpm release:bootstrap` |
| OIDC 401/404 or token exchange rejected | npm trusted publisher expired, mismatch, or missing direct-publish permission | Reconfigure trust for `howlil/sopflow`, `publish.yml`, allow `npm publish` |
| npm 403 on local bootstrap | npm organization access/2FA approval is missing | Confirm `npm whoami`, org permissions and browser 2FA |
| No new published package | Source versions already exist or version PR not merged | Merge a changeset version PR; npm will never overwrite an existing version |
| Token fails with EOTP/E403 | Missing Bypass 2FA, wrong package permissions, expired token, or disallow-tokens policy | Replace/repair granular token permissions, or switch to OIDC |

Once OIDC is validated, in each npm package's Settings → Publishing access,
consider **Require 2FA and disallow tokens**. Trusted Publishing continues to work;
this blocks legacy token-based publishing without making you type OTP in CI.
You should keep 2FA enabled for your npm user.

The CI release uses Node.js 24, npm 11.21.0, GitHub-hosted runners,
`id-token: write`, and automatic provenance. The npm registry, not GitHub,
is the authority for whether a version has actually been published.
