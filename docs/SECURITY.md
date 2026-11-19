# Security

## Reporting a vulnerability

Report vulnerabilities privately through GitHub's [Report a vulnerability](https://github.com/thomasfosterau/effect-connect/security/advisories/new) form, not a public issue. Include a description, reproduction steps and the affected version.

## What the providers guarantee

- A provider sends to a fixed host; a configurable base URL exists for test stubs, never request input.
- Redirects are refused (`redirect: "manual"`, then any 3xx fails unread), so a hijacked vendor host can't receive the credential.
- A vendor error body is truncated to 200 characters before it reaches an error message, and a credential never appears in one.
- The no-op layers log no recipient and no body.

## Supply chain

- **No long-lived npm token**: trusted publishing (OIDC) from a protected, manually approved `release` environment ([PUBLISHING.md](PUBLISHING.md)).
- **No install scripts in release jobs**: `--ignore-scripts`, no shared cache, and no pnpm re-install mid-job. `allowBuilds` in `pnpm-workspace.yaml` names the only dependencies whose scripts run anywhere.
- **Locked actions**: every action is pinned by exact tag and locked to a commit by `.github/workflows/actions.lock`; nothing publishes unless it verifies.
- **Least privilege**: workflows default to `permissions: {}`; CI holds a read-only token and no secrets, so Dependabot PRs run it safely.
- **Locked dependencies**: frozen-lockfile installs; pnpm and Dependabot both refuse versions younger than a day.
