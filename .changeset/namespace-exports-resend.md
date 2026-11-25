---
"@thomasfosterau/effect-connect-resend": minor
---

The package root now exports two namespaces, `Resend` and `ResendConfig`, instead of their members flat. `layer`, `layerConfig`, `resolveTransport`, `apiKeyFromEnv` and `ResendEnv`, which were defined on the root alone, move into the `Resend` module (and so the `./Resend` subpath).

Migration: `import * as Resend from "@thomasfosterau/effect-connect-resend"` becomes `import { Resend } from "@thomasfosterau/effect-connect-resend"`; `Resend.layer`, `Resend.resolveTransport`, `Resend.noop` and `Resend.toResendPayload` read as before. A named root import such as `import { resolveTransport } from "@thomasfosterau/effect-connect-resend"` becomes `Resend.resolveTransport`, or the same named import from `@thomasfosterau/effect-connect-resend/Resend`. `ResendConfig`, `ResendConfigInput` and `DEFAULT_BASE_URL` are `ResendConfig.*`.
