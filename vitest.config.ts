import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // See the stub: Next resolves this import, Vitest cannot.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["features/**/*.test.ts", "shared/**/*.test.ts", "tests/**/*.test.ts"],
    // The emulator is a shared resource: test files cannot run in parallel.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
