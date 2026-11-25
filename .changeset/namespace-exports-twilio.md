---
"@thomasfosterau/effect-connect-twilio": minor
---

The package root now exports two namespaces, `Twilio` and `TwilioConfig`, instead of their members flat. `layer`, `layerConfig`, `resolveTransport`, `configFromEnv` and `TwilioEnv`, which were defined on the root alone, move into the `Twilio` module (and so the `./Twilio` subpath).

Migration: `import * as Twilio from "@thomasfosterau/effect-connect-twilio"` becomes `import { Twilio } from "@thomasfosterau/effect-connect-twilio"`; `Twilio.layer`, `Twilio.resolveTransport`, `Twilio.noop` and `Twilio.toTwilioPayload` read as before. A named root import such as `import { resolveTransport } from "@thomasfosterau/effect-connect-twilio"` becomes `Twilio.resolveTransport`, or the same named import from `@thomasfosterau/effect-connect-twilio/Twilio`. `TwilioConfig`, `TwilioConfigInput` and `DEFAULT_BASE_URL` are `TwilioConfig.*`.
