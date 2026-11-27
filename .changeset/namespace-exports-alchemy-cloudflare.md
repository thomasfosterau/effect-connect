---
"@thomasfosterau/effect-connect-alchemy-cloudflare": minor
---

The package root now exports three namespaces, `Bindings`, `Resend` and `Twilio`, instead of their members flat. The subpaths are unchanged.

Migration: `resendBindings`, `resendBindingsConfig`, `ResendBindings` and `ResendBindingsInput` are `Resend.*`; the Twilio builders and types are `Twilio.*`; `WorkerBindings` and `Deployed` are `Bindings.*`. Or keep the named imports and take them from `./Resend`, `./Twilio` or `./Bindings`. Alias one `Resend` (or `Twilio`) when a module imports this package's and the provider's.
