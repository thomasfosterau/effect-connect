/** Bundles the Worker under test into one module, resolved the way a Workers bundler resolves it. */
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/worker.ts"],
    platform: "neutral",
    format: "esm",
    outDir: ".build",
    logLevel: "warn",
    // workerd resolves no node_modules: everything is inlined.
    deps: { alwaysBundle: [/.*/] },
    inputOptions: {
      resolve: {
        conditionNames: ["workerd", "worker", "browser", "import", "default"],
        mainFields: ["module", "main"],
      },
    },
    outputOptions: { codeSplitting: false },
  },
});
