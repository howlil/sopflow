#!/usr/bin/env node
// Public-registry readiness check: npm OIDC requires an already-published package.
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PACKAGES } from "./npm-release.mjs";

export async function inspectRegistry(names = PACKAGES.map(([name]) => name), fetcher = fetch) {
  const missing = [];
  for (const name of names) {
    const url = "https://registry.npmjs.org/" + encodeURIComponent(name);
    const response = await fetcher(url, {
      headers: { accept: "application/vnd.npm.install-v1+json" },
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 404) {
      missing.push(name);
      continue;
    }
    if (!response.ok) throw new Error("npm registry check for " + name + " failed (HTTP " + response.status + ")");
  }
  return { ready: missing.length === 0, missing };
}

export async function main() {
  const result = await inspectRegistry();
  if (result.ready) {
    console.log("npm bootstrap ready: all five @sopflow packages exist in the public registry.");
  } else {
    console.log("OIDC publish paused: the following packages do not yet exist on npm:");
    result.missing.forEach((name) => console.log("  - " + name));
    console.log("Once-only action on your computer: npm login && pnpm release:bootstrap");
    console.log("No OTP or npm token is needed in GitHub Actions after Trusted Publishing is configured.");
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, "ready=" + result.ready + "\n");
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      result.ready
        ? "### npm bootstrap ready\nAll five packages exist. Checking OIDC publication.\n"
        : "### npm publication paused: first publish required\nMissing: " + result.missing.join(", ") +
          "\n\nPublish these once as npm user `howlilabs`, then configure trusted publishing for `howlil/sopflow` workflow `publish.yml`.\n",
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
