import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    // Most tests need no DOM; the ones that render hooks opt in with `// @vitest-environment happy-dom`.
    environment: "node",
  },
});
