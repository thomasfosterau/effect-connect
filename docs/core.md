# `@thomasfosterau/effect-connect`

Detail for the [package README](../packages/core/README.md): one message model and one service per channel (`EmailService`, `SmsService`, `WhatsAppService`, `ChatService`), and their errors. [Resend](./resend.md) implements email and [Twilio](./twilio.md) SMS; [effect-chat](./effect-chat.md) implements chat over Effect's `effect/chat` adapters; no provider in this repository implements WhatsApp yet, so provide your own layer for it.

## Usage

Each channel is its own service, so an application that sends only email never provides an SMS layer, and a missing provider is a type error rather than a failure at the first send. Providers talk HTTP through Effect's `HttpClient`, so a test stubs that seam.

```ts
import * as Effect from "effect/Effect";
import { EmailService, type EmailMessage } from "@thomasfosterau/effect-connect";

const welcome = (to: string): EmailMessage => ({
  from: { email: "noreply@example.com", name: "Example" },
  to: [{ email: to }],
  subject: "Welcome",
  text: "Welcome aboard.",
  html: "<p>Welcome aboard.</p>",
});

export const sendWelcome = (to: string) =>
  Effect.gen(function* () {
    const email = yield* EmailService;
    const result = yield* email.send(welcome(to));
    yield* Effect.log("sent", { id: result.id });
  });
```

Provide a provider at the edge:

```ts
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { FetchHttpClient } from "effect/http";
import * as Resend from "@thomasfosterau/effect-connect-resend";

const EmailLive = Resend.layer({
  apiKey: Redacted.make(process.env.RESEND_API_KEY!),
}).pipe(Layer.provide(FetchHttpClient.layer));
```

SMS has the same shape:

```ts
import * as Effect from "effect/Effect";
import { sendSms } from "@thomasfosterau/effect-connect";

export const sendCode = (to: string, code: string) => sendSms({ to, body: `Your code is ${code}` }); // Effect<SmsSendResult, SmsSendError, SmsService>
```

