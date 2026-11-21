---
"@thomasfosterau/effect-connect-mjml": minor
---

New package: MJML as an `EmailTemplate` renderer. `template` builds a core `EmailTemplate` from MJML written with the core's escaping `html` tag, with typed data, per-locale messages, `lang` / `dir` / `<mj-title>` filled in from the negotiated locale and subject, strict validation by default, and a plain-text part that is derived or written alongside. It compiles with `mjml-browser`, so it runs on Workers.
