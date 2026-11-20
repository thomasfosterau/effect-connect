# Publishing

Releases use [Changesets](https://github.com/changesets/changesets) and npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC); there is no `NPM_TOKEN`. The security rationale is in [SECURITY.md](SECURITY.md).

## Flow

1. Each change to a published package carries a changeset ([CONTRIBUTING.md](CONTRIBUTING.md#changesets)).
2. On a push to `trunk`, [release.yml](../.github/workflows/release.yml) opens or updates the "chore: version packages" PR (`vp run changeset:version`) and assigns it to the owner.
3. Merging that PR publishes: `vp run release` builds every package, publishes each unpublished version with `vp pm publish -r --access public --no-git-checks -- --ignore-scripts` (pnpm rewrites `catalog:` / `workspace:` specifiers, applies `publishConfig`, publishes in dependency order and does the OIDC trusted-publishing exchange with provenance; no npm CLI and no publish script), then `changeset git-tag` tags each untagged version and reports the tags to the Changesets action, which pushes them and creates the GitHub releases. Already-published versions are skipped and a failed publish stops before tagging, so a partial run can be re-run.

`vp run release:dry-run` builds and lists what `vp pm publish` would publish, without publishing or tagging.

Every release job first verifies `.github/workflows/actions.lock`, installs with `--ignore-scripts` and no cache, and sets `pnpm_config_verify_deps_before_run: "false"` so pnpm can't re-install with lifecycle scripts mid-job. Only `publish` holds `id-token: write`, and only it runs in the protected `release` environment.

Provenance is left to pnpm: under trusted publishing it attaches provenance to a public package from a public repository on its own. Don't force it with `--provenance`; from a private repository, pass `--no-provenance` instead.

## One-time setup

- **Settings → Actions → General**: allow GitHub Actions to create pull requests (for the version PR).
- **npm**: the first release of each package is published by hand, from a clean `trunk` as `thomasfosterau`: `vp install --frozen-lockfile`, `vp run release:dry-run`, then `vp run release`, then `git push origin --tags` (never from a package directory); then, on each package's **Settings → Trusted Publisher**, add GitHub Actions, repository `thomasfosterau/effect-connect`, workflow `release.yml`, environment `release`, and revoke any automation tokens.
- **Settings → Environments → `release`**: required reviewer (the owner), deployments from `trunk` only.
- **`trunk`**: require pull requests and the `ci (node lts)` / `ci (node latest)` checks.
