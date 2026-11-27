# `@thomasfosterau/effect-connect-react-email`

React Email for [`@thomasfosterau/effect-connect`](https://github.com/thomasfosterau/effect-connect/tree/trunk/packages/core#readme): an `EmailTemplate` whose body is a React Email component, with typed data, per-locale messages, accessible `lang` / `dir` / `<title>` defaults and a plain-text part that is derived, rendered by React Email or written alongside. Created using Claude Code; the API is in flux, so expect breaking changes.

## Install

```bash
pnpm add @thomasfosterau/effect-connect-react-email @thomasfosterau/effect-connect @react-email/render react react-dom effect
```

`effect` (`^4.0.0`), `@react-email/render` (`^2.0.0`), `react` and `react-dom` (`^18` or `^19`) are required peer dependencies. Node.js 22 or newer, or Cloudflare Workers.

## Example

```tsx
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Body, Button, Heading, Html } from "@react-email/components";
import { EmailService, EmailTemplate } from "@thomasfosterau/effect-connect";
import { ReactEmail } from "@thomasfosterau/effect-connect-react-email";

const Welcome = ReactEmail.template({
  data: Schema.Struct({ name: Schema.String, url: Schema.String }),
  messages: {
    en: { subject: "Welcome", start: "Get started" },
    fr: { subject: "Bienvenue", start: "Commencer" },
  },
  subject: (_, { t }) => t.subject,
  component: ({ name, url }, { t, locale }) => (
    <Html lang={locale.tag} dir={locale.dir}>
      <Body>
        <Heading>{`${t.subject}, ${name}`}</Heading>
        <Button href={url}>{t.start}</Button>
      </Body>
    </Html>
  ),
});

const program = Effect.gen(function* () {
  const email = yield* EmailService.EmailService;
  const message = yield* EmailTemplate.toMessage(
    Welcome,
    { name: "Ada", url: "https://example.com/start" },
    { from: { email: "noreply@example.com" }, to: [{ email: "ada@example.com" }], locale: "fr-CA" },
  );
  return yield* email.send(message);
});
```

## Entry points

The entry point `.` exports one namespace, `ReactEmail`, which is also the subpath `./ReactEmail`.

| Export | Purpose |
| --- | --- |
| `ReactEmail.template(options)`, `ReactEmail.TemplateOptions`, `ReactEmail.Context`, `ReactEmail.TextOption`, `ReactEmail.NoMessages` | An `EmailTemplate` from a React Email component. |
| `ReactEmail.accessibleDefaults(html, locale, subject)` | Add `lang`, `dir` and `<title>` to a rendered document that lacks them. |

## Documentation

- [React Email reference](https://github.com/thomasfosterau/effect-connect/blob/trunk/docs/react-email.md)
- [Core reference](https://github.com/thomasfosterau/effect-connect/blob/trunk/docs/core.md): templates, locales, escaping, plain text
- [Repository README](https://github.com/thomasfosterau/effect-connect/blob/trunk/README.md)

## License

MIT
