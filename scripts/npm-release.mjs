#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, appendFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

export const PACKAGES = [
  ["@sopflow/core", "packages/core"],
  ["@sopflow/diagram", "packages/diagram"],
  ["@sopflow/react", "packages/react"],
];

const expectedRepo = "git+https://github.com/howlil/sopflow.git";

function npmCLI(args, options = {}) {
  const result = spawnSync("npm", args, { shell: process.platform === "win32", encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("npm " + args[0] + " failed with exit code " + result.status);
  return result.stdout ?? "";
}

export function packedFileName(name, version) {
  return name.replace(/^@/, "").replaceAll("/", "-") + "-" + version + ".tgz";
}

function getTarEntries(file) {
  return new Set(execFileSync("tar", ["-tzf", file], { encoding: "utf8" }).trim().split(/\r?\n/));
}

function validateManifest(manifest, source, tarEntries) {
  if (manifest.name !== source.name || manifest.version !== source.version) {
    throw new Error("Pack mismatch for " + source.name + ": " + manifest.version);
  }
  if (manifest.private || manifest.publishConfig?.access !== "public") {
    throw new Error(source.name + " must be a public publishable package");
  }
  if (manifest.repository?.url !== expectedRepo || manifest.repository?.directory !== source.directory) {
    throw new Error(source.name + " has missing or inconsistent repository metadata");
  }
  for (const field of ["main", "types"]) {
    if (typeof manifest[field] !== "string") throw new Error(source.name + " missing " + field);
  }
  const exportFiles = [];
  const walk = (value) => {
    if (typeof value === "string") {
      if (value.startsWith("./")) exportFiles.push(value);
    } else if (value && typeof value === "object") {
      for (const item of Object.values(value)) walk(item);
    }
  };
  walk(manifest.exports);
  const requiredFiles = [...new Set([manifest.main, manifest.types, ...exportFiles])];
  for (const file of requiredFiles) {
    if (!tarEntries.has("package/" + file.replace(/^\.\//, ""))) {
      throw new Error(source.name + " package tarball missing " + file);
    }
  }
  for (const [section, deps] of Object.entries({
    dependencies: manifest.dependencies,
    peerDependencies: manifest.peerDependencies,
    optionalDependencies: manifest.optionalDependencies,
  })) {
    for (const [name, range] of Object.entries(deps ?? {})) {
      if (typeof range !== "string" || range.startsWith("workspace:")) {
        throw new Error(source.name + " has invalid published " + section + " range for " + name + ": " + range);
      }
    }
  }
}

export function inspectPacks(packDir, rootDir = process.cwd()) {
  const allTarballs = readdirSync(packDir).filter((name) => name.endsWith(".tgz"));
  if (allTarballs.length !== PACKAGES.length) {
    throw new Error("Expected " + PACKAGES.length + " package tarballs; found " + allTarballs.length);
  }
  return PACKAGES.map(([name, directory]) => {
    const source = JSON.parse(readFileSync(join(rootDir, directory, "package.json"), "utf8"));
    if (source.name !== name) throw new Error("Invalid source name: " + directory);
    const tarball = join(packDir, packedFileName(name, source.version));
    if (!existsSync(tarball)) throw new Error("Missing tarball: " + tarball);
    const manifest = JSON.parse(execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }));
    validateManifest(manifest, { ...source, directory }, getTarEntries(tarball));
    return { name, directory, version: manifest.version, tarball };
  });
}

// npm's public registry can have intermittent long-tail network latency on
// GitHub-hosted runners. A timeout is not proof that a version is unpublished:
// retry bounded reads rather than risking a duplicate immutable publication.
const REGISTRY_LOOKUP_TIMEOUT_MS = 60_000;
const REGISTRY_LOOKUP_MAX_ATTEMPTS = 4;

export async function isPublished(
  name,
  version,
  fetcher = fetch,
  delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  const url = "https://registry.npmjs.org/" + encodeURIComponent(name) + "/" + encodeURIComponent(version);
  for (let attempt = 1; attempt <= REGISTRY_LOOKUP_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetcher(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(REGISTRY_LOOKUP_TIMEOUT_MS),
      });
      if (response.status === 404) return false;
      if (response.ok) return true;
      const error = new Error("npm registry lookup failed for " + name + "@" + version + ": HTTP " + response.status);
      // Authentication or other non-rate-limit 4xx errors are not transient.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw Object.assign(error, { permanent: true });
      }
      throw error;
    } catch (error) {
      if (error?.permanent || attempt === REGISTRY_LOOKUP_MAX_ATTEMPTS) {
        throw new Error(
          "npm registry lookup failed after " + attempt + " attempt(s) for " + name + "@" + version,
          { cause: error },
        );
      }
      console.warn(
        "Retrying npm registry lookup for " + name + "@" + version +
          " (" + attempt + "/" + REGISTRY_LOOKUP_MAX_ATTEMPTS + "): " + String(error?.message ?? error),
      );
      await delay(Math.min(1000 * 2 ** (attempt - 1), 8000));
    }
  }
  throw new Error("Unreachable npm registry lookup state");
}

