import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Separate from vite.config.js so the production build never imports test tooling.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",       // DOM APIs for component tests
    globals: true,              // describe/it/expect without imports
    setupFiles: "./src/test/setup.js",
  },
});
