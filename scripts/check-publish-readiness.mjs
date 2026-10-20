import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(root, "packages");
const publishOrder = ["core", "diagram", "react"];
const packageDirs = publishOrder.map((name) => join(packagesDir, name));

const errors = [];
const tempDir = mkdtempSync(join(tmpdir(), "sopflow-publish-check-"));

function collectExportPaths(exportsField, bucket = []) {
  if (typeof exportsField === "string") {
    bucket.push(exportsField);
  } else if (exportsField && typeof exportsField === "object") {
    for (const value of Object.values(exportsField)) {
      collectExportPaths(value, bucket);
    }
  }
  return bucket;
}

try {
  for (const pkgDir of packageDirs) {
    const pkgJsonPath = join(pkgDir, "package.json");
    if (!existsSync(pkgJsonPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    if (pkg.private) continue;

    const label = pkg.name || pkgDir;
    const requiredStringFields = ["name", "version", "description", "license", "main", "types"];
    for (const field of requiredStringFields) {
      if (typeof pkg[field] !== "string" || !pkg[field].trim()) {
        errors.push(`${label}: missing or empty "${field}" in package.json`);
      }
    }

    if (pkg.publishConfig?.access !== "public") {
      errors.push(`${label}: publishConfig.access must be "public" for scoped npm publishing`);
    }

    if (!pkg.repository?.url || !pkg.repository?.directory) {
      errors.push(`${label}: missing repository.url or repository.directory in package.json`);
    }

    if (!Array.isArray(pkg.files) || !pkg.files.includes("dist")) {
      errors.push(`${label}: "files" must include "dist"`);
    }

    for (const docFile of ["README.md", "LICENSE"]) {
      if (!existsSync(join(pkgDir, docFile))) {
        errors.push(`${label}: missing ${docFile} in package directory`);
      }
    }

    const declaredPaths = new Set([
      pkg.main,
      pkg.types,
      ...collectExportPaths(pkg.exports),
    ].filter(Boolean));

    for (const relPath of declaredPaths) {
      const resolvedPath = resolve(pkgDir, relPath);
      if (!existsSync(resolvedPath)) {
        errors.push(`${label}: declared export file does not exist: ${relPath}`);
      }
    }

    // Pack tarball and verify workspace:* protocol replacement
    const pkgTempDir = join(tempDir, pkg.name.replace(/^@/, "").replace(/\//g, "-"));
    mkdirSync(pkgTempDir, { recursive: true });
    execSync(`pnpm --filter ${pkg.name} pack --pack-destination "${pkgTempDir}"`, {
      cwd: root,
      stdio: "pipe",
    });

    const tgzFile = readdirSync(pkgTempDir).find((f) => f.endsWith(".tgz"));
    if (!tgzFile) {
      errors.push(`${label}: pnpm pack did not produce a .tgz archive`);
      continue;
    }

    execSync(`tar -xzf "${join(pkgTempDir, tgzFile)}" -C "${pkgTempDir}"`, {
      stdio: "pipe",
    });

    const packedPkgJsonPath = join(pkgTempDir, "package", "package.json");
    const packedPkg = JSON.parse(readFileSync(packedPkgJsonPath, "utf8"));

    for (const depGroup of ["dependencies", "peerDependencies", "optionalDependencies"]) {
      const deps = packedPkg[depGroup];
      if (!deps) continue;
      for (const [depName, depRange] of Object.entries(deps)) {
        if (String(depRange).startsWith("workspace:")) {
          errors.push(
            `${label}: packed tarball still contains unresolved workspace protocol for ${depName}: ${depRange}`,
          );
        }
      }
    }

    for (const relPath of declaredPaths) {
      const inTarball = resolve(join(pkgTempDir, "package"), relPath);
      if (!existsSync(inTarball)) {
        errors.push(`${label}: packed tarball is missing declared file ${relPath}`);
      }
    }
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

if (errors.length > 0) {
  for (const err of errors) {
    console.error(`[publish-check] ${err}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Publish readiness verified for ${packageDirs.length} packages.`);
}
