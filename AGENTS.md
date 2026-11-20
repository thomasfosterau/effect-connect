# AGENTS.md

Read [README.md](README.md) and [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) first; this file adds only what is specific to agents. Each package's `AGENTS.md` states its boundary and invariants.

- Use Effect idioms and Effect v4's own modules; read `node_modules/effect` rather than guessing an API.
- You may open PRs in this repository (use the GitHub MCP tools or `gh`). Out-of-scope work you notice: file an issue and move on.
- **Node accepting something proves nothing about Workers** (Workers rejects `redirect: "error"`, for one). A change to how a provider builds or sends a request is done only when `tests/workerd` passes, and a new provider adds its send there.
- **The core carries no provider or application vocabulary.** A new channel is a model module plus a service module in the core; a provider is a package of its own.
- **Publish only through the Release workflow** (`vp run release`: `vp pm publish -r`, then `changeset git-tag`; `changeset:publish` is gone). Release-path registry calls go through `vp pm`, never `npm` / `pnpm` directly.
- Say in the PR body which gates you couldn't run.

## Fallow

The `fallow` agent skill is linked into `.claude/skills/` from the installed `fallow` package after `vp install`; repository-specific rules (the pre-commit audit, tracing before deleting) are in docs/CONTRIBUTING.md.
