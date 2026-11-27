---
"@thomasfosterau/effect-connect-mjml": minor
---

The package root now exports one namespace, `Mjml`, instead of its members flat. The `./Mjml` subpath is unchanged.

Migration: `import * as Mjml from "@thomasfosterau/effect-connect-mjml"` becomes `import { Mjml } from "@thomasfosterau/effect-connect-mjml"`; `Mjml.template` and `Mjml.accessibleDefaults` read as before. A named root import such as `import { template } from "@thomasfosterau/effect-connect-mjml"` becomes `Mjml.template`, or the same named import from `@thomasfosterau/effect-connect-mjml/Mjml`.
