import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const sourceAliases = [
  {
    find: /^@sopflow\/react\/styles\.css$/,
    replacement: fileURLToPath(
      new URL("../../packages/react/src/styles/token.css", import.meta.url),
    ),
  },
  {
    find: /^@sopflow\/react$/,
    replacement: fileURLToPath(
      new URL("../../packages/react/src/index.ts", import.meta.url),
    ),
  },
  {
    find: /^@sopflow\/diagram$/,
    replacement: fileURLToPath(
      new URL("../../packages/diagram/src/index.ts", import.meta.url),
    ),
  },
  {
    find: /^@sopflow\/core$/,
    replacement: fileURLToPath(
      new URL("../../packages/core/src/index.ts", import.meta.url),
    ),
  },
];

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Dev should always reflect workspace source and support HMR.
    // Production builds intentionally consume package exports/dist instead.
    alias: command === "serve" ? sourceAliases : [],
  },
}));
