# @thomasfosterau/effect-connect-twilio

## 0.6.0

### Minor Changes

- [#225](https://github.com/thomasfosterau/effect-connect/pull/225) [`929d1dd`](https://github.com/thomasfosterau/effect-connect/commit/929d1dd5cc6ba7619bf9f7e550107e4799b654df) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - The package root now exports two namespaces, `Twilio` and `TwilioConfig`, instead of their members flat. `layer`, `layerConfig`, `resolveTransport`, `configFromEnv` and `TwilioEnv`, which were defined on the root alone, move into the `Twilio` module (and so the `./Twilio` subpath).
  
  Migration: `import * as Twilio from "@thomasfosterau/effect-connect-twilio"` becomes `import { Twilio } from "@thomasfosterau/effect-connect-twilio"`; `Twilio.layer`, `Twilio.resolveTransport`, `Twilio.noop` and `Twilio.toTwilioPayload` read as before. A named root import such as `import { resolveTransport } from "@thomasfosterau/effect-connect-twilio"` becomes `Twilio.resolveTransport`, or the same named import from `@thomasfosterau/effect-connect-twilio/Twilio`. `TwilioConfig`, `TwilioConfigInput` and `DEFAULT_BASE_URL` are `TwilioConfig.*`.

### Patch Changes

- [#185](https://github.com/thomasfosterau/effect-connect/pull/185) [`ec80a94`](https://github.com/thomasfosterau/effect-connect/commit/ec80a94f90d9580f2d7abda8999bf3643a73d7ce) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - `rejectionMessage` now reads only a bounded prefix of a vendor's error body and cancels the rest, so a huge or never-ending error body is no longer buffered whole before it is truncated. The message is unchanged: the status, then at most 200 characters with any secrets redacted. A failed read or cancel still leaves the status.

- [#183](https://github.com/thomasfosterau/effect-connect/pull/183) [`23ecaa8`](https://github.com/thomasfosterau/effect-connect/commit/23ecaa86e1e18aa47d1057faec5e6ad198a7c489) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - `executeWithSecretUrl` now redacts a vendor error body before truncating it, so a secret that straddles the 200-character bound can no longer leave its leading part in the error message. `rejectionMessage` takes an optional `secrets` list and applies the same order; the Twilio provider uses it instead of its own copy.
- Updated dependencies [[`ec80a94`](https://github.com/thomasfosterau/effect-connect/commit/ec80a94f90d9580f2d7abda8999bf3643a73d7ce), [`929d1dd`](https://github.com/thomasfosterau/effect-connect/commit/929d1dd5cc6ba7619bf9f7e550107e4799b654df), [`23ecaa8`](https://github.com/thomasfosterau/effect-connect/commit/23ecaa86e1e18aa47d1057faec5e6ad198a7c489), [`8ad498f`](https://github.com/thomasfosterau/effect-connect/commit/8ad498f982daaf7ef367ea617e047902c98f3e2c)]:
  - @thomasfosterau/effect-connect@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [[`8ad9ffb`](https://github.com/thomasfosterau/effect-connect/commit/8ad9ffbc48c0a607a40de1b952e10bf74bb361a3), [`a5da9a1`](https://github.com/thomasfosterau/effect-connect/commit/a5da9a166a858b5a15c076b670a596abc5953a3e)]:
  - @thomasfosterau/effect-connect@0.5.0

## 0.4.0

### Minor Changes

- [#179](https://github.com/thomasfosterau/effect-connect/pull/179) [`cc929dc`](https://github.com/thomasfosterau/effect-connect/commit/cc929dcd110cb7fb419670fdb8d0fc85a0a683fe) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - New package: the Twilio provider, the `SmsService` over Twilio's Messages API with `effect/http` and no SDK. Basic auth with a `Redacted` token, redirects refused, truncated error bodies with the credential redacted, the sender taken from the message, the configured `from` or a Messaging Service, `noop`, `layerConfig` and `resolveTransport(env)` for Workers.
