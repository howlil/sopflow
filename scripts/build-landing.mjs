import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "apps", "landing", "dist");

// Astro renders marketing; Vite builds the separate React playground.
execFileSync("pnpm", ["--filter", "sopflow-landing", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

// Inline the canonical CSS into static HTML: the landing must remain styled
// even when external stylesheet requests are missing or blocked.
const tokens = readFileSync(join(output, "design-tokens.css"), "utf8");
const landingCss = readFileSync(join(output, "styles.css"), "utf8");
const inlineCss = tokens + "\n" + landingCss;
assert.ok(tokens.includes("--sopflow-color-text"), "Missing canonical tokens");
assert.ok(landingCss.includes(".product-window"), "Missing landing stylesheet");
assert.ok(!/<\/style/i.test(inlineCss), "Unsafe CSS style terminator");

const stylesheetLink = /<link\b[^>]*>/gi;
const isLandingStylesheet = (tag) =>
  /\brel=["']stylesheet["']/i.test(tag) &&
  /\bhref=["']\/(?:design-tokens|styles)\.css["']/i.test(tag);

for (const filename of ["index.html", "404.html"]) {
  const path = join(output, filename);
  const html = readFileSync(path, "utf8");
  let linkedStylesheets = 0;
  const withoutLinks = html.replace(stylesheetLink, (tag) => {
    if (!isLandingStylesheet(tag)) return tag;
    linkedStylesheets += 1;
    return "";
  });
  assert.equal(linkedStylesheets, 2, filename + ": expected both CSS links");
  assert.match(withoutLinks, /<\/head>/i, filename + ": missing head");
  writeFileSync(
    path,
    withoutLinks.replace(
      /<\/head>/i,
      '<style data-sopflow-inline>' + inlineCss + '</style></head>',
    ),
  );
}

console.log("Built Astro landing with canonical CSS inlined for both pages.");
