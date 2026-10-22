import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "apps", "landing");
const output = join(source, "dist");
const playgroundPath = "/playground/";

const html = readFileSync(join(source, "index.html"), "utf8");
if (!html.includes("__PLAYGROUND_URL__")) {
  throw new Error("Landing playground link placeholder is missing.");
}
mkdirSync(join(output, "brand"), { recursive: true });
writeFileSync(join(output, "index.html"), html.replaceAll("__PLAYGROUND_URL__", playgroundPath));
copyFileSync(join(source, "styles.css"), join(output, "styles.css"));
copyFileSync(join(root, "assets", "brand", "logo.svg"), join(output, "brand", "logo.svg"));
console.log("Built landing:", output, "→", playgroundPath);
