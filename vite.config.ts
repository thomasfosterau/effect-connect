/**
 * @copyright Thomas Foster
 *
 * Root workspace config. Owns the repo-wide format/lint/staged passes (read
 * statically by `vp fmt` / `vp lint` / `vp staged`) and the root `check`
 * aggregate over every package's type gate.
 *
 * Copied from the effect-drizzle-ext library (itself a copy of the
 * gardeneria application's root config): every comment that explains a
 * load-bearing decision is part of the standard and travels with the config.
 */

import { defineConfig } from "vite-plus";
import { recommended } from "@effect/tsgo/oxlint-presets";
import effect from "@enfect/oxlint";
import * as R from "effect/Record";

type Preset = typeof recommended;

/**
 * A preset with every rule it enables raised to `error`. Both presets set
 * their rules to a bare severity (`"warn"` or `"error"`, no options and no
 * `"off"`), so each one maps to `"error"`.
 */
const atError = (preset: Preset): Preset => ({
  ...preset,
  rules: R.map(preset.rules ?? {}, () => "error" as const),
});

export default defineConfig({
  // Staged-file checks run by `vp staged` (pre-commit).
  staged: {
    "*.{js,ts,css,json,md}": "vp check --fix",
  },
  fmt: {
    // docgen's output (the generated API docs and the example files it
    // type-checks and runs) is gitignored and not ours to format. Changesets
    // writes each CHANGELOG.md, so the Version Packages PR must not depend on
    // the formatter agreeing with its output.
    ignorePatterns: ["packages/*/docs/**", "**/coverage/**", "**/CHANGELOG.md"],
    overrides: [
      {
        files: ["**/*.md"],
        options: {
          proseWrap: "never",
        },
      },
    ],
  },
  lint: {
    ignorePatterns: ["packages/*/docs/**", "**/coverage/**"],
    // Both presets, with every rule they enable raised to `error`: there is
    // no warn tier, so a finding always fails `vp check`.
    extends: [atError(recommended), atError(effect.configs.recommended)],
    plugins: ["typescript", "unicorn", "oxc", "import", "promise", "vitest", "jsdoc"],
    categories: {
      correctness: "error",
      suspicious: "error",
      perf: "error",
    },
    rules: {
      "eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "eslint/prefer-const": "error",
      // `_tag` is Effect's discriminant on every tagged union and error.
      "eslint/no-underscore-dangle": ["error", { allow: ["_tag"] }],
      "vite-plus/prefer-vite-plus-imports": "error",
      // `@effect/vitest`'s `it.effect` / `it.layer` are test blocks: an
      // `expect` inside the effect they run is inside the test (#104).
      "vitest/no-standalone-expect": [
        "error",
        { additionalTestBlockFunctions: ["it.effect", "it.live", "it.scoped", "it.layer"] },
      ],
    },
    overrides: [
      // `effect/http/*` and `@effect/vitest` are marked unstable upstream, and
      // both are this library's contract: every provider is an `HttpClient`
      // consumer (AGENTS.md) and every suite runs under `@effect/vitest`. The
      // rule is off only for the modules that must import `effect/http`, the
      // consumer fixture that names `HttpClient` in a type, and the tests.
      {
        files: [
          "packages/core/src/Http.ts",
          "packages/core/src/Transport.ts",
          "packages/resend/src/Resend.ts",
          "packages/resend/src/index.ts",
          "tests/dist-consumer/src/consumer.ts",
          "**/tests/**/*.ts",
        ],
        rules: {
          "effecttsgo/unstable-api-usage": "off",
        },
      },
      // The Worker that tests/workerd runs inside workerd. Its `test` handlers
      // are the entry point of that Worker: the one place an effect is run and
      // the transport is provided, from the `env` only the handler receives.
      // Both rules exempt an entry point, which the linter cannot recognise.
      {
        files: ["tests/workerd/src/worker.ts"],
        rules: {
          "effect/effect-run-in-body": "off",
          "effecttsgo/strict-effect-provide": "off",
        },
      },
      // The exact type-equality idiom (`(<T>() => T extends A ? 1 : 2) extends
      // …`) needs the phantom `T` this rule reports; there is no equivalent
      // without it. Only the compile-time assertion suites use it.
      {
        files: [
          "packages/alchemy-cloudflare/tests/alchemy.test.ts",
          "tests/dist-consumer/src/consumer.ts",
        ],
        rules: {
          "typescript/no-unnecessary-type-parameters": "off",
        },
      },
      // Each channel's model module exports its boundary decoder
      // (`decode<Channel>Message(input: unknown)`), the one function whose job
      // is to run the schema over unparsed input, so its parameter cannot be
      // a domain type. A point-free spelling (`flow(Schema.decodeUnknownEffect(…),
      // …)`) only hides the same `unknown` behind inference, and the emitted
      // declaration then inlines the message's structure in place of its name.
      {
        files: [
          "packages/core/src/Email.ts",
          "packages/core/src/Sms.ts",
          "packages/core/src/WhatsApp.ts",
          "packages/core/src/Chat.ts",
        ],
        rules: {
          "effect/no-unknown-parameters": "off",
        },
      },
      // A Worker `env` record keeps its native form: Cloudflare leaves an
      // unbound value as a missing key (or a stage binds `null`), so the two
      // binding types this module exports (`EnvBinding`, `EnvSecretBinding`)
      // have to spell `| null | undefined`. `boundString` / `boundSecret`, in
      // the same module, adapt them onto `Option` for everything else.
      {
        files: ["packages/core/src/Transport.ts"],
        rules: {
          "effect/prefer-option-over-null": "off",
        },
      },
      // The declaration assertions compare the emitted public types with
      // `Equals<…>`, and a wire field or Worker binding that may be absent is
      // `T | undefined` in that contract (`?: T | undefined` under
      // `exactOptionalPropertyTypes`), so the expected side has to spell the
      // union. The rule holds in every other file (#104).
      {
        files: ["tests/dist-consumer/src/consumer.ts"],
        rules: {
          "effect/prefer-option-over-null": "off",
        },
      },
    ],
    // Type-aware linting through the oxlint-tsgolint vite-plus carries
    // (patched by `effect-tsgo patch --oxlint`, so `@effect/tsgo`'s preset
    // rules run here too). `typeCheck` also reports TypeScript errors in the
    // lint pass; the `check` tasks (native tsc, Effect-patched) stay the type
    // gate, and on this tree the two agree (no lint-only type errors).
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
  run: {
    tasks: {
      // The CI typecheck gate, as one task: every package's `check`, the
      // dist-consumer check that type-checks a consumer fixture against the
      // EMITTED declarations, and every package's `docgen` (which type-checks
      // and runs each JSDoc `@example`). A pure graph node.
      check: {
        command: "echo 'check: every type gate green'",
        dependsOn: [
          "@thomasfosterau/effect-connect#check",
          "@thomasfosterau/effect-connect-resend#check",
          "@thomasfosterau/effect-connect-alchemy-cloudflare#check",
          "@effect-connect/dist-consumer#check",
          "@thomasfosterau/effect-connect#docgen",
          "@thomasfosterau/effect-connect-resend#docgen",
          "@thomasfosterau/effect-connect-alchemy-cloudflare#docgen",
        ],
        cache: false,
      },
      // Every package's unit suite under one Istanbul coverage map
      // (`coverage/coverage-final.json`), which `fallow audit` reads for exact
      // per-function CRAP scores (`health.coverage` in .fallowrc.json).
      // Without it fallow estimates every function as uncovered, and any
      // function with cyclomatic complexity >= 5 fails the gate on its own.
      // Run this before `fallow audit` (the PreToolUse fallow gate runs the
      // audit on `git commit` / `git push` but never refreshes this map).
      // The suites import their siblings through `exports`, which point at
      // `src/` inside the workspace, so no build edge is needed.
      "test:coverage": {
        command: "vp test run --coverage",
        cache: false,
      },
    },
  },
  test: {
    // One entry per package: each package's own vite.config.ts is a vitest
    // project, so the root run and the root coverage map cover them all.
    projects: ["packages/*/vite.config.ts"],
    coverage: {
      provider: "istanbul",
      reporter: ["text-summary", "json-summary", "json"],
      reportsDirectory: "./coverage",
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.d.ts"],
    },
  },
});
