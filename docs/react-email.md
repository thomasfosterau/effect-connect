# `@thomasfosterau/effect-connect-react-email`

Detail for the [package README](../packages/react-email/README.md): React Email as a renderer for the [core](./core.md)'s email templates. `template` returns an ordinary `EmailTemplate`, so `EmailTemplate.render`, `toMessage`, `localised` and locale negotiation work exactly as they do for a template built with `EmailTemplate.make`. It runs on Cloudflare Workers (through react-dom's Workers build) as well as on Node.

## Options

| Option | What it is |
| --- | --- |
| `data` | The schema the data decodes against; data that does not decode fails `EmailTemplateError` before the component runs. |
| `messages` | Strings per locale (BCP 47 keys), which are also the locales the template supports. `t` is the negotiated locale's entry. Leave it out to render in whichever locale is asked for. |
| `defaultLocale` | The locale used when none requested matches. Default: the first `messages` key, else `"en"`. |
| `subject` | `(data, { locale, t }) => string`. |
| `component` | `(data, { locale, t }) => ReactNode`, the email with `<Html>` at its root. |
| `text` | `"derive"` (default), `"react-email"` or `(data, { locale, t }) => string`. |

## Accessibility

React Email leaves the document's language and title to the component. `template` fills in what the component left out, and never overrides what it set:

- `lang` and `dir` on `<html>` from the negotiated locale (`dir="rtl"` for Arabic, Hebrew, Persian, Urdu and the other right-to-left scripts). Pass `locale.tag` and `locale.dir` to `<Html>` to set them yourself.
- A `<title>` equal to the subject, which screen readers announce and some clients show.

Everything inside the body (alt text, link labels, heading order, `role="presentation"` on layout tables, which React Email's components already set) is the component's.

## Plain text

- `"derive"` runs the core's `EmailText.fromHtml` over the rendered HTML: blocks separated by blank lines, list markers, links as `label (url)`, images as their `alt`, hidden content (such as `<Preview>`) dropped.
- `"react-email"` uses React Email's own `toPlainText`.
- A function writes the text alongside the component, for when the plain part should read differently.

## Errors

A component or subject that throws, or a `messages` record without the negotiated locale, fails `EmailTemplateError`; React and `@react-email/render` errors never escape as defects.
