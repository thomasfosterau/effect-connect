# Claude Code

@../AGENTS.md

@../CONTRIBUTING.md

@../README.md

Only what is specific to Claude Code lives here; everything else is in the three files above. Each package's `CLAUDE.md` imports that package's `AGENTS.md`.

## Hooks and settings

`.claude/settings.json` configures three hooks and the enabled plugins.

- **SessionStart** (`.claude/hooks/session-start.sh`, also the devcontainer's `postCreateCommand`) installs the global Vite+ CLI at the catalog's `vite-plus` pin with the official installer (npm-provenance and SHA-512 checked; it needs `vite.plus` and `viteplus.dev` on the environment's allowlist), links `vp` and `vpx` into `~/.local/bin` (the CLI lives under `$VP_HOME` when set, as in the Vite+ container image, else `~/.local/share/vite-plus`), and syncs dependencies against the lockfile with `vp install --frozen-lockfile`. It removes the `fallow` / `tsx` shims and the walking `vp` shim earlier versions put there. Everything else goes through Vite+: `vp exec fallow …` for fallow, `vpx <file>.ts` for scripts (`tsx` is installed only because `@effect/docgen` requires it as a peer and runs it itself). If the installer can't run, `vp` falls back to this checkout's `node_modules` copy. The global `vp` delegates to each checkout's own `vite-plus`, worktrees included. It hydrates no secrets, and none are needed: every gate runs offline with the network seams stubbed.
- **PostToolUse** runs `vp fmt --write` on every TS/JS (including `.tsx`/`.jsx`/`.mjs`/`.cjs`), CSS, JSON or Markdown file you edit.
- **PreToolUse** (`.claude/hooks/fallow-gate.sh`) blocks `git commit` / `git push` when `fallow audit --base origin/trunk` fails. It runs only in this project and its `.claude/worktrees/<name>` checkouts (judged on the checkout's top level, so a commit from a subdirectory is still audited, and neither a repository nested inside a worktree nor a separate clone placed at a worktree path, which shares no git directory with this project, is trusted), with fallow as `vp exec fallow` (the checkout's own pinned copy); from any other tree it skips with a notice and runs none of that tree's tooling. It never refreshes the coverage map: run `vp run test:coverage` first.

## Worktrees

Worktrees live under `.claude/worktrees/` (gitignored), one per branch.

## Session limits

Won't run in a session: publishing (only the Release workflow's OIDC identity can).
