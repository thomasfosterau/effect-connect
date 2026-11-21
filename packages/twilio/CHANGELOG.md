# @thomasfosterau/effect-connect-twilio

## 0.5.0

### Patch Changes

- Updated dependencies [[`8ad9ffb`](https://github.com/thomasfosterau/effect-connect/commit/8ad9ffbc48c0a607a40de1b952e10bf74bb361a3), [`a5da9a1`](https://github.com/thomasfosterau/effect-connect/commit/a5da9a166a858b5a15c076b670a596abc5953a3e)]:
  - @thomasfosterau/effect-connect@0.5.0

## 0.4.0

### Minor Changes

- [#179](https://github.com/thomasfosterau/effect-connect/pull/179) [`cc929dc`](https://github.com/thomasfosterau/effect-connect/commit/cc929dcd110cb7fb419670fdb8d0fc85a0a683fe) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - New package: the Twilio provider, the `SmsService` over Twilio's Messages API with `effect/http` and no SDK. Basic auth with a `Redacted` token, redirects refused, truncated error bodies with the credential redacted, the sender taken from the message, the configured `from` or a Messaging Service, `noop`, `layerConfig` and `resolveTransport(env)` for Workers.
