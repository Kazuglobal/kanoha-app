import { defineConfig } from "vitest/config";
import path from "node:path";

const root = process.cwd();

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": root,
      "server-only": path.resolve(root, "tests/stubs/empty.ts"),
    },
  },
  test: {
    fileParallelism: false,
    environment: "jsdom",
    setupFiles: [path.resolve(root, "tests/setup.ts")],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "components/**/*.tsx"],
    },
  },
});
