import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@contracts": fileURLToPath(new URL("../contracts/types", import.meta.url)),
    },
  },
  server: {
    strictPort: true,
    fs: {
      allow: [fileURLToPath(new URL("..", import.meta.url))],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    css: true,
    // `e2e/**` holds Playwright specs (its own `test`/`expect`, run via `playwright test`), not
    // Vitest ones — both frameworks default to matching `*.spec.ts`, so exclude Playwright's.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
