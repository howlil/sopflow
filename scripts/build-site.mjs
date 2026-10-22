import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "apps", "landing", "dist");
const playgroundOutput = join(root, "apps", "playground", "dist");

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
}

// Keep ordinary playground dev / CI builds at their original root path.
// Only the combined production build uses Vite's /playground/ public base.
run(process.execPath, ["scripts/build-landing.mjs"]);
run("pnpm", ["--filter", "playground", "exec", "vite", "build", "--base=/playground/"]);

const playgroundIndex = join(playgroundOutput, "index.html");
if (!existsSync(playgroundIndex)) {
  throw new Error("Playground build did not generate index.html.");
}
const playgroundHtml = readFileSync(playgroundIndex, "utf8");
if (!playgroundHtml.includes("/playground/assets/")) {
  throw new Error("Playground assets are not configured for /playground/.");
}

const nestedDestination = join(output, "playground");
rmSync(nestedDestination, { recursive: true, force: true });
cpSync(playgroundOutput, nestedDestination, { recursive: true });

const landingHtml = readFileSync(join(output, "index.html"), "utf8");
if (!landingHtml.includes('href="/playground/"') || landingHtml.includes("__PLAYGROUND_URL__")) {
  throw new Error("Landing does not link to the same-origin playground.");
}

// Normalize /playground to /playground/ while preserving query strings.
writeFileSync(join(output, "_redirects"), "/playground /playground/ 301\n");
console.log("Cloudflare Pages artifact ready:", output);
console.log("  / → landing");
console.log("  /playground/ → React playground");
