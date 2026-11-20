---
"@thomasfosterau/effect-connect-alchemy-cloudflare": minor
---

Add `twilioBindings` and `twilioBindingsConfig` (also at the new `./Twilio` subpath): the Worker bindings `effect-connect-twilio`'s `resolveTransport(env)` reads. `TWILIO_ACCOUNT_SID` is a plain binding, `TWILIO_AUTH_TOKEN` is `Redacted` so it deploys as a secret, and `TWILIO_FROM` / `TWILIO_MESSAGING_SERVICE_SID` are in the record only when set and non-blank. The Config form fails when the SID or token is missing.
