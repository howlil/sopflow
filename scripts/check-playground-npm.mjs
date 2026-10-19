#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const appDir = join(repo, "apps", "playground");
const manifest = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"));
const packages = ["@sopflow/core", "@sopflow/diagram", "@sopflow/react"];

for (const name of packages) {
  const spec = manifest.dependencies?.[name];
  if (spec !== "npmjs:0.1.0") {
    throw new Error(`playground must pin ${name} to npmjs:0.1.0, got ${spec}`);
  }
  const installed = join(appDir, "node_modules", ...name.split("/"));
  if (!existsSync(installed)) {
    throw new Error(`Published package not installed: ${name} (${installed})`);
  }
  const actual = realpathSync(installed);
  const local = join(repo, "packages") + sep;
  if (actual.startsWith(local)) {
    throw new Error(`${name} is still linked to a workspace source: ${actual}`);
  }
  if (!actual.includes(`${sep}.pnpm${sep}`)) {
    throw new Error(`${name} was not resolved through pnpm's registry store: ${actual}`);
  }
  const installedManifest = JSON.parse(readFileSync(join(actual, "package.json"), "utf8"));
  if (installedManifest.name !== name || installedManifest.version !== "0.1.0") {
    throw new Error(`Unexpected registry package: ${installedManifest.name}@${installedManifest.version}`);
  }
  if (!existsSync(join(actual, "dist", "index.mjs")) ||
      !existsSync(join(actual, "dist", "index.d.mts"))) {
    throw new Error(`Missing publish artifacts for ${name}`);
  }
  if (name === "@sopflow/react" && !existsSync(join(actual, "dist", "styles.css"))) {
    throw new Error("Published @sopflow/react is missing dist/styles.css");
  }
  console.log(`Published dependency verified: ${name}@0.1.0`);
}
