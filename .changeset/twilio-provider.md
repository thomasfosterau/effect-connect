---
"@thomasfosterau/effect-connect-twilio": minor
---

New package: the Twilio provider, the `SmsService` over Twilio's Messages API with `effect/http` and no SDK. Basic auth with a `Redacted` token, redirects refused, truncated error bodies with the credential redacted, the sender taken from the message, the configured `from` or a Messaging Service, `noop`, `layerConfig` and `resolveTransport(env)` for Workers.
