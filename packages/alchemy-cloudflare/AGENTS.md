# @thomasfosterau/effect-connect-alchemy-cloudflare

Deploy-time Worker `env` binding builders for Alchemy's Cloudflare provider: one builder per provider (`resendBindings`) and its `effect/Config` form (`…BindingsConfig`). Another Alchemy provider gets a package of its own.

## Boundary

- Imports `effect` at runtime and `@alchemy.run/cloudflare` for types only (`import type`), so the emitted `.js` imports nothing from it. No workspace package outside the tests.
- `@alchemy.run/cloudflare`, `alchemy` and `effect` are required peers (`catalogs.alchemy-peers`), moved with the dev pins.
- Binds credentials; never provisions vendor resources.

## Invariants

- **Keys are each provider's env contract** (`ResendEnv`); `tests/alchemy.test.ts` asserts every record, its `Deployed` view and `Cloudflare.InferEnv` against it, and runs the provider's resolver on it.
- **Secrets are `Redacted`** (deployed as `secret_text`); plain values are strings.
- **An unset optional value is absent from the record**, never `undefined` (deployed as JSON) or `""`.
