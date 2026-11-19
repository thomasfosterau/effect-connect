# Publishing

Releases use [Changesets](https://github.com/changesets/changesets) and npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC); there is no `NPM_TOKEN`. The security rationale is in [SECURITY.md](SECURITY.md).

## Flow

1. Each change to a published package carries a changeset ([CONTRIBUTING.md](CONTRIBUTING.md#changesets)).
2. On a push to `trunk`, [release.yml](../.github/workflows/release.yml) opens or updates the "chore: version packages" PR (`vp run changeset:version`) and assigns it to the owner.
3. Merging that PR publishes: `vp run changeset:publish` builds every package and runs [scripts/release.sh](../scripts/release.sh), which packs each unpublished version with `pnpm pack` (which rewrites `catalog:` / `workspace:` specifiers and applies `publishConfig`), publishes it with `npm publish`, and tags it. Already-published versions are skipped, so a partial run can be re-run.

Every release job first verifies `.github/workflows/actions.lock`, installs with `--ignore-scripts` and no cache, and sets `pnpm_config_verify_deps_before_run: "false"` so pnpm can't re-install with lifecycle scripts mid-job. Only `publish` holds `id-token: write`, and only it runs in the protected `release` environment.

Provenance is left to npm: under trusted publishing it is attached once the repository and package are public. Don't force it (`--provenance` or `NPM_CONFIG_PROVENANCE=true`): from a private repository the publish fails.

## One-time setup

- **Settings → Actions → General**: allow GitHub Actions to create pull requests (for the version PR).
- **npm**: the first release of each package is published by hand; then, on each package's **Settings → Trusted Publisher**, add GitHub Actions, repository `thomasfosterau/effect-connect`, workflow `release.yml`, environment `release`, and revoke any automation tokens.
- **Settings → Environments → `release`**: required reviewer (the owner), deployments from `trunk` only.
- **`trunk`**: require pull requests and the `ci (node lts)` / `ci (node latest)` checks.
