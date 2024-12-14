import {defineConfig} from "vitest/config"

export default defineConfig({
  test: {
    pool: "threads",
    include: ["**/*.test.ts"],
    coverage: {
      include: ["src"],
      exclude: ["src/tests/**"]
    }
  }
})
