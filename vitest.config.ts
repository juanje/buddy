import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // NFR-TEST-02: arm the guard that turns a real reflect spawn into a failure.
    setupFiles: ["tests/support/no-real-spawn.ts"],
  },
});
