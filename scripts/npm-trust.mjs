#!/usr/bin/env node
// Configure @sopflow/* trusted npm publishing after the first package release.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PACKAGES } from "./npm-release.mjs";

const npm = (args, options = {}) => {
  const result = spawnSync("npm", args, {
    shell: process.platform === "win32",
    encoding: "utf8",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("npm " + args.join(" ") + " failed with code " + result.status);
  return result.stdout ?? "";
};

function getTrusts(pkg) {
  const data = JSON.parse(npm(["trust", "list", pkg, "--json"]));
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.configurations)) return data.configurations;
  throw new Error("Unexpected npm trust list response for " + pkg);
}

async function configureTrustedPublishing() {
  if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
    throw new Error("npm trust setup must run in an authenticated interactive local session");
  }
  const whoami = npm(["whoami"]).trim();
  if (whoami !== "howlilabs") throw new Error("Login to npm as howlilabs, got " + whoami);
  const [major, minor] = npm(["--version"]).trim().split(".").map(Number);
  if (major < 11 || (major === 11 && minor < 15)) {
    throw new Error("npm trust requires npm >=11.15.0; run npm install -g npm@11.21.0");
  }

  for (const [name] of PACKAGES) {
    const existing = getTrusts(name);
    const matched = existing.some((item) =>
      item.type === "github" &&
      item.claims?.repository === "howlil/sopflow" &&
      item.claims?.workflow_ref?.file === "publish.yml" &&
      item.permissions?.includes("createPackage")
    );
    if (matched) {
      console.log("Trusted publisher already configured: " + name);
      continue;
    }
    if (existing.length) {
      throw new Error(name + " has an existing trusted publisher with different workflow/permissions. Review npm package settings before replacing it.");
    }
    console.log("Configuring npm OIDC trusted publisher for " + name);
    npm(["trust", "github", name, "--file", "publish.yml", "--repo", "howlil/sopflow", "--allow-publish", "--yes"], {
      stdio: "inherit",
    });
    const confirmed = getTrusts(name).some((item) =>
      item.type === "github" &&
      item.claims?.repository === "howlil/sopflow" &&
      item.claims?.workflow_ref?.file === "publish.yml" &&
      item.permissions?.includes("createPackage")
    );
    if (!confirmed) throw new Error("npm did not confirm GitHub publisher for " + name);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  console.log("Trusted publishing configured for all three public @sopflow/* packages.");
  console.log("Next: set GitHub Actions repository variable SOPFLOW_NPM_PUBLISH_ENABLED=true.");
}

export { configureTrustedPublishing };
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  configureTrustedPublishing().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
