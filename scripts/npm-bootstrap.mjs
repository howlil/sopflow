#!/usr/bin/env node
// One-time npm bootstrap. Run locally after authenticating as howlilabs with `npm login`.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, PACKAGES } from "./npm-release.mjs";

if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
  throw new Error("Bootstrap cannot run in CI; authenticate locally with npm login");
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (command, args) => execFileSync(command, args, { stdio: "inherit" });

async function bootstrap() {
  console.log("Checking npm login (required account: howlilabs)...");
  const account = execFileSync(npm, ["whoami"], { encoding: "utf8" }).trim();
  if (account !== "howlilabs") throw new Error("npm whoami returned " + account + "; login as howlilabs before bootstrap.");
  console.log("Preparing all five scoped package tarballs...");
  const dir = mkdtempSync(join(tmpdir(), "sopflow-bootstrap-"));
  try {
    run(pnpm, ["install", "--frozen-lockfile"]);
    run(pnpm, ["check"]);
    for (const [name] of PACKAGES) {
      run(pnpm, ["--filter", name, "pack", "--pack-destination", dir]);
    }
    process.env.SOPFLOW_PACK_DIR = dir;
    await main(["verify"]);
    console.log("Publishing only missing versions in dependency order. npm may request 2FA.");
    await main(["bootstrap"]);
    console.log("npm bootstrap complete. Configure GitHub Actions Trusted Publisher for each package.");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
bootstrap().catch((error) => {
  console.error("npm bootstrap failed:", error.message);
  process.exitCode = 1;
});
