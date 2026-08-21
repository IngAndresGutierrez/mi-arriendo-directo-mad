import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // el emulador es un recurso compartido: los ficheros no pueden correr en paralelo
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
