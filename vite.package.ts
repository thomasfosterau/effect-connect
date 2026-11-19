/** The Vite+ config every published package instantiates: tasks, `vp pack` and vitest. */
import { defineConfig } from "vite-plus";

/** Auto-tracked inputs minus node_modules churn, plus the lockfile. */
const cacheInputs = [
  { auto: true },
  "!node_modules/**",
  { pattern: "!node_modules/**", base: "workspace" as const },
  { pattern: "pnpm-lock.yaml", base: "workspace" as const },
];

export const packageConfig = () =>
  defineConfig({
    run: {
      tasks: {
        check: {
          command: "tsc -p tsconfig.json",
          dependsOn: [{ task: "check", from: "dependencies" }],
          cache: { input: cacheInputs, output: [] },
        },
        build: {
          command: "vp pack",
          dependsOn: [{ task: "build", from: "dependencies" }],
          cache: { input: cacheInputs, output: ["dist/**"] },
        },
        // Type-checks and runs every JSDoc `@example`; writes docs/ (gitignored).
        docgen: {
          command: "docgen",
          cache: false,
        },
        "test:unit": {
          command: "vp test run tests",
          cache: { env: ["VITEST_MAX_WORKERS", "NODE_OPTIONS"], input: cacheInputs, output: [] },
        },
      },
    },
    pack: {
      entry: ["src/index.ts"],
      platform: "neutral",
      dts: true,
      sourcemap: true,
    },
    test: {
      include: ["tests/**/*.test.ts"],
      testTimeout: 30_000,
      // CI's runners have two cores; `--maxWorkers` overrides it.
      maxWorkers: 2,
    },
  });
