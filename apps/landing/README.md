# SOPFlow Astro landing

Marketing content is rendered statically by Astro. The workspace window embeds the **real** same-origin React playground at `/playground/`; there is no duplicate SOP editor, diagram implementation, or landing-owned document state.

- Develop: `pnpm --filter sopflow-landing dev` (the iframe requires the combined site or a separately served `/playground/` route).
- Build and verify the Pages artifact: `node scripts/build-site.mjs`.
- Canonical React design tokens and the brand SVG are copied into Astro public assets before build.
- The playground is a published-package consumer; it does not persist edits across navigation/refresh.
