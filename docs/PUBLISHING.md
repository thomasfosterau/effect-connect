# Publishing

Releases use [Changesets](https://github.com/changesets/changesets) and npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC); there is no `NPM_TOKEN`. The security rationale is in [SECURITY.md](SECURITY.md).

## Flow

1. Each change to a published package carries a changeset ([CONTRIBUTING.md](CONTRIBUTING.md#changesets)).
2. On a push to `trunk`, [release.yml](../.github/workflows/release.yml) opens or updates the "chore: version packages" PR (`vp run changeset:version`) and assigns it to the owner.
3. Merging that PR publishes: `vp run changeset:publish` builds every package, publishes each unpublished version with `pnpm -r publish --ignore-scripts` (which rewrites `catalog:` / `workspace:` specifiers, applies `publishConfig`, and does the OIDC trusted-publishing exchange with provenance; no npm CLI), and tags it (`changeset tag`). Already-published versions are skipped, so a partial run can be re-run.

Every release job first verifies `.github/workflows/actions.lock`, installs with `--ignore-scripts` and no cache, and sets `pnpm_config_verify_deps_before_run: "false"` so pnpm can't re-install with lifecycle scripts mid-job. Only `publish` holds `id-token: write`, and only it runs in the protected `release` environment.

Provenance is left to pnpm: under trusted publishing it attaches provenance to a public package from a public repository on its own. Don't force it with `--provenance`; from a private repository, pass `--no-provenance` instead.

## One-time setup

- **Settings → Actions → General**: allow GitHub Actions to create pull requests (for the version PR).
- **npm**: the first release of each package is published by hand; then, on each package's **Settings → Trusted Publisher**, add GitHub Actions, repository `thomasfosterau/effect-connect`, workflow `release.yml`, environment `release`, and revoke any automation tokens.
- **Settings → Environments → `release`**: required reviewer (the owner), deployments from `trunk` only.
- **`trunk`**: require pull requests and the `ci (node lts)` / `ci (node latest)` checks.
