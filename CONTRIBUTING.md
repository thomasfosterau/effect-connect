# Contributing

Maintained by Thomas Foster, with a workflow meant to be approachable for both humans and coding agents. Conventions are in [AGENTS.md](AGENTS.md).

## Setup

Use Node 22.19+, 24.11+ or 26+ (an even-numbered release line; the root `engines.node` is `^22.19.0 || ^24.11.0 || >=26`, the strictest `engines.node` across the dev tree in `pnpm-lock.yaml`, set by `@babel/*` 8 and `undici` 8 via `@effect/docgen`, and `vite-plus`). pnpm does not enforce it, so an older Node fails at runtime rather than at install. CI runs the latest Node. The published packages carry their own, lower `engines`.

`pnpm install` (pnpm 11, pinned by `packageManager`) installs dependencies, the Vite+ git hooks and the Effect-patched `tsc` / `oxlint` (the root `prepare` script). Branching, changesets and the PR rules are in [AGENTS.md](AGENTS.md#branches-and-pull-requests): squash-merge with a conventional prefix (`feat:`, `fix:`, `docs:`, `chore:`).

Open in a Codespace or Dev Container: `.devcontainer/` provisions it with the same hook as agent sessions. The `Dev Container` workflow (`.github/workflows/devcontainer.yml`) builds it in CI whenever its inputs change; to try a change locally, `pnpm dlx @devcontainers/cli@0.89.0 up --workspace-folder .` (needs Docker).

## Git hooks

Hooks are managed by Vite+; the editable [.vite-hooks/pre-commit](.vite-hooks/pre-commit) is committed. **pre-commit** runs `vp staged` (format + lint on staged files). There is no pre-push hook.

## CI expectations

[ci.yml](.github/workflows/ci.yml) runs one job: steps 1–5 of the gates in [AGENTS.md → Verification](AGENTS.md#verification) (the last is `pnpm audit --audit-level high`). Step 6, the fallow audit, is local-only (the pre-PR checklist; a Claude Code session's PreToolUse hook also runs it). [release.yml](.github/workflows/release.yml) runs changesets/action on `trunk`: it opens the "Version Packages" PR while unreleased changesets exist and publishes the packages once it merges, via npm trusted publishing (OIDC) — see [PUBLISHING.md](PUBLISHING.md).

## Pre-PR checklist

1. Run the gates in [AGENTS.md → Verification](AGENTS.md#verification) and note each result in the PR.
2. A changeset (`pnpm changeset`) for every change to a published package's behaviour.
3. `git fetch origin trunk && git rebase origin/trunk`.
4. Docs: `docs/` for the detail of any exported change (and the package `README.md` entry-point table if an entry point is added or removed); the package `AGENTS.md` for a new term or invariant.

## Commands

Invoke tools through `vp` (`vp exec <bin>` for a package binary, `vp run <task>` rather than bare `pnpm run`). CI installs with `pnpm install --frozen-lockfile`.

- `pnpm install` — dependencies, the Vite+ git hooks and the tsgo patch.
- `vp check` — format + lint (Oxfmt + Oxlint, type-aware through oxlint-tsgolint, with `@enfect/oxlint`'s `recommended` Effect rules and `@effect/tsgo`'s preset; every rule is at `error`, with no warn tier; a rule is relaxed only in `vite.config.ts`, with its reason). `vp check --fix` autofixes.
- `vp run check` — the type gate: every package's `check`, the dist-consumer declaration check (which builds `dist/`) and every package's docgen. `vp run --filter ./packages/core check` runs one package's type check.
- `vp run -r test:unit` — unit tests (every network seam stubbed). `vp test run tests/some.test.ts` (from inside the package) runs a single file.
- `vp run test:coverage` — every package's suite in one run, writing the Istanbul map `coverage/coverage-final.json` that `fallow audit` reads for its CRAP scores. Run it before the fallow audit (`vp run fallow:audit`).
- `vp run -r build` — `vp pack` (tsdown) emits each package's `dist/`.
- `vp run -r docgen` — docgen on its own: type-checks and runs every JSDoc `@example` and requires `@since` on every export; writes the gitignored API docs to `packages/*/docs/`.
- `pnpm changeset` — add a changeset.
