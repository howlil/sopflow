# SOPFlow — one Cloudflare Pages project

Production origin: **https://sopflow.howlil.site**

| Route | Application | Implementation |
| --- | --- | --- |
| `/` | Marketing / landing page | `apps/landing` HTML and CSS |
| `/playground/` | Interactive editor | `apps/playground` React + Vite |
| `/playground/?scenario=issues` | Validation fixture | The same playground app |
| `/playground` | Redirect to `/playground/` | Cloudflare Pages `_redirects` |

The two apps are built into **one static output tree**, published as **one** Cloudflare Pages project. No additional hostname, reverse proxy, Workers, API service, or database is needed for the present client-side demo.

## Build from the pnpm workspace root

The repository uses `pnpm@11.21.0`, Node.js 22, and the root `pnpm-lock.yaml`.

```sh
corepack enable
pnpm install --frozen-lockfile
node scripts/build-site.mjs
```

The builder runs `scripts/build-landing.mjs` and compiles the existing npm-consumer playground with `vite build --base=/playground/`. It then copies the playground production bundle to `apps/landing/dist/playground` and writes the redirect file.

Output:

```text
apps/landing/dist/
├── index.html
├── styles.css
├── brand/logo.svg
├── playground/
│   ├── index.html
│   └── assets/
└── _redirects
```

The composite builder runs `scripts/verify-site.mjs` and fails before publishing if required files, same-origin links, 404 behavior prerequisites, or referenced playground assets are absent. CI additionally tests the artifact using `wrangler pages dev` and Chromium.\n\nThe landing CTA is `/playground/`, a **relative-origin path**. This works on the custom domain, the `*.pages.dev` hostname, and branch preview URLs. There is no environment variable for a second domain.

Standalone `pnpm --filter playground build` is deliberately unchanged (default Vite base `/`) because existing npm-consumer browser regression checks still expect that behavior.

Do not alter the playground `@sopflow/*` npm dependencies to workspace aliases. Published versions and `pnpm-lock.yaml` remain the release boundary.

## Configure Cloudflare Pages

Go to Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to GitHub. Choose repository `howlil/sopflow`.

| Field | Value |
| --- | --- |
| Project name | `sopflow` (if available) |
| Git repository | `howlil/sopflow` |
| Production branch | `master` |
| Root directory | Repository root (`/`) |
| Framework preset | None |
| Build command | `pnpm install --frozen-lockfile && node scripts/build-site.mjs` |
| Build output directory | `apps/landing/dist` |
| `NODE_VERSION` | `22` |
| `PNPM_VERSION` | `11.21.0` |

Cloudflare may install dependencies automatically before invoking the build command; the explicit frozen-lockfile installation is intentional and ensures reproducibility from the monorepo root.

After the Pages project builds, test both routes using its assigned `*.pages.dev` hostname, including the validation fixture. Then configure the custom domain **`sopflow.howlil.site`** in this **same** Pages project's Custom domains settings. The `howlil.site` DNS zone must be present in Cloudflare, and there must not be a conflicting DNS record or custom domain binding.

Cloudflare manages/validates the appropriate DNS record during custom-domain setup. Do not create a second Pages project for `playground`; path routing comes from the output file layout.

## Verification

- `/` serves the landing and all three CTAs link to `/playground/`.
- `/styles.css` and `/brand/logo.svg` return the landing assets.
- `/playground` redirects to `/playground/`.\n- Unknown routes, including `/playground/missing`, return HTTP 404 instead of landing HTML.
- `/playground/` loads without missing CSS, JS, or module chunks.
- `/playground/?scenario=issues` loads the intended validation fixture.
- Browser print / diagrams / Problems navigation still work.
- Existing npm-consumer checks remain green.

Cloudflare Pages follows the filesystem for static path routing; no SPA rewrite is required because the playground uses query-parameter fixtures rather than nested client routes.

## State, release, and CI boundaries

The public landing explicitly warns that edits are not saved across refresh or leaving the playground. The current playground holds edited document and header values in React memory. **Refresh/navigation can discard edits**; this deployment does not add persistent storage.

Updates to `packages/*` do not reach the deployed playground until packages are published to npm and pinned registry versions and lockfile are updated.

Production release gate: preview Pages routes must be checked before merge; after automatic production deployment verify both HTTP routes on the custom hostname, and use the last known-good deployment if the production smoke fails.\n\nA new Pages project must first be connected through the Cloudflare dashboard. This document and GitHub branch **do not imply production deployment has occurred**.

## Troubleshooting

- `ERR_PNPM_*`: confirm root directory is the repository root, Node 22/pnpm 11, and lockfile committed.
- Blank playground / missing assets: use the composite builder, not `pnpm --filter playground build` alone. Inspect generated `playground/index.html` for references starting with `/playground/assets/`.
- 404 on `/playground/`: verify `apps/landing/dist/playground/index.html` exists at deployment.
- Landing leads to wrong URL: rebuild using `scripts/build-site.mjs` and verify the exact link `href="/playground/"`.