function assertNoPendingChangesets(rootDir) {
  const pending = readdirSync(join(rootDir, ".changeset")).filter((file) => file.endsWith(".md") && file.toLowerCase() !== "readme.md");
  if (pending.length) throw new Error("Cannot publish before merging the version PR: " + pending.join(", "));
}

export async function main(args = process.argv.slice(2)) {
  const mode = args[0] ?? "verify";
  if (!["verify", "publish", "bootstrap"].includes(mode)) throw new Error("Expected verify, bootstrap or publish, got " + mode);
  if (mode === "bootstrap") {
    if (process.env.CI === "true") throw new Error("Bootstrap requires an authenticated interactive local npm session");
    const whoami = npmCLI(["whoami"]).trim();
    if (whoami !== "howlilabs") {
      throw new Error("Wrong npm account: expected howlilabs, got " + whoami + ". Run npm login as howlilabs.");
    }
  }
  const rootDir = process.cwd();
  const packDir = resolve(process.env.SOPFLOW_PACK_DIR || "/tmp/sopflow-packs");
  const packages = inspectPacks(packDir, rootDir);
  console.log("Verified " + packages.length + " SOPFlow package tarballs");
  if (mode === "verify") return;
  if (mode === "publish" && process.env.SOPFLOW_NPM_PUBLISH_ENABLED !== "true") {
    throw new Error("Publish disabled: set SOPFLOW_NPM_PUBLISH_ENABLED=true only after npm bootstrap and OIDC configuration");
  }
  assertNoPendingChangesets(rootDir);
  const published = [];
  for (const pkg of packages) {
    if (await isPublished(pkg.name, pkg.version)) {
      console.log("Already on npm: " + pkg.name + "@" + pkg.version + " (skip)");
      continue;
    }
    console.log("Publishing " + pkg.name + "@" + pkg.version);
    npmCLI(["publish", pkg.tarball, "--access", "public", "--registry", "https://registry.npmjs.org/", "--ignore-scripts"], {
      stdio: "inherit",
      env: { ...process.env, NPM_CONFIG_PROVENANCE: mode === "publish" ? "true" : "false" },
    });
    // npm returns success after accepting a publication but its public registry
    // metadata can lag. Do not fail (and accidentally retry an immutable version)
    // just because the new version is not visible in the first registry GET.
    console.log("npm accepted " + pkg.name + "@" + pkg.version + "; registry indexing may still be in progress.");
    published.push({ name: pkg.name, version: pkg.version, directory: pkg.directory });
  }
  // Reconcile GitHub Releases for all published/accepted versions, including
  // ones from an earlier partially successful run. github-releases.mjs skips
  // existing tags, so rerunning after registry propagation is safe.
  const output = JSON.stringify(packages.map(({ name, version, directory }) => ({ name, version, directory })));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "released=" + output + "\n");
  console.log("Newly accepted npm publications: " + JSON.stringify(published));
  console.log("Versions reconciled with GitHub Releases: " + output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
