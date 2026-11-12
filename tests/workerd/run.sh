#!/usr/bin/env bash
#
# Bundle the Worker under test (src/worker.ts, with the workspace packages and
# `effect` inlined: workerd resolves no node_modules) and run its `test`
# handlers in the real Workers runtime. A missing workerd binary is a failure,
# never a skip: this is the only gate that runs the packages where the
# consuming applications deploy them.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

missing() {
  echo "tests/workerd: no workerd binary ($1); the Workers runtime test cannot run" >&2
  exit 1
}

# The `workerd` package resolves its platform binary on import and throws
# when the `@cloudflare/workerd-<platform>` optional dependency is absent.
workerd="$(node -p "require('workerd').default" 2>/dev/null)" ||
  missing "the workerd package could not resolve one for this platform"
[ -x "$workerd" ] || missing "'$workerd' is not executable"

rm -rf .build
vp pack src/worker.ts --no-config --platform neutral --format esm --out-dir .build --logLevel warn
"$workerd" test config.capnp --verbose
