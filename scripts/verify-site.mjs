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
const notFound = required("404.html");
const landingStyles = required("styles.css");
const tokens = required("design-tokens.css");
const canonicalTokens = readFileSync(join(root, "packages", "react", "src", "styles", "token.css"), "utf8");
assert.equal(tokens, canonicalTokens, "Landing design tokens must match the React design system");
for (const [route, html] of [["/", landing], ["/404", notFound]]) {
  assert.match(html, /<body data-sopflow-root>/, `${route}: missing design token scope`);
  const inline = html.match(/<style data-sopflow-inline>([\s\S]*?)<\/style>/);
  assert.ok(inline, route + ": missing inlined canonical CSS");
  assert.equal(inline[1], tokens + "\n" + landingStyles, route + ": CSS differs from build assets");
  assert.doesNotMatch(html, /<link\b[^>]*href="\/(?:styles|design-tokens)\.css"/, route + ": external CSS dependency remains");
}
assert.match(landingStyles, /var\(--sopflow-color-text\)/);
assert.match(landingStyles, /var\(--sopflow-color-border\)/);
assert.doesNotMatch(landingStyles, /#(?:1e6bff|101627|ecf3ff|e4eaf1)\b/i, "Legacy blue/navy palette leaked into landing");
required("brand/logo.svg");
const redirects = required("_redirects");

assert.match(landing, /href="\/playground\/"/);
assert.match(landing, /<iframe\b[^>]*src="\/playground\/"/, "Landing must embed the real playground");
assert.doesNotMatch(landing, /id="routesToggle"|data-surface="flowchart"|id="inspectorToggle"/, "Remove mock editor controls");
assert.doesNotMatch(landingStyles, /\.preview-caption\s*\{[^}]*left:\s*-9999px/, "Persistence notice must be visible");
assert.doesNotMatch(landingStyles, /--sopflow-color-text\s*:|--sopflow-color-border\s*:/, "Do not override canonical semantic tokens");
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
