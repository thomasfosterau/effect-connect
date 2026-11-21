---
"@thomasfosterau/effect-connect": minor
"@thomasfosterau/effect-connect-resend": minor
---

Provider-side email templates: `EmailMessage` gains an optional `template` (`EmailProviderTemplate`: an id or alias and its variables), which excludes `text` and `html`, and `EmailTemplate.provider` builds one from typed data with per-locale ids through the same `toMessage`. Resend sends it as its `template` payload.
