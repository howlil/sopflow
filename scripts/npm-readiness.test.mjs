import test from "node:test";
import assert from "node:assert/strict";
import { inspectRegistry } from "./npm-readiness.mjs";

test("ready when every scoped package exists", async () => {
  const seen = [];
  const result = await inspectRegistry(
    ["@sopflow/core", "@sopflow/react"],
    async (url) => {
      seen.push(url);
      return { status: 200, ok: true };
    },
  );
  assert.deepEqual(result, { ready: true, missing: [] });
  assert.deepEqual(seen, [
    "https://registry.npmjs.org/%40sopflow%2Fcore",
    "https://registry.npmjs.org/%40sopflow%2Freact",
  ]);
});

test("returns missing packages without trying to publish", async () => {
  const result = await inspectRegistry(
    ["@sopflow/core", "@sopflow/react"],
    async (url) => url.includes("react")
      ? { status: 404, ok: false }
      : { status: 200, ok: true },
  );
  assert.deepEqual(result, { ready: false, missing: ["@sopflow/react"] });
});

test("fails closed on npm registry outages instead of treating them as missing", async () => {
  await assert.rejects(
    inspectRegistry(["@sopflow/core"], async () => ({ status: 502, ok: false })),
    /HTTP 502/,
  );
});
