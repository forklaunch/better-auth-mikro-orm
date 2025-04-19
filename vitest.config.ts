import {defineConfig} from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    reporters: ["default", "junit"],
    outputFile: "./vitest-report.junit.xml",
    coverage: {
      include: ["src"],
      exclude: ["src/tests/**"]
    }
  }
})
