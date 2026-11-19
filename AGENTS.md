# AGENTS.md

Read [README.md](README.md) and [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) first; this file adds only what is specific to agents. Each package's `AGENTS.md` states its boundary and invariants.

- Use Effect idioms and Effect v4's own modules; read `node_modules/effect` rather than guessing an API.
- You may open PRs in this repository (use the GitHub MCP tools or `gh`). Out-of-scope work you notice: file an issue and move on.
- **Node accepting something proves nothing about Workers** (Workers rejects `redirect: "error"`, for one). A change to how a provider builds or sends a request is done only when `tests/workerd` passes, and a new provider adds its send there.
- **The core carries no provider or application vocabulary.** A new channel is a model module plus a service module in the core; a provider is a package of its own.
- Say in the PR body which gates you couldn't run.
