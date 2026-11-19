#!/usr/bin/env bash
#
# Publish every package whose version is not yet on npm, then tag. `pnpm pack`
# rewrites `catalog:` / `workspace:` specifiers and applies `publishConfig`;
# `npm publish` does the OIDC trusted-publishing exchange. Idempotent.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$root/.release"
rm -rf "$out"
mkdir -p "$out"

for dir in "$root"/packages/*/; do
  name="$(node -p "require('$dir/package.json').name")"
  version="$(node -p "require('$dir/package.json').version")"
  if npm view "$name@$version" version >/dev/null 2>&1; then
    echo "skip: $name@$version is already published"
    continue
  fi
  echo "pack: $name@$version"
  # No lifecycle scripts in the id-token job; `pnpm pack` has no `--ignore-scripts` flag.
  (cd "$dir" && pnpm pack --config.ignore-scripts=true --pack-destination "$out" >/dev/null)
  tarball="$(ls -t "$out"/*.tgz | head -1)"
  echo "publish: $tarball"
  npm publish "$tarball" --access public
  rm -f "$tarball"
done

# Prints the `New tag:` lines the Changesets action turns into tags and releases.
pnpm exec changeset tag
