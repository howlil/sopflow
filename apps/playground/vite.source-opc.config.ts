import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dedicated browser acceptance configuration. Normal playground Vite config
// deliberately has no workspace aliases and continues testing npm artifacts.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@sopflow/core",
        replacement: fileURLToPath(
          new URL("../../packages/core/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@sopflow/diagram",
        replacement: fileURLToPath(
          new URL("../../packages/diagram/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@sopflow/react",
        replacement: fileURLToPath(
          new URL("../../packages/react/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
});
