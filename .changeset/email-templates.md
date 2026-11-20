---
"@thomasfosterau/effect-connect": minor
---

Email templates: `EmailTemplate` renders Schema-typed data into a subject, an accessible HTML document and a plain-text body (written alongside or derived from the HTML), in a locale negotiated by BCP 47 lookup, and `toMessage` turns that into an `EmailMessage`. `EmailHtml` is the escaping `html` tag with URL sanitising, the document shell (`lang`, `dir`, a `<title>` equal to the subject, a hidden preheader) and accessible helpers; `EmailText` has the `text` tag and `fromHtml`. Rendering fails `EmailTemplateError`.
