import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@sopflow/core/sop-ap": fileURLToPath(
        new URL("../core/src/sop-ap.ts", import.meta.url),
      ),
      "@sopflow/core": fileURLToPath(
        new URL("../core/src/index.ts", import.meta.url),
      ),
      "@sopflow/diagram": fileURLToPath(
        new URL("../diagram/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
