# @thomasfosterau/effect-connect-mjml

The MJML renderer: `template` builds the core's `EmailTemplate` from MJML markup, compiled with `mjml-browser`. Peer: `effect`. Dependencies: `mjml-browser`, and `cheerio`, which `mjml-browser` requires without declaring.

## Boundary

Imports the core only; never a provider. Built on the core's `EmailTemplate.fromRenderer`, so rendering, locale negotiation, data decoding and `toMessage` stay the core's.

## Invariants

- **`mjml-browser`, never `mjml`**: the Node build reads the file system (`mj-include`, `.mjmlconfig`); the browser build runs on Workers. `tests/workerd` compiles a template in the real runtime.
- **Markup is `EmailHtml.Html`**: the `mjml` option returns the core's escaped-by-construction `html`, so data can't inject tags; `unsafeRaw` stays the only way around it.
- **Accessible defaults fill gaps, never override**: `lang` / `dir` on `<mjml>` from the negotiated locale and an `<mj-title>` equal to the subject, only where the markup set none.
- **Validation is strict by default**: any MJML validation error fails the render; `"soft"` logs them and sends what compiled.
- **Every failure is an `EmailTemplateError`**: markup that doesn't parse or validate, a throwing function, or a missing locale; nothing escapes as a defect.
