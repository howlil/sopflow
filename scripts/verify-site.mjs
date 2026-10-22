import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "apps", "landing", "dist");

function required(relativePath) {
  const file = join(dist, relativePath);
  assert.ok(existsSync(file) && statSync(file).isFile(), `Missing build output: ${relativePath}`);
  return readFileSync(file, "utf8");
}

const landing = required("index.html");
const playground = required("playground/index.html");
required("404.html");
required("styles.css");
required("brand/logo.svg");
const redirects = required("_redirects");

assert.match(landing, /href="\/playground\/"/);
assert.doesNotMatch(landing, /__PLAYGROUND_URL__/);
assert.match(landing, /Changes are not saved after you leave or refresh/);
assert.match(redirects, /^\/playground \/playground\/ 301\s*$/m);

const references = [...playground.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
const assets = references.filter((reference) => reference.startsWith("/playground/assets/"));
assert.ok(assets.length > 0, "Playground does not reference its /playground/assets/ bundle");

for (const reference of references) {
  if (!reference.startsWith("/")) continue;
  assert.ok(reference.startsWith("/playground/"), `Playground has unexpected root asset: ${reference}`);
  const url = new URL(reference, "https://example.test");
  const relative = decodeURIComponent(url.pathname).slice(1);
  const destination = resolve(dist, relative);
  assert.ok(destination.startsWith(dist + sep), `Invalid asset reference: ${reference}`);
  assert.ok(existsSync(destination) && statSync(destination).isFile(), `Missing referenced asset: ${reference}`);
}
console.log(`Verified Pages artifact: ${assets.length} direct playground assets and explicit 404`);
