# SOPFlow — one Cloudflare Pages project

Production origin: **https://sopflow.howlil.site**

Cloudflare Pages project: **`sopflow`**, provisioned under the connected account. The Pages-provided deployment hostname is **https://sopflow.pages.dev**. Domain activation is verified separately after a successful build and deployment.

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
├── design-tokens.css
├── brand/logo.svg
├── playground/
│   ├── index.html
│   └── assets/
└── _redirects
```

The composite builder runs `scripts/verify-site.mjs` and fails before publishing if required files, same-origin links, 404 behavior prerequisites, or referenced playground assets are absent. CI additionally tests the artifact using `wrangler pages dev` and Chromium.

The landing consumes **the exact canonical** `packages/react/src/styles/token.css` values copied into `/design-tokens.css`. Its body is scoped with `data-sopflow-root`; no unscoped Arc foundation CSS or React runtime is loaded in the static page. This keeps landing backgrounds, typography, borders, and CTA states aligned with the primary SOPFlow workbench. The existing blue logo is retained as a brand asset, separate from semantic interface colors.

The landing CTA is `/playground/`, a **relative-origin path**. This works on the custom domain, the `*.pages.dev` hostname, and branch preview URLs. There is no environment variable for a second domain.

Standalone `pnpm --filter playground build` is deliberately unchanged (default Vite base `/`) because existing npm-consumer browser regression checks still expect that behavior.

Do not alter the playground `@sopflow/*` npm dependencies to workspace aliases. Published versions and `pnpm-lock.yaml` remain the release boundary.

## Cloudflare Pages configuration (provisioned)

The Git-integrated Pages project `sopflow` has been provisioned and is connected to `howlil/sopflow`. To inspect or recreate it, use Cloudflare Dashboard → Workers & Pages → `sopflow`.

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

The Cloudflare Pages custom domain **`sopflow.howlil.site`** has been registered and validated under the active `howlil.site` zone. The proxied Cloudflare DNS record is `CNAME sopflow.howlil.site → sopflow.pages.dev`. Test both routes on Pages and the custom hostname after production deployment.

Do not create a second Pages project for `playground`; path routing comes from the output file layout.

## Verification

- `/` serves the landing and all three CTAs link to `/playground/`.
- `/styles.css`, `/design-tokens.css`, and `/brand/logo.svg` return the landing assets and canonical tokens match the React source.
- `/playground` redirects to `/playground/`.
- Unknown routes, including `/playground/missing`, return HTTP 404 instead of landing HTML.
- `/playground/` loads without missing CSS, JS, or module chunks.
- `/playground/?scenario=issues` loads the intended validation fixture.
- Browser print / diagrams / Problems navigation still work.
- Existing npm-consumer checks remain green.

Cloudflare Pages follows the filesystem for static path routing; no SPA rewrite is required because the playground uses query-parameter fixtures rather than nested client routes.

## State, release, and CI boundaries

The public landing explicitly warns that edits are not saved across refresh or leaving the playground. The current playground holds edited document and header values in React memory. **Refresh/navigation can discard edits**; this deployment does not add persistent storage.

Updates to `packages/*` do not reach the deployed playground until packages are published to npm and pinned registry versions and lockfile are updated.

Production release gate: preview Pages routes must be checked before merge; after automatic production deployment verify both HTTP routes on the custom hostname, and use the last known-good deployment if the production smoke fails.

The Git-connected Pages project is configured with production branch `master` and automatic deployments enabled. Confirm each production deployment's success and its deployed Git commit via Cloudflare before treating the website as up to date.

## Troubleshooting

- `ERR_PNPM_*`: confirm root directory is the repository root, Node 22/pnpm 11, and lockfile committed.
- Blank playground / missing assets: use the composite builder, not `pnpm --filter playground build` alone. Inspect generated `playground/index.html` for references starting with `/playground/assets/`.
- 404 on `/playground/`: verify `apps/landing/dist/playground/index.html` exists at deployment.
- Landing leads to wrong URL: rebuild using `scripts/build-site.mjs` and verify the exact link `href="/playground/"`.
