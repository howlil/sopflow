import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PACKAGES, packedFileName, inspectPacks, isPublished } from "./npm-release.mjs";

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

test("only three public packages remain in the release inventory", () => {
  assert.deepEqual(PACKAGES.map(([name]) => name), [
    "@sopflow/core",
    "@sopflow/diagram",
    "@sopflow/react",
  ]);
});

test("registry lookup retries temporary timeouts before confirming an existing version", async () => {
  let calls = 0;
  const waits = [];
  const result = await isPublished("@sopflow/react", "0.3.7", async () => {
    calls++;
    if (calls < 3) throw new DOMException("Timed out", "TimeoutError");
    return { status: 200, ok: true };
  }, async (ms) => { waits.push(ms); });
  assert.equal(result, true);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [1000, 2000]);
});

test("registry lookup treats 404 as unpublished without retry", async () => {
  let calls = 0;
  const result = await isPublished("@sopflow/react", "0.3.7", async () => {
    calls++;
    return { status: 404, ok: false };
  }, async () => { throw new Error("Unexpected retry"); });
  assert.equal(result, false);
  assert.equal(calls, 1);
});

test("registry lookup fails fast on permanent 403 without retry", async () => {
  let calls = 0;
  await assert.rejects(
    () => isPublished("@sopflow/react", "0.3.7", async () => {
      calls++;
      return { status: 403, ok: false };
    }, async () => { throw new Error("Unexpected retry"); }),
    /lookup failed after 1 attempt/,
  );
  assert.equal(calls, 1);
});

test("registry lookup eventually reports repeated timeout rather than attempting blind publication", async () => {
  let calls = 0;
  await assert.rejects(
    () => isPublished("@sopflow/react", "0.3.7", async () => {
      calls++;
      throw new DOMException("Timed out", "TimeoutError");
    }, async () => {}),
    /lookup failed after 4 attempt/,
  );
  assert.equal(calls, 4);
});
