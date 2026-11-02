# SOPFlow Astro landing

The V6 landing is split into Astro pages/components, retaining static rendering and the small preview-only JavaScript controller. The real SOP editor remains in `apps/playground` on pinned published `@sopflow/*` packages.

Run `pnpm --filter sopflow-landing dev` to develop the landing, or `node scripts/build-site.mjs` from the workspace root to build both same-origin routes for Cloudflare Pages.

Astro CLI `6.4.8` is pinned through `pnpm dlx` so the current frozen monorepo lockfile remains unaffected. The asset sync command copies the **canonical** logo and React design tokens into `public/` before dev/build. The illustrative preview has no persistence; navigating away/refreshing loses playground edits.
