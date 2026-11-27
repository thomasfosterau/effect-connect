# @thomasfosterau/effect-connect-alchemy-cloudflare

## 0.6.0

### Minor Changes

- [#225](https://github.com/thomasfosterau/effect-connect/pull/225) [`929d1dd`](https://github.com/thomasfosterau/effect-connect/commit/929d1dd5cc6ba7619bf9f7e550107e4799b654df) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - The package root now exports three namespaces, `Bindings`, `Resend` and `Twilio`, instead of their members flat. The subpaths are unchanged.
  
  Migration: `resendBindings`, `resendBindingsConfig`, `ResendBindings` and `ResendBindingsInput` are `Resend.*`; the Twilio builders and types are `Twilio.*`; `WorkerBindings` and `Deployed` are `Bindings.*`. Or keep the named imports and take them from `./Resend`, `./Twilio` or `./Bindings`. Alias one `Resend` (or `Twilio`) when a module imports this package's and the provider's.

## 0.4.0

### Minor Changes

- [#184](https://github.com/thomasfosterau/effect-connect/pull/184) [`218fc26`](https://github.com/thomasfosterau/effect-connect/commit/218fc265c6a89aec218215cfce80508d6ef4be1c) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - Add `twilioBindings` and `twilioBindingsConfig` (also at the new `./Twilio` subpath): the Worker bindings `effect-connect-twilio`'s `resolveTransport(env)` reads. `TWILIO_ACCOUNT_SID` is a plain binding, `TWILIO_AUTH_TOKEN` is `Redacted` so it deploys as a secret, and `TWILIO_FROM` / `TWILIO_MESSAGING_SERVICE_SID` are in the record only when set and non-blank. The Config form fails when the SID or token is missing.

## 0.3.0

### Minor Changes

- [#171](https://github.com/thomasfosterau/effect-connect/pull/171) [`c80c9ee`](https://github.com/thomasfosterau/effect-connect/commit/c80c9ee77dde4cfc0fcd345fdc2a76c307591300) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - Each module is now importable from its own subpath (`@thomasfosterau/effect-connect/Email`, `@thomasfosterau/effect-connect-resend/Resend`, …), alongside the root entry. Doc comments are shorter.

## 0.2.0

### Patch Changes

- [#139](https://github.com/thomasfosterau/effect-connect/pull/139) [`a36997e`](https://github.com/thomasfosterau/effect-connect/commit/a36997ee7d23b7c8c12758a68012c6b12089f496) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - The published tarballs now include `CHANGELOG.md`, so the release notes can be read from `node_modules`.

## 0.1.0

### Minor Changes

- [#93](https://github.com/thomasfosterau/effect-connect/pull/93) [`648a433`](https://github.com/thomasfosterau/effect-connect/commit/648a4333a5c1df54406e9e055bdc438b7e67f522) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - New package: deploy-time bindings for Cloudflare Workers deployed with Alchemy's Cloudflare provider (`@alchemy.run/cloudflare`). Each provider has a builder (`resendBindings`, for the Resend provider) and a `…BindingsConfig` form, which reads the same names through `effect/Config` on the deploy machine. Each returns the Worker `env` record that the provider's `resolveTransport(env)` / `layerConfig` reads, under the provider's own keys. Secrets are `Redacted` values, and unset optional values are left out. The types are the Cloudflare provider's: `WorkerBindings<B>` checks that every value is a `Cloudflare.WorkerBindingResource`, and `Deployed<B>` is `Cloudflare.InferEnv<B>`, the `env` a Worker bound with the record receives (an optional binding stays an optional `string`). `@alchemy.run/cloudflare` and `alchemy` (both exactly 2.0.0-beta.85) are required peers, and the `effect` peer is `^4.1.0`, the range they require.

### Patch Changes

- [#103](https://github.com/thomasfosterau/effect-connect/pull/103) [`d22f8e8`](https://github.com/thomasfosterau/effect-connect/commit/d22f8e856f3c82b0bcc6ae454398f63be8ecb2cd) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - Spell `Redacted.Redacted<string>` as `Redacted.Redacted` (its default type argument) in the emitted declarations. No behaviour change.
