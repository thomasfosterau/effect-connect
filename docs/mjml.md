# `@thomasfosterau/effect-connect-mjml`

Detail for the [package README](../packages/mjml/README.md): MJML as a renderer for the [core](./core.md)'s email templates. `template` returns an ordinary `EmailTemplate`, so `EmailTemplate.render`, `toMessage`, `localised` and locale negotiation work exactly as they do for a template built with `EmailTemplate.make`.

## Options

| Option | What it is |
| --- | --- |
| `data` | The schema the data decodes against; data that does not decode fails `EmailTemplateError` before the markup is built. |
| `messages` | Strings per locale (BCP 47 keys), which are also the locales the template supports. `t` is the negotiated locale's entry. Leave it out to render in whichever locale is asked for. |
| `defaultLocale` | The locale used when none requested matches. Default: the first `messages` key, else `"en"`. |
| `subject` | `(data, { locale, t }) => string`. |
| `mjml` | `(data, { locale, t }) => Html`: the email as MJML, `<mjml>` at its root, built with `EmailHtml.html`. |
| `text` | `"derive"` (default) or `(data, { locale, t }) => string`. |
| `validation` | `"strict"` (default) or `"soft"`. |
| `fonts` | Web fonts by name, passed to MJML. |

## Escaping

The markup is the core's `Html`, so every interpolation is escaped unless it is already `Html`: data can't add tags or attributes. Quote attribute values, and pass URLs through `EmailHtml.url` / `imageUrl`, which replace `javascript:` and other unsafe schemes. `EmailHtml.unsafeRaw` remains the only way to splice markup in unescaped.

## Accessibility

MJML already marks its layout tables `role="presentation"`, but leaves the document's language and title to the markup. `template` fills in what the markup left out, and never overrides what it set:

- `lang` and `dir` on `<mjml>` from the negotiated locale, which MJML carries onto `<html>` (`dir="rtl"` for Arabic, Hebrew, Persian, Urdu and the other right-to-left scripts).
- An `<mj-title>` equal to the subject, which becomes the `<title>`.

Give every `<mj-image>` an `alt` (`alt=""` when decorative), and use `<mj-preview>` for the preheader.

## Plain text

`"derive"` runs the core's `EmailText.fromHtml` over the compiled HTML: blocks separated by blank lines, links as `label (url)`, images as their `alt`, the hidden preview, styles and Outlook conditional comments dropped. Pass a function to write it alongside instead.

## Validation and errors

With `validation: "strict"` (the default), any MJML validation error (an unknown tag, a tag in the wrong parent, an invalid attribute) fails `EmailTemplateError`, one issue per error with its line. `"soft"` logs them as a warning and sends what MJML compiled. Markup MJML can't parse, a function that throws, or a `messages` record without the negotiated locale also fail `EmailTemplateError`.

## Runtimes and size

The compiler is `mjml-browser`, MJML's build without a file system, so `mj-include` is not available. It adds about 1 MB gzipped to a Worker bundle, well within Workers' limits on a paid plan but most of the free plan's 3 MB. Pre-compile with the `mjml` CLI and use `EmailTemplate.make` when the bundle has to stay small.
