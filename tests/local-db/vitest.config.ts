import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { configureLocalDatabase } from "./guard";

configureLocalDatabase(); // Fail closed before importing app modules or constructing Prisma.
export default defineConfig({
  root: fileURLToPath(new URL("../../", import.meta.url)),
  envDir: false,
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  test: {
    include: ["tests/local-db/*.integration.ts"],
    environment: "node",
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 15000,
    hookTimeout: 30000,
    setupFiles: ["./tests/local-db/setup.ts"],
  },
});
