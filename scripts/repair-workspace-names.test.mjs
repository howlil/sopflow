import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PACKAGES, repairWorkspaceNames } from "./repair-workspace-names.mjs";

function fixture(mutator = () => {}) {
  const root = mkdtempSync(join(tmpdir(), "sopflow-name-test-"));
  for (const [dir, name] of PACKAGES) {
    const path = join(root, dir, "package.json");
    mkdirSync(join(root, dir), { recursive: true });
    const manifest = { name, version: "0.1.0", dependencies: {} };
    mutator(manifest, dir);
    writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
  }
  const read = (dir) => JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8"));
  return { root, read, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("repairs historical package names and workspace dependencies", () => {
  const fx = fixture((pkg, dir) => {
    if (dir === "packages/core") pkg.name = "@howlil/sopflow";
    if (dir === "packages/diagram") {
      pkg.name = "@howlil/sopflow-diagram";
      pkg.dependencies["@howlil/sopflow"] = "workspace:*";
    }
    if (dir === "apps/playground") pkg.dependencies["@howlil/sopflow-react"] = "workspace:*";
  });
  try {
    assert.equal(repairWorkspaceNames({ root: fx.root }).length, 4);
    assert.equal(fx.read("packages/core").name, "@sopflow/core");
    assert.equal(fx.read("packages/diagram").dependencies["@sopflow/core"], "workspace:*");
    assert.equal(fx.read("apps/playground").dependencies["@sopflow/react"], "workspace:*");
    assert.deepEqual(repairWorkspaceNames({ root: fx.root }), []);
    assert.deepEqual(repairWorkspaceNames({ root: fx.root, check: true }), []);
  } finally { fx.cleanup(); }
});

test("check mode detects legacy references but does not mutate", () => {
  const fx = fixture((pkg, dir) => {
    if (dir === "apps/playground") pkg.dependencies["@howlil/sopflow-react"] = "workspace:*";
  });
  try {
    const path = join(fx.root, "apps/playground/package.json");
    const before = readFileSync(path, "utf8");
    assert.throws(() => repairWorkspaceNames({ root: fx.root, check: true }), /Noncanonical package names/);
    assert.equal(readFileSync(path, "utf8"), before);
  } finally { fx.cleanup(); }
});

test("rejects unknown aliases and dependency conflicts without partial writes", () => {
  const fx = fixture((pkg, dir) => {
    if (dir === "packages/core") pkg.name = "@howlil/sopflow";
    if (dir === "apps/playground") pkg.dependencies["@howlil/sopflow-unknown"] = "workspace:*";
  });
  try {
    assert.throws(() => repairWorkspaceNames({ root: fx.root }), /Unknown SOPFlow alias/);
    assert.equal(fx.read("packages/core").name, "@howlil/sopflow");
  } finally { fx.cleanup(); }
  const fx2 = fixture((pkg, dir) => {
    if (dir === "apps/playground") {
      pkg.dependencies["@howlil/sopflow-react"] = "workspace:*";
      pkg.dependencies["@sopflow/react"] = "^0.1.0";
    }
  });
  try { assert.throws(() => repairWorkspaceNames({ root: fx2.root }), /Conflicting ranges/); }
  finally { fx2.cleanup(); }
});
