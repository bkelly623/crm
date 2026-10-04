import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
    // Next resolves this marker at build time; jsdom/Vite needs the installed
    // Next copy to resolve it. Server-route tests explicitly mock the marker.
    "server-only": fileURLToPath(new URL("./node_modules/next/dist/compiled/server-only/index.js", import.meta.url)),
  } },
  esbuild: { jsx: "automatic" },
  test: { include: ["tests/**/*.test.{ts,tsx}"], setupFiles: ["./tests/setup.ts"] },
});