So does WhatsApp, whose message is a tagged union: free-form text (valid only inside WhatsApp's 24-hour customer-service window) or a pre-approved template:

```ts
import { sendWhatsApp } from "@thomasfosterau/effect-connect";

export const sendCode = (to: string, code: string) =>
  sendWhatsApp({ _tag: "Template", to, template: { id: "HX…", variables: { "1": code } } }); // Effect<WhatsAppSendResult, WhatsAppSendError, WhatsAppService>
```

And chat, through whichever `ChatService` layer the edge provides:

```ts
import { sendChat } from "@thomasfosterau/effect-connect";

export const announce = (version: string) => sendChat({ text: `Deployed ${version}` }); // Effect<ChatSendResult, ChatSendError, ChatService>
```

## Multiple channels

A program that uses two channels names both in its requirements:

```ts
import * as Effect from "effect/Effect";
import { sendSms, sendWhatsApp, SmsService, WhatsAppService } from "@thomasfosterau/effect-connect";

const notify = (to: string) =>
  Effect.all([
    sendSms({ to, body: "Your order has shipped" }),
    // A WhatsApp message is free-form text (`_tag: "Text"`, only inside the
    // 24-hour customer-service window) or a pre-approved template.
    sendWhatsApp({
      _tag: "Template",
      to,
      template: { id: "shipped", variables: { "1": "#1042" } },
    }),
  ]);

Effect.runPromise(
  notify("+61412345678").pipe(
    Effect.provide(SmsService.layerRecording([])),
    Effect.provide(WhatsAppService.layerRecording([])),
  ),
);
```

## Email templates

`EmailTemplate` turns Schema-typed data into a subject, an accessible HTML document and a matching plain-text body, in a negotiated locale. `EmailMessage` stays a rendered message: `toMessage` renders, then you `send`.

```ts
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { EmailHtml, EmailTemplate, EmailText, send } from "@thomasfosterau/effect-connect";

const { html } = EmailHtml;

const Welcome = EmailTemplate.make({
  data: Schema.Struct({ name: Schema.String, url: Schema.String }),
  // Strings per locale: the keys are the locales the template supports.
  messages: {
    en: {
      subject: "Welcome",
      hello: (name: string) => `Hello, ${name}!`,
      start: "Set up your account",
    },
    fr: {
      subject: "Bienvenue",
      hello: (name: string) => `Bonjour, ${name} !`,
      start: "Configurer votre compte",
    },
  },
  subject: (_, { t }) => t.subject,
  preheader: (_, { t }) => t.start,
  html: ({ name, url }, { t }) => html`
    ${EmailHtml.heading(1, t.hello(name))}
    <p>${EmailHtml.button({ href: url, label: t.start })}</p>
  `,
  // Optional: written alongside instead of derived from the HTML.
  text: ({ name, url }, { t }) => EmailText.text`
    ${t.hello(name)}

    ${t.start}: ${url}
  `,
});

export const sendWelcome = (to: string, locale: string) =>
  EmailTemplate.toMessage(
    Welcome,
    { name: "Ada", url: "https://example.com/start" },
    {
      from: { email: "noreply@example.com" },
      to: [{ email: to }],
      locale, // or a preference list, e.g. from Accept-Language
    },
  ).pipe(Effect.flatMap(send));
```

- **Escaping.** `html` escapes every interpolation that is not already `Html`; `unsafeRaw` is the only way around it. Quote attributes, and pass URLs through `url` / `imageUrl` (or the helpers), which replace `javascript:` and other unsafe schemes with `about:invalid#unsafe-url`.
- **Accessible defaults.** The document shell sets `lang` and `dir` from the negotiated locale (right-to-left for Arabic, Hebrew, Persian, Urdu and the other RTL scripts), a `<title>` equal to the subject, `color-scheme`, a preheader hidden from view and from screen readers, and a `role="article"` wrapper labelled with the subject. `layout` tables are `role="presentation"`, `button` is a link, `image` requires `alt` (`""` for decorative), and `heading` is a real heading.
- **Plain text.** By default it is derived from the body with `EmailText.fromHtml`: paragraphs and headings separated by blank lines, list markers, links as `label (url)`, images as their `alt`, hidden content dropped. Pass `text` to write it alongside instead.
- **Localisation.** `messages` takes any per-locale strings, such as an effect-l10n catalog's compiled messages; locale negotiation is BCP 47 lookup (`fr-CA` → `fr` → `defaultLocale`). A template without `messages` renders in whichever locale is asked for, which `Intl` formatters can use through `locale.tag`. `localised({ en, fr }, { defaultLocale })` puts one template per locale behind one template.
- **Other renderers.** `fromRenderer` builds the same `EmailTemplate` from any `(data, locale) => Effect<EmailContent>`, which is how adapter packages plug in.
- **Errors.** Data that does not decode against the template's schema, or a default locale the template does not have, fails `EmailTemplateError` with one line per issue.

## API

### Email

| Export | What it is |
| --- | --- |
| `EmailAddress`, `Recipient`, `Attachment`, `EmailMessage`, `EmailSendResult` | The message model, as `effect/Schema` schemas with matching types. |
| `EmailService` | The `Context.Service`: `send(message)` and `sendBatch(messages)`, failing `EmailSendError`. `EmailService.layerRecording(sent)` is the test double. |
| `send`, `sendBatch` | Accessors over the service in context. |
| `decodeEmailMessage` | Decode untrusted input into a message, failing `EmailValidationError`. |
| `recipientAddresses` | Every address a message is delivered to (`to`, `cc`, `bcc`). |
| `EmailSendError`, `EmailValidationError` | The contract's errors (`Schema.TaggedError`). |
| `EmailTemplate` | Typed, localised templates: `make`, `localised`, `fromRenderer`, `render`, `toMessage`, `lookup`, `locale`. Fails `EmailTemplateError`. |
| `EmailHtml` | The escaping `html` tag, `unsafeRaw`, `url` / `imageUrl`, the `document` shell, `preheader`, `layout`, `button`, `link`, `image`, `heading`. |
| `EmailText` | The `text` tag for hand-written bodies, and `fromHtml` to derive one. |

### SMS

| Export | What it is |
| --- | --- |
| `PhoneNumber`, `SmsSender`, `SmsMessage`, `SmsSendResult` | The SMS model, as `effect/Schema` schemas with matching types. `PhoneNumber` is E.164 (`+61412345678`); `SmsSender` also admits a short code or an alphanumeric sender ID (up to 11 characters). `SmsMessage` is `{ to, from?, body }`: one recipient, a non-empty body, and a `from` that overrides the provider's configured default. |
| `SmsService` | The `Context.Service`: `send(message)` and `sendBatch(messages)`, failing `SmsSendError`. `SmsService.layerRecording(sent)` is the test double. |
| `sendSms`, `sendSmsBatch` | Accessors over the service in context. |
| `decodeSmsMessage` | Decode untrusted input into an SMS, failing `SmsValidationError`. |
| `SmsSendError`, `SmsValidationError` | The contract's errors (`Schema.TaggedError`), the same shape as the email ones. |

### WhatsApp

| Export | What it is |
| --- | --- |
| `WhatsAppMessage`, `WhatsAppTextMessage`, `WhatsAppTemplateMessage`, `WhatsAppTemplate`, `WhatsAppSendResult` | The WhatsApp model, as `effect/Schema` schemas with matching types. `WhatsAppMessage` is a union on `_tag`: `"Text"` is `{ to, from?, body }`, valid only inside WhatsApp's 24-hour customer-service window; `"Template"` is `{ to, from?, template: { id, variables? } }`, a pre-approved template (its provider identifier and placeholder values), the only kind allowed outside it. Numbers are `PhoneNumber` (E.164); a provider adds its own channel prefix. |
| `WhatsAppService` | The `Context.Service`: `send(message)` and `sendBatch(messages)`, failing `WhatsAppSendError`. `WhatsAppService.layerRecording(sent)` is the test double. |
| `sendWhatsApp`, `sendWhatsAppBatch` | Accessors over the service in context. |
| `decodeWhatsAppMessage` | Decode untrusted input into a WhatsApp message, failing `WhatsAppValidationError`. |
| `WhatsAppSendError`, `WhatsAppValidationError` | The contract's errors (`Schema.TaggedError`), the same shape as the SMS ones. |

### Chat

| Export | What it is |
| --- | --- |
| `ChatMessage`, `ChatSendResult` | The chat model, as `effect/Schema` schemas with matching types. `ChatMessage` is `{ text, username? }`: non-empty text and an optional display-name override. The destination is the provider's configured webhook, not part of the message. |
| `ChatService` | The `Context.Service`: `send(message)` and `sendBatch(messages)` (in order), failing `ChatSendError`. `ChatService.layerRecording(sent)` is the test double. |
| `sendChat`, `sendChatBatch` | Accessors over the service in context. |
| `decodeChatMessage` | Decode untrusted input into a chat message, failing `ChatValidationError`. |
| `ChatSendError`, `ChatValidationError` | The contract's errors (`Schema.TaggedError`), the same shape as the email ones. |

### Shared

| Export | What it is |
| --- | --- |
| `truncateUpstreamBody`, `UPSTREAM_BODY_LIMIT` | The bound a provider applies to a vendor error body before it can reach a log line. |
| `refuseRedirects` | Run a request with redirects refused, so a 3xx never replays the credential to another host: `redirect: "manual"` is pinned on the underlying `fetch`, layered over your own `FetchHttpClient.RequestInit`, and a 3xx (or opaque redirect) answer fails as a `StatusCodeError` described `redirect refused`, after one request, with its body and `Location` unread; the response that error keeps has the status and no headers. Works on Cloudflare Workers, which rejects `redirect: "error"`. |
| `rejectionMessage(response, prefix)` | A vendor's non-2xx as one loggable line: the status and the truncated body (just the status when the body can't be read). |
| `describeHttpError`, `httpErrorStatus`, `isSuccessStatus` | A failed request's one-line description and its status (`none` for a transport failure); whether a status is 2xx. |
| `boundString`, `boundSecret`, `EnvBinding`, `EnvSecretBinding` | Read a Worker `env` binding: `some` when present and non-blank, a secret as `Redacted` whether it arrives plain or already redacted. |
| `selectTransport(config, live, fallback)` | The live layer on the platform `fetch` when `config` is `some`, else the fallback (a provider's no-op): the body of every provider's `resolveTransport(env)`. |
| `droppingSender(line)` | A `send` / `sendBatch` pair that succeeds without sending and logs `line(message)` once per message: the body of every provider's `noop`. |
| `executeWithSecretUrl(http, request, options)`, `SecretUrlRequestOptions` | For a provider whose URL is the credential (an incoming webhook): execute with redirects refused, answering a 2xx and failing anything else with a message that never names the URL. |
| `describeHttpErrorWithoutUrl(error, secrets)`, `redactSecrets(text, secrets)` | The parts it is built from: a failed request described without the request URL (Effect's own message names it), and any text with the given secrets replaced by `[redacted]`. |

## Testing a consumer

```ts
import * as Effect from "effect/Effect";
import { EmailService, send, type EmailMessage } from "@thomasfosterau/effect-connect";

const sent: Array<EmailMessage> = [];
await Effect.runPromise(
  send({
    from: { email: "noreply@example.com" },
    to: [{ email: "reader@example.test" }],
    subject: "Welcome",
  }).pipe(Effect.provide(EmailService.layerRecording(sent))),
);
// sent[0].to[0].email === "reader@example.test"
```

## Errors

`EmailSendError` carries the provider name, a one-line `message` safe to log, the vendor's HTTP `status` as an `Option` (`none` for transport failures) and the underlying `cause`. The vendor's error body is truncated to 200 characters before it is embedded, and the credential never appears in one.

`EmailValidationError` is what `decodeEmailMessage` fails with; `issues` lists each schema issue as one line.

`EmailTemplateError` is what rendering a template fails with: its data did not decode, or it has no usable locale. `issues` lists each problem as one line.

`SmsSendError` and `SmsValidationError` mirror them for SMS. An SMS provider never puts the message body (often a one-time code) in an error message.

`WhatsAppSendError` and `WhatsAppValidationError` mirror them for WhatsApp; a provider never puts the body or a template's variables in an error message.

`ChatSendError` and `ChatValidationError` mirror them for chat. A chat provider never puts the message text or the webhook URL (the credential) in an error message.

## Relationship to effect-auth

`@thomasfosterau/effect-auth`'s `EmailSender` takes a purpose-keyed message; `EmailMessage` is its rendered form, so an adapter renders, then calls `EmailService.send`. Neither package depends on the other.

See also the [Resend](./resend.md) and [Twilio](./twilio.md) providers and [Alchemy Cloudflare bindings](./alchemy-cloudflare.md).
