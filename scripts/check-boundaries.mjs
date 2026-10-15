import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(root, "packages");
const errors = [];
const files = [];

function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) scan(full);
    else if (
      /\.(?:ts|tsx)$/.test(entry.name) &&
      !/\.(?:test|spec|d)\.(?:ts|tsx)$/.test(entry.name)
    ) files.push(full);
  }
}
scan(sourceRoot);

const fileSet = new Set(files);
const dependencies = new Map(files.map((file) => [file, []]));
const slash = (path) => path.split(sep).join("/");
const isUnder = (path, prefix) => slash(relative(root, path)).startsWith(prefix);

function resolveLocal(from, request) {
  const stem = resolve(dirname(from), request.replace(/\.js$/, ""));
  const options = [
    stem,
    `${stem}.ts`,
    `${stem}.tsx`,
    join(stem, "index.ts"),
    join(stem, "index.tsx"),
  ];
  return options.find((file) => fileSet.has(file)) ?? null;
}

for (const file of files) {
  const code = readFileSync(file, "utf8");
  const requests = [
    ...code.matchAll(/\bfrom\s*["']([^"']+)["']/g),
    ...code.matchAll(/^\s*import\s*["']([^"']+)["']/gm),
    ...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
  ].map((match) => match[1]);
  for (const request of new Set(requests)) {
    if (request.startsWith("@sopflow/")) {
      if (/^@sopflow\/[^/]+\/src\//.test(request)) {
        errors.push(`Internal package deep import: ${slash(relative(root,file))} -> ${request}`);
      }
      if (isUnder(file, "packages/core/")) {
        errors.push(`Core imports another SOPFlow package: ${request}`);
      }
      if (/^@sopflow\/react(?:\/|$)/.test(request) &&
          !isUnder(file, "packages/react/")) {
        errors.push(`Pure package imports React package: ${slash(relative(root,file))}`);
      }
      continue;
    }
    if (!request.startsWith(".")) continue;
    const target = resolveLocal(file, request);
    if (!target) {
      const candidate = resolve(dirname(file), request);
      if (/\.js$/.test(request) && !existsSync(candidate)) {
        errors.push(`Unresolved internal module: ${slash(relative(root,file))} -> ${request}`);
      }
      continue;
    }
    dependencies.get(file).push(target);
    const from = slash(relative(root, file));
    const to = slash(relative(root, target));
    if (from.startsWith("packages/diagram/src/bpmn/") &&
        to.startsWith("packages/diagram/src/procedure/")) {
      errors.push(`BPMN depends on procedure: ${from} -> ${to}`);
    }
    if (from.startsWith("packages/diagram/src/procedure/") &&
        to.startsWith("packages/diagram/src/bpmn/")) {
      errors.push(`Procedure depends on BPMN: ${from} -> ${to}`);
    }
    if (from.startsWith("packages/diagram/src/config/") &&
        /packages\/diagram\/src\/(?:bpmn|procedure|flowchart)\//.test(to)) {
      errors.push(`Shared config depends on renderer: ${from} -> ${to}`);
    }
    if (from.startsWith("packages/react/src/primitives/") &&
        /^packages\/react\/src\/(?:editor|steps|actors|diagram|header)\//.test(to)) {
      errors.push(`Primitive depends on feature: ${from} -> ${to}`);
    }
  }
}

const visited = new Set();
const visiting = new Set();
const stack = [];
function walk(node) {
  if (visiting.has(node)) {
    const start = stack.indexOf(node);
    errors.push("Dependency cycle: " +
      stack.slice(start).concat(node).map((file) => slash(relative(root, file))).join(" -> "));
    return;
  }
  if (visited.has(node)) return;
  visiting.add(node);
  stack.push(node);
  for (const next of dependencies.get(node) ?? []) walk(next);
  stack.pop();
  visiting.delete(node);
  visited.add(node);
}
for (const file of files) walk(file);

if (errors.length) {
  for (const message of errors) console.error(`[architecture] ${message}`);
  process.exitCode = 1;
} else {
  console.log(`Architecture boundaries verified: ${files.length} production source files`);
}
