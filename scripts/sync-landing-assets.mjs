import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "apps", "landing", "public");
mkdirSync(join(publicDir, "brand"), { recursive: true });
copyFileSync(join(root, "packages", "react", "src", "styles", "token.css"), join(publicDir, "design-tokens.css"));
copyFileSync(join(root, "assets", "brand", "logo.svg"), join(publicDir, "brand", "logo.svg"));
