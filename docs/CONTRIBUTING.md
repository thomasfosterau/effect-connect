# Contributing

## Workflow

The main branch is `trunk`. Branch off `trunk`, open a pull request into `trunk`, and squash-merge with a conventional prefix (`feat:`, `fix:`, `docs:`, `chore:`).

- **Open a draft PR early**, so others can see the work is taken.
- **One PR per change**, even a large one.
- **Rebase, don't merge**: rebase onto `origin/trunk`; never merge `trunk` into your branch.
- **File issues** for bugs or improvements outside your change rather than fixing them in passing or leaving a TODO. Keep issue bodies evergreen: edit the context, findings and chosen solution in place.
- **Dependabot** keeps dependencies current; update one by hand only when your work needs it or Dependabot can't (see [Dependencies](#dependencies)).

## Toolchain

[Vite+](https://viteplus.dev) (`vp`) manages Node and pnpm; use it rather than calling them directly (`vp exec <bin>`, not `npx`). The pre-commit hook ([.vite-hooks/pre-commit](../.vite-hooks/pre-commit)) runs `vp staged` (format and lint the staged files) and then `vp run fallow:audit`.

| Command | What it does |
| --- | --- |
| `vp install` | Dependencies, git hooks, and the Effect-patched `tsc` / `oxlint` (`prepare`) |
| `vp check` | Format and lint, type-aware |
| `vp run check` | The type gate: every package, the emitted declarations (`tests/dist-consumer`) and docgen, which type-checks and runs every JSDoc `@example` |
| `vp run -r test:unit` | Unit tests, plus `tests/workerd`: a Resend send run in the real Workers runtime against a stub origin |
| `vp run -r build` | `vp pack` each package's `dist/` |
| `vp run ci` | Everything CI runs, in the same order |
| `vp test run path/to/file` | One test file, from inside its package |

[Fallow](https://docs.fallow.tools) checks module boundaries (`.fallowrc.json`), dead code, complexity and duplication. Use it to polish your work (`vp run fallow`); its findings are guidance, not dogma. The pre-commit `fallow:audit` refreshes the coverage map and fails only on findings your change introduces against `origin/trunk`. Before deleting "unused" code, trace it: `vp exec fallow dead-code --trace <file>:<export>` (or `--trace-dependency <name>`).

## Coding guidelines

- **Effect.** Use Effect (v4) idioms throughout and prefer Effect's own modules (`Option`, `Array`, `Match`, `Schema`, `Config`, `effect/http`, …) to hand-rolled equivalents; convert existing code when you touch it, where practical. Exceptions: non-Effect APIs at the boundary (adapt them at the edge) and hot paths where measurement shows plain code is needed. Absence is `Option`; an options member is `readonly x?: T` (no `| undefined`); wire shapes and Worker `env` records keep their native forms and are adapted at the edge. Read the installed package rather than guessing an API: `node_modules/effect/` ships its source, typings and `ai-docs/`.
- **Exports** follow Effect's layout: one PascalCase module per file (`src/Email.ts`), importable through its own subpath (`./Email`: `exports`, `publishConfig.exports` and the module list in the package's `vite.config.ts`), and re-exported from `index.ts` as a namespace (`export * as Email from "./Email.ts"`).
- **Lint.** Fix findings in code. A rule is relaxed only by a file-scoped override in `vite.config.ts`, with its reason; no inline disables.
- **Providers** go through `effect/http` (`HttpClient`), never `globalThis.fetch` or a vendor SDK, and apply the core's `Http` transport rules. A vendor error body is truncated before it reaches a message, and a credential never appears in one.
- **Comments.** A file-level comment only when it gives real context, in under 50 words. JSDoc where it helps someone reading IntelliSense, adding to the signature rather than restating it; docgen requires `@since` on every export, and runs every `@example`, so an example is a complete program that needs no network. Inline comments only for what the code can't say. Don't reference issues, PRs or CI runs.
- **Tests** check logic: edge cases, regressions, security properties. Don't test what the type system or a lint enforces. Effect tests use `@effect/vitest` (`it.effect`, `it.layer`); other imports come from `vite-plus/test`, never `vitest`. Stub HTTP at the `HttpClient` seam; nothing reaches a vendor.

## Before pushing

Run `vp run ci`, or the gates one at a time: `vp check`, `vp run check`, `vp run -r test:unit`, `vp run -r build`, `pnpm audit --audit-level high` (network). Say in the PR body which gates couldn't run.

CI ([ci.yml](../.github/workflows/ci.yml)) runs `vp run ci` on Node `lts` and `latest`, with a read-only token and no secrets. Workflows pin actions by exact tag, locked to commits by `.github/workflows/actions.lock`: run `gh actions-lock` after changing a `uses:`. `uvx zizmor --offline .github` audits the workflows.

## Changesets

Every change to a published package's behaviour needs a changeset: `vp exec changeset`, then commit the file. Docs-, CI- and tooling-only changes need none. Never version or publish by hand: the Release workflow opens the "chore: version packages" PR and publishes once the owner merges it ([PUBLISHING.md](PUBLISHING.md)).

## Dependencies

Every external version is in the `pnpm-workspace.yaml` catalog; package.json files use `catalog:`, `catalog:peers` / `catalog:alchemy-peers` or `workspace:`. After editing it, run `vp install` and commit `pnpm-lock.yaml`. `effect` is a peer, never a dependency, and its floor is `^4.0.0` unless a package's own dependency needs more.

Dependabot groups the sets that must move together. On those PRs, by hand:

- **Toolchain** (`vite-plus`): run `vp dlx --package=vite-plus@<v> vp migrate --no-interactive` to re-pin `vite` and `vitest`, drop any `minimumReleaseAgeExclude` entries it adds, and move the dev container image tag. `typescript` / `@typescript/native` move only with an `@effect/tsgo` that supports them (see the catalog comment).
- **Effect**: `@effect/docgen` and `@effect/vitest` must land on the `effect` version.
- **Alchemy**: move `catalogs.alchemy-peers` with the dev pins, and `workerd` to the version alchemy resolves.
- **Security overrides** are dropped once their parent requires the fixed version.
