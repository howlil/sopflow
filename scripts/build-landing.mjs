import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "apps", "landing");
const output = join(source, "dist");
const playgroundUrl = process.env.SOPFLOW_PLAYGROUND_URL || "https://sopflow-playground.pages.dev/";

const parsedUrl = new URL(playgroundUrl);
if (parsedUrl.protocol !== "https:" && !(parsedUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsedUrl.hostname))) {
  throw new Error("SOPFLOW_PLAYGROUND_URL must be an HTTPS URL (or local HTTP URL).");
}
if (parsedUrl.username || parsedUrl.password) {
  throw new Error("SOPFLOW_PLAYGROUND_URL cannot contain credentials.");
}

const safeUrl = parsedUrl.toString().replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
const html = readFileSync(join(source, "index.html"), "utf8");
if (!html.includes("__PLAYGROUND_URL__")) {
  throw new Error("Landing link placeholder is missing.");
}
mkdirSync(join(output, "brand"), { recursive: true });
writeFileSync(join(output, "index.html"), html.replaceAll("__PLAYGROUND_URL__", safeUrl));
copyFileSync(join(source, "styles.css"), join(output, "styles.css"));
copyFileSync(join(root, "assets", "brand", "logo.svg"), join(output, "brand", "logo.svg"));
console.log("Built landing:", output, "→", parsedUrl.toString());
