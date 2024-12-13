import {defineConfig} from "tsup"

export default defineConfig({
  entry: {
    "better-auth-adapter-mikro-orm": "./src/index.ts"
  },
  outDir: "./lib",
  format: ["esm", "cjs"],
  splitting: false,
  dts: true
})
