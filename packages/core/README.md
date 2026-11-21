# `@thomasfosterau/effect-connect`

An Effect-native messaging abstraction: one message model and one service contract per channel (email, SMS, WhatsApp, chat), and their errors, provider-agnostic. The Resend (email) and Twilio (SMS) providers ship as sibling packages, [`@thomasfosterau/effect-connect-resend`](https://github.com/thomasfosterau/effect-connect/tree/trunk/packages/resend#readme) and [`@thomasfosterau/effect-connect-twilio`](https://github.com/thomasfosterau/effect-connect/tree/trunk/packages/twilio#readme); no first-party provider implements `WhatsAppService` or `ChatService` yet.

> [!WARNING]
> Experimental and pre-1.0, largely written with Claude Code; the API may change without notice. Not production-ready.

## Install

```bash
pnpm add @thomasfosterau/effect-connect effect
```

`effect` (`^4.0.0`) is a required peer dependency. Node.js 22 or newer.

## Example

A consumer sends through a channel's service and provides one provider's layer at the edge.

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

## Entry points

Everything is exported from `.`; each module also has its own subpath, such as `./EmailTemplate`.

| Export | Purpose |
| --- | --- |
| `EmailService`, `send`, `sendBatch`, `EmailMessage`, `decodeEmailMessage` | The email contract, accessors, message model and validation. |
| `EmailTemplate`, `EmailHtml`, `EmailText` | Typed, localised email templates rendering accessible HTML and matching plain text. |
| `SmsService`, `sendSms`, `SmsMessage`, `decodeSmsMessage` | The SMS contract, accessors, message model and validation. |
| `WhatsAppService`, `sendWhatsApp`, `WhatsAppMessage`, `decodeWhatsAppMessage` | The WhatsApp contract, accessors, message model (text or template) and validation. |
| `ChatService`, `sendChat`, `ChatMessage`, `decodeChatMessage` | The chat contract, accessors, message model and validation. |
| `*SendError`, `*ValidationError` | Each channel's errors (`Schema.TaggedError`). |
| `Http` transport rules, `boundSecret`, `selectTransport`, `droppingSender` | Shared helpers every provider applies. |
| `*Service.layerRecording(sent)` | Test doubles that record what was sent. |

## Documentation

- [Core reference](https://github.com/thomasfosterau/effect-connect/blob/trunk/docs/core.md): usage per channel, the full API tables, testing a consumer, errors, effect-auth.
- [Repository README](https://github.com/thomasfosterau/effect-connect/blob/trunk/README.md)
- [Changelog](https://github.com/thomasfosterau/effect-connect/blob/trunk/packages/core/CHANGELOG.md)

## License

[MIT](https://github.com/thomasfosterau/effect-connect/blob/trunk/LICENSE.md)
