import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@contracts": fileURLToPath(new URL("../../contracts/types", import.meta.url)),
    },
  },
  test: {
    environment: "node",
  },
});
