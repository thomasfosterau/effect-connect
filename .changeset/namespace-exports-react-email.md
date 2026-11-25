---
"@thomasfosterau/effect-connect-react-email": minor
---

The package root now exports one namespace, `ReactEmail`, instead of its members flat. The `./ReactEmail` subpath is unchanged.

Migration: `import * as ReactEmail from "@thomasfosterau/effect-connect-react-email"` becomes `import { ReactEmail } from "@thomasfosterau/effect-connect-react-email"`; `ReactEmail.template` and `ReactEmail.accessibleDefaults` read as before. A named root import such as `import { template } from "@thomasfosterau/effect-connect-react-email"` becomes `ReactEmail.template`, or the same named import from `@thomasfosterau/effect-connect-react-email/ReactEmail`.
