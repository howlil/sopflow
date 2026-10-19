# SOPFlow Changesets

For changes affecting public packages, add a changeset with `pnpm changeset`.
Use patch for fixes, minor for compatible features, and major for breaking changes.

Merging a feature PR with changesets causes the `Version Packages` workflow to
prepare a version-and-changelog PR. npm publication is separate and disabled
until organization ownership, initial publishing, and trusted publishers are ready.

Docs-only and CI-only changes do not require changesets.
