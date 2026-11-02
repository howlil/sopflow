import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Astro renders the static landing into apps/landing/dist.
// The React playground remains a separate Vite build under /playground/.
execFileSync("pnpm", ["--filter", "sopflow-landing", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
console.log("Built Astro landing: apps/landing/dist → /playground/");
