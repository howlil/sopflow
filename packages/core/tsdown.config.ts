import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts", "src/sop-ap.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
})