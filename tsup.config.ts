import {defineConfig} from "tsup"

export default defineConfig({
  entry: {
    adapter: "./src/index.ts"
  },
  outDir: "./lib",
  format: ["esm", "cjs"],
  splitting: false,
  dts: true
})
