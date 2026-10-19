import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Resolve the published @sopflow packages exactly as an external consumer would.
// Do not alias local monorepo sources during dev or production builds.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
