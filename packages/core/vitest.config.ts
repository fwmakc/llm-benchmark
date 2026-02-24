import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // forks pool is required for native modules (better-sqlite3, keytar)
    pool: "forks",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
