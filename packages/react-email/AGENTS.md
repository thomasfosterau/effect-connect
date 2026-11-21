# @thomasfosterau/effect-connect-react-email

The React Email renderer: `template` builds the core's `EmailTemplate` from a React Email component, rendered with `@react-email/render`. Peers: `effect`, `@react-email/render`, `react`, `react-dom`.

## Boundary

Imports the core only; never a provider. Built on the core's `EmailTemplate.fromRenderer`, so rendering, locale negotiation, data decoding and `toMessage` stay the core's.

## Invariants

- **Accessible defaults fill gaps, never override**: `lang` / `dir` on `<html>` from the negotiated locale and a `<title>` equal to the subject, only where the component set none.
- **Every failure is an `EmailTemplateError`**: a throwing component, subject or a missing locale; nothing escapes as a defect.
- **The plain text is configurable** like the core's: derived with `EmailText.fromHtml` (default), React Email's `toPlainText`, or written alongside.
- **Runs on Workers**: `tests/workerd` renders a component in the real runtime, through react-dom's Workers build.
