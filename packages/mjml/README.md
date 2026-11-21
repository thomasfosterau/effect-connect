# `@thomasfosterau/effect-connect-mjml`

MJML for [`@thomasfosterau/effect-connect`](https://github.com/thomasfosterau/effect-connect/tree/trunk/packages/core#readme): an `EmailTemplate` whose body is MJML, written with the core's escaping `html` tag, with typed data, per-locale messages, accessible `lang` / `dir` / `<title>` defaults and a plain-text part that is derived or written alongside. It compiles with `mjml-browser`, so it runs on Cloudflare Workers and in browsers as well as on Node. Created using Claude Code; the API is in flux, so expect breaking changes.

## Install

```bash
pnpm add @thomasfosterau/effect-connect-mjml @thomasfosterau/effect-connect effect
```

`effect` (`^4.0.0`) is a required peer dependency. Node.js 22 or newer, or Cloudflare Workers.

## Example

```ts
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { EmailHtml, EmailService, EmailTemplate } from "@thomasfosterau/effect-connect";
import * as Mjml from "@thomasfosterau/effect-connect-mjml";

const { html, url } = EmailHtml;

const Welcome = Mjml.template({
  data: Schema.Struct({ name: Schema.String, start: Schema.String }),
  messages: {
    en: { subject: "Welcome", cta: "Get started" },
    fr: { subject: "Bienvenue", cta: "Commencer" },
  },
  subject: (_, { t }) => t.subject,
  mjml: ({ name, start }, { t }) =>
    html` <mjml>
      <mj-head><mj-preview>${t.subject}, ${name}</mj-preview></mj-head>
      <mj-body>
        <mj-section>
          <mj-column>
            <mj-text font-size="20px">${t.subject}, ${name}</mj-text>
            <mj-button href="${url(start)}">${t.cta}</mj-button>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>`,
});

const program = Effect.gen(function* () {
  const email = yield* EmailService;
  const message = yield* EmailTemplate.toMessage(
    Welcome,
    { name: "Ada", start: "https://example.com/start" },
    { from: { email: "noreply@example.com" }, to: [{ email: "ada@example.com" }], locale: "fr-CA" },
  );
  return yield* email.send(message);
});
```

## Entry points

The package has the single entry point `.`, plus `./Mjml`.

| Export | Purpose |
| --- | --- |
| `template(options)`, `TemplateOptions`, `Context`, `TextOption`, `NoMessages` | An `EmailTemplate` from MJML. |
| `accessibleDefaults(source, locale, subject)` | Add `lang`, `dir` and `<mj-title>` to MJML that lacks them. |

## Documentation

- [MJML reference](https://github.com/thomasfosterau/effect-connect/blob/trunk/docs/mjml.md)
- [Core reference](https://github.com/thomasfosterau/effect-connect/blob/trunk/docs/core.md): templates, locales, escaping, plain text
- [Repository README](https://github.com/thomasfosterau/effect-connect/blob/trunk/README.md)

## License

MIT
