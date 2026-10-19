#!/usr/bin/env node
// Repair historical SOPFlow workspace aliases in package manifests only.
// No source files, external dependencies, or npm credentials are modified.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PACKAGES = [
  ["packages/core", "@sopflow/core"],
  ["packages/diagram", "@sopflow/diagram"],
  ["packages/sop-ap", "@sopflow/sop-ap"],
  ["packages/adapter-sop-ta", "@sopflow/adapter-sop-ta"],
  ["packages/react", "@sopflow/react"],
  ["apps/playground", "playground"],
];

const ALIASES = new Map([
  ["@howlil/sopflow", "@sopflow/core"],
  ["@howlil/sopflow-core", "@sopflow/core"],
  ["@howlil/sopflow-diagram", "@sopflow/diagram"],
  ["@howlil/sopflow-sop-ap", "@sopflow/sop-ap"],
  ["@howlil/sopflow-adapter-sop-ta", "@sopflow/adapter-sop-ta"],
  ["@howlil/sopflow-react", "@sopflow/react"],
]);
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

export function repairWorkspaceNames({ root = process.cwd(), check = false } = {}) {
  const changes = [];
  const updates = [];
  // Validate all manifests before any write, avoiding a partially repaired workspace.
  for (const [directory, expectedName] of PACKAGES) {
    const file = join(root, directory, "package.json");
    if (!existsSync(file)) throw new Error("Missing workspace manifest: " + file);
    const pkg = JSON.parse(readFileSync(file, "utf8"));
    let changed = false;
    const oldName = pkg.name;
    if (oldName !== expectedName) {
      if (ALIASES.get(oldName) !== expectedName) {
        throw new Error("Unexpected package name in " + directory + ": " + oldName + "; expected " + expectedName);
      }
      pkg.name = expectedName;
      changed = true;
      changes.push(directory + ": " + oldName + " -> " + expectedName);
    }
    for (const field of DEPENDENCY_FIELDS) {
      const deps = pkg[field];
      if (!deps) continue;
      for (const [name, version] of Object.entries(deps)) {
        if (!name.startsWith("@howlil/sopflow")) continue;
        const replacement = ALIASES.get(name);
        if (!replacement) throw new Error("Unknown SOPFlow alias in " + directory + " " + field + ": " + name);
        if (Object.hasOwn(deps, replacement) && deps[replacement] !== version) {
          throw new Error("Conflicting ranges in " + directory + ": " + name + "=" + version +
            " and " + replacement + "=" + deps[replacement]);
        }
        deps[replacement] = version;
        delete deps[name];
        changed = true;
        changes.push(directory + " " + field + ": " + name + " -> " + replacement);
      }
    }
    if (changed) updates.push({ file, content: JSON.stringify(pkg, null, 2) + "\n" });
  }
  if (check && changes.length) {
    throw new Error("Noncanonical package names:\n  " + changes.join("\n  ") +
      "\nRun: node scripts/repair-workspace-names.mjs");
  }
  if (!check) for (const update of updates) writeFileSync(update.file, update.content);
  return changes;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const changes = repairWorkspaceNames({ check: process.argv.includes("--check") });
    if (!changes.length) console.log("SOPFlow package names already use @sopflow/*.");
    else {
      for (const item of changes) console.log("Fixed: " + item);
      console.log("Run pnpm install --no-frozen-lockfile to refresh local workspace links.");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
