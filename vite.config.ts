/**
 * Root workspace config: the repo-wide format, lint and staged passes, and the
 * root tasks (`ci`, `check`, coverage, fallow, release).
 */

import { defineConfig } from "vite-plus";
import { recommended } from "@effect/tsgo/oxlint-presets";
import effect from "@enfect/oxlint";
import * as R from "effect/Record";

type Preset = typeof recommended;

/** A preset with every rule it enables raised to `error` (both use bare severities). */
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
    // docgen output is generated; Changesets writes each CHANGELOG.md.
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
    // No warn tier: a finding always fails `vp check`.
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
      // `@effect/vitest`'s `it.effect` / `it.layer` are test blocks.
      "vitest/no-standalone-expect": [
        "error",
        { additionalTestBlockFunctions: ["it.effect", "it.live", "it.scoped", "it.layer"] },
      ],
    },
    overrides: [
      // `effect/http` and `@effect/vitest` are marked unstable upstream but are
      // this library's contract: off only where they must be imported.
      {
        files: [
          "packages/core/src/Http.ts",
          "packages/core/src/Transport.ts",
          "packages/resend/src/Resend.ts",
          "packages/resend/src/index.ts",
          "packages/twilio/src/Twilio.ts",
          "packages/twilio/src/index.ts",
          "tests/dist-consumer/src/consumer.ts",
          "**/tests/**/*.ts",
        ],
        rules: {
          "effecttsgo/unstable-api-usage": "off",
        },
      },
      // The workerd test Worker's handlers are an entry point, which these
      // rules exempt but cannot recognise.
      {
        files: ["tests/workerd/src/worker.ts"],
        rules: {
          "effect/effect-run-in-body": "off",
          "effecttsgo/strict-effect-provide": "off",
        },
      },
      // The exact type-equality idiom needs the phantom `T` this rule reports.
      {
        files: [
          "packages/alchemy-cloudflare/tests/alchemy.test.ts",
          "tests/dist-consumer/src/consumer.ts",
        ],
        rules: {
          "typescript/no-unnecessary-type-parameters": "off",
        },
      },
      // `fromHtml` is a single-pass tokenizer over a string: a mutable cursor,
      // tag and list stacks and constant lookup tables are its clearest form.
      {
        files: ["packages/core/src/EmailText.ts"],
        rules: {
          "effect/imperative-loops": "off",
          "effect/avoid-native-object-helpers": "off",
          "effect/no-length-comparison": "off",
          "effect/prefer-arr-match": "off",
          "effect/prefer-match-over-switch": "off",
        },
      },
      // Each `decode<Channel>Message(input: unknown)` is a boundary decoder:
      // its parameter is unparsed input by definition.
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
      // `EnvBinding` / `EnvSecretBinding` describe a Worker `env` value as it
      // arrives (`| null | undefined`); the same module adapts them onto `Option`.
      {
        files: ["packages/core/src/Transport.ts"],
        rules: {
          "effect/prefer-option-over-null": "off",
        },
      },
      // The declaration assertions must spell the `T | undefined` the
      // emitted wire and Worker-binding types contain.
      {
        files: ["tests/dist-consumer/src/consumer.ts"],
        rules: {
          "effect/prefer-option-over-null": "off",
        },
      },
    ],
    // tsrs, patched by `effect-tsgo patch --tsrs`. `typeCheck` stays off: it
    // reports every Effect language-service warning as an error, which
    // `ignoreEffectWarningsInTscExitCode` can't relax and no override can
    // scope. `vp run check` is the type gate.
    options: {
      typeAware: true,
      typeCheck: false,
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
      // What CI runs, in order, stopping at the first failure. `pnpm audit`
      // needs the network.
      ci: {
        command:
          "vp check && vp run --concurrency-limit 2 check && vp run -r test:unit && vp run -r build && pnpm audit --audit-level high",
        cache: false,
      },
      // Every package's type check, the emitted-declaration check and docgen.
      // Then the root configs (tsconfig.config.json), which no package covers.
      check: {
        command: "tsc -p tsconfig.config.json",
        dependsOn: [
          "@thomasfosterau/effect-connect#check",
          "@thomasfosterau/effect-connect-resend#check",
          "@thomasfosterau/effect-connect-twilio#check",
          "@thomasfosterau/effect-connect-react-email#check",
          "@thomasfosterau/effect-connect-mjml#check",
          "@thomasfosterau/effect-connect-alchemy-cloudflare#check",
          "@effect-connect/dist-consumer#check",
          "@thomasfosterau/effect-connect#docgen",
          "@thomasfosterau/effect-connect-resend#docgen",
          "@thomasfosterau/effect-connect-twilio#docgen",
          "@thomasfosterau/effect-connect-react-email#docgen",
          "@thomasfosterau/effect-connect-mjml#docgen",
          "@thomasfosterau/effect-connect-alchemy-cloudflare#docgen",
        ],
        cache: false,
      },
      // One Istanbul map for every package, which `fallow audit` reads.
      "test:coverage": {
        command: "vp test run --coverage",
        cache: false,
      },
      fallow: {
        command: "vp exec fallow --summary",
        cache: false,
      },
      // Run by the pre-commit hook.
      "fallow:audit": {
        command: "vp exec fallow audit --base origin/trunk --quiet",
        dependsOn: ["test:coverage"],
        cache: false,
      },
      // Run by .github/workflows/release.yml.
      "changeset:version": {
        command: "changeset version && vp fmt && pnpm install --lockfile-only",
        cache: false,
      },
      // The publish job's script: pnpm publishes each public package whose
      // version isn't on npm yet, in dependency order, runs no lifecycle
      // scripts, and does the OIDC trusted-publishing exchange (with
      // provenance) itself. Then `changeset git-tag` tags each untagged version
      // and reports the tags to the Changesets action through
      // `CHANGESETS_OUTPUT`, which pushes them and creates the GitHub releases.
      // A failed publish stops before tagging; a re-run publishes only what is
      // missing. Uncached, so it sees the job's full environment.
      release: {
        command: [
          "vp pm publish -r --access public --no-git-checks -- --ignore-scripts",
          "changeset git-tag",
        ],
        dependsOn: [
          "@thomasfosterau/effect-connect#build",
          "@thomasfosterau/effect-connect-resend#build",
          "@thomasfosterau/effect-connect-twilio#build",
          "@thomasfosterau/effect-connect-react-email#build",
          "@thomasfosterau/effect-connect-mjml#build",
          "@thomasfosterau/effect-connect-alchemy-cloudflare#build",
        ],
        cache: false,
      },
      // What `release` would publish, without publishing or tagging.
      "release:dry-run": {
        command: "vp pm publish -r --access public --dry-run --no-git-checks -- --ignore-scripts",
        dependsOn: [
          "@thomasfosterau/effect-connect#build",
          "@thomasfosterau/effect-connect-resend#build",
          "@thomasfosterau/effect-connect-twilio#build",
          "@thomasfosterau/effect-connect-react-email#build",
          "@thomasfosterau/effect-connect-mjml#build",
          "@thomasfosterau/effect-connect-alchemy-cloudflare#build",
        ],
        cache: false,
      },
    },
  },
  test: {
    // Each package's vite.config.ts is a vitest project.
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
