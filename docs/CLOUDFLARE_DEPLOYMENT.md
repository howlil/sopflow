# SOPFlow Cloudflare Pages deployment

SOPFlow is a pnpm monorepo (packageManager `pnpm@11.21.0`). Deploy **two separate Cloudflare Pages projects** from the same GitHub repository `howlil/sopflow`, production branch `master`.

## Architecture

| Surface | Cloudflare Pages project | Source | Production output |
| --- | --- | --- | --- |
| Marketing site | `sopflow-landing` | `apps/landing` | `apps/landing/dist` |
| npm consumer playground | `sopflow-playground` | `apps/playground` | `apps/playground/dist` |

The landing links to `https://sopflow-playground.pages.dev/` by default. When a custom playground hostname is ready, configure the landing project environment variable `SOPFLOW_PLAYGROUND_URL=https://playground.YOUR_DOMAIN` and redeploy the landing project.

Do not replace published `@sopflow/*` registry dependencies in `apps/playground` with local workspace aliases. The playground is an integration consumer of pinned npm releases.

## Before deploying

From the monorepo root:

```sh
corepack enable
pnpm install --frozen-lockfile
node scripts/build-landing.mjs
pnpm --filter playground build
```

The two artifact directories above must contain `index.html`.

## Create Pages project 1: landing

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Authorize GitHub access to `howlil/sopflow` if not already connected.
3. Project name: `sopflow-landing`. Production branch: **master**.
4. Root directory: **repository root** (leave blank or `/`).
5. Framework preset: **None**.
6. Build command: `node scripts/build-landing.mjs`.
7. Build output directory: `apps/landing/dist`.
8. Build environment: `NODE_VERSION=22`.
9. Optional build-time env: `SOPFLOW_PLAYGROUND_URL=https://sopflow-playground.pages.dev/` (this is the default; replace with a custom hostname after DNS setup).

The landing uses plain HTML/CSS to stay independent from the published packages; its build script copies the canonical brand SVG from `assets/brand/logo.svg`.

## Create Pages project 2: playground

1. Same flow, same `howlil/sopflow` repository.
2. Project name: `sopflow-playground`. Production branch: **master**.
3. Root directory: **repository root** (important: `pnpm-lock.yaml` and `pnpm-workspace.yaml` are here).
4. Framework preset: **None** (explicit commands below).
5. Build command: `pnpm install --frozen-lockfile && pnpm --filter playground build`.
6. Build output directory: `apps/playground/dist`.
7. Build environment variables: `NODE_VERSION=22`, `PNPM_VERSION=11.21.0`.

Cloudflare Pages may automatically run the dependency installation phase before the build command. Explicit `pnpm install --frozen-lockfile` ensures the root lockfile is used even if auto-install behavior differs.

The default playground runs from `/`. Its existing demo scenarios use query params like `/?scenario=issues`, not client-side path routes; no custom redirects are needed for these URLs.

## Domain routing

Initially:
- `sopflow-landing.pages.dev` → landing.
- `sopflow-playground.pages.dev` → editor.

With a custom Cloudflare-managed domain:
- `YOUR_DOMAIN` → landing Pages project.
- `playground.YOUR_DOMAIN` → playground Pages project.

Add the relevant custom domains from each Pages project's **Custom domains** tab, and let Cloudflare configure or validate DNS. Update `SOPFLOW_PLAYGROUND_URL` in the landing Pages project and redeploy it once the playground subdomain resolves.

These domain strings are examples; they do not imply DNS or a domain has been purchased/configured.

## Release and state contracts

- Changes under `packages/*` do **not** change the deployed playground until the updated packages are published to npm, `apps/playground/package.json` pins are updated, and `pnpm-lock.yaml` is updated.
- The playground is not a hosted document management service. Its editor's current React state is in browser memory, so edits can be lost on refresh or navigation. Adding persistence requires a separate product decision; this deployment doesn't imply database/storage is configured.
- Cloudflare Pages creates preview deployments on non-production branches; merge after verification.
- Optional: configure build watch paths so landing and playground do not rebuild on unrelated commits. Include shared root dependency files in playground's watch rules.

## Troubleshooting

- `ERR_PNPM_*` / lockfile mismatch: confirm root directory is repository root, env `PNPM_VERSION=11.21.0`, and the committed lockfile matches `package.json`.
- Build succeeded but Pages returns 404: confirm each project's build output directory path is relative to the configured repository root and contains `index.html`.
- New library change not visible: publish npm packages, bump playground pins and lockfile, then redeploy.
- Landing CTA points to the wrong place: check `SOPFLOW_PLAYGROUND_URL` and rebuild landing (environment variable is build-time, not runtime).
