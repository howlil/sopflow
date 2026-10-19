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
    console.log("First publication required for the following npm packages:");
    result.missing.forEach((name) => console.log("  - " + name));
    console.log("A granular NPM_KEY with package publish + Bypass 2FA can publish these from GitHub Actions; alternatively run npm login && pnpm release:bootstrap once.");
    console.log("No OTP or npm token is needed in GitHub Actions after Trusted Publishing is configured.");
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, "ready=" + result.ready + "\n");
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const message = result.ready
      ? "### npm registry readiness\nAll five packages are present on npm.\n"
      : "### First npm publication required\nMissing: " + result.missing.join(", ") +
        "\n\nCI may publish these via a granular NPM_KEY with package publish permission and Bypass 2FA.\n";
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, message);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
