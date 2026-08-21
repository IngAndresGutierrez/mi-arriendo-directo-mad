import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["features/**/*.test.ts", "shared/**/*.test.ts", "tests/**/*.test.ts"],
    // el emulador es un recurso compartido: los archivos no pueden correr en paralelo
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
