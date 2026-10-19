import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PACKAGES, packedFileName, inspectPacks } from "./npm-release.mjs";

function fixture(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), "sopflow-release-test-"));
  const packs = join(root, "packs");
  mkdirSync(packs);
  for (const [name, directory] of PACKAGES) {
    const original = {
      name, version: "0.1.0", type: "module",
      main: "./dist/index.mjs",
      types: "./dist/index.d.mts",
      exports: { ".": { types: "./dist/index.d.mts", import: "./dist/index.mjs" } },
      publishConfig: { access: "public" },
      repository: { url: "git+https://github.com/howlil/sopflow.git", directory },
      dependencies: {},
    };
    const manifest = { ...original, ...(overrides[name] ?? {}) };
    const sourceDir = join(root, directory);
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, "package.json"), JSON.stringify(original));
    const stage = join(root, "stage", name.replace("/", "-"), "package");
    mkdirSync(join(stage, "dist"), { recursive: true });
    writeFileSync(join(stage, "package.json"), JSON.stringify(manifest));
    writeFileSync(join(stage, "dist/index.mjs"), "export {};\n");
    writeFileSync(join(stage, "dist/index.d.mts"), "export {};\n");
    execFileSync("tar", ["-czf", join(packs, packedFileName(name, "0.1.0")), "-C", join(stage, ".."), "package"]);
  }
  return { root, packs, cleanup() { rmSync(root, { recursive: true, force: true }); } };
}

test("accepts all five correct tarballs in dependency order", () => {
  const tmp = fixture();
  try {
    const pkgs = inspectPacks(tmp.packs, tmp.root);
    assert.deepEqual(pkgs.map((pkg) => pkg.name), PACKAGES.map(([name]) => name));
  } finally { tmp.cleanup(); }
});

test("rejects workspace dependencies left in npm archives", () => {
  const tmp = fixture({ "@sopflow/react": { dependencies: { "@sopflow/core": "workspace:*" } } });
  try {
    assert.throws(() => inspectPacks(tmp.packs, tmp.root), /invalid published dependencies range/);
  } finally { tmp.cleanup(); }
});

test("rejects missing exported distribution files", () => {
  const tmp = fixture({ "@sopflow/react": { exports: { ".": "./dist/missing.mjs" } } });
  try {
    assert.throws(() => inspectPacks(tmp.packs, tmp.root), /missing \.\/dist\/missing\.mjs/);
  } finally { tmp.cleanup(); }
});

test("rejects invalid repository identity", () => {
  const tmp = fixture({ "@sopflow/core": { repository: { url: "https://other.example/repo", directory: "packages/core" } } });
  try {
    assert.throws(() => inspectPacks(tmp.packs, tmp.root), /repository metadata/);
  } finally { tmp.cleanup(); }
});
