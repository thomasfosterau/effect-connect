# `@thomasfosterau/effect-connect`

An Effect-native messaging abstraction: one message model and one service contract per channel (email, SMS, WhatsApp), and their errors, provider-agnostic. The Resend (email) and Twilio (SMS) providers ship as sibling packages, [`@thomasfosterau/effect-connect-resend`](https://github.com/thomasfosterau/effect-connect/tree/trunk/packages/resend#readme) and [`@thomasfosterau/effect-connect-twilio`](https://github.com/thomasfosterau/effect-connect/tree/trunk/packages/twilio#readme); no first-party provider implements `WhatsAppService` yet. For chat, use Effect's own [`effect/chat`](https://github.com/Effect-TS/effect-smol) with `@effect/chat-slack` or `@effect/chat-discord`.

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
import { type Email, EmailService } from "@thomasfosterau/effect-connect";

const welcome = (to: string): Email.EmailMessage => ({
  from: { email: "noreply@example.com", name: "Example" },
  to: [{ email: to }],
  subject: "Welcome",
  text: "Welcome aboard.",
  html: "<p>Welcome aboard.</p>",
});

export const sendWelcome = (to: string) =>
  Effect.gen(function* () {
    const email = yield* EmailService.EmailService;
    const result = yield* email.send(welcome(to));
    yield* Effect.log("sent", { id: result.id });
  });
```

## Entry points

The entry point `.` exports each module as a namespace (`import { EmailService } from "@thomasfosterau/effect-connect"`, then `EmailService.send`), and each module is also a subpath of its own, such as `./EmailTemplate`.

| Export | Purpose |
| --- | --- |
| `EmailService` (`EmailService`, `send`, `sendBatch`), `Email` (`EmailMessage`, `decodeEmailMessage`) | The email contract, accessors, message model and validation. |
| `EmailTemplate`, `EmailHtml`, `EmailText` | Typed, localised email templates rendering accessible HTML and matching plain text. |
| `SmsService` (`SmsService`, `sendSms`), `Sms` (`SmsMessage`, `decodeSmsMessage`) | The SMS contract, accessors, message model and validation. |
| `WhatsAppService` (`WhatsAppService`, `sendWhatsApp`), `WhatsApp` (`WhatsAppMessage`, `decodeWhatsAppMessage`) | The WhatsApp contract, accessors, message model (text or template) and validation. |
| `Errors` (`*SendError`, `*ValidationError`) | Each channel's errors (`Schema.TaggedError`). |
| `Http` (the transport rules), `Transport` (`boundSecret`, `selectTransport`, `droppingSender`) | Shared helpers every provider applies. |
| `EmailService.EmailService.layerRecording(sent)`, and the same on each `*Service` | Test doubles that record what was sent. |

## Documentation

- [Core reference](https://github.com/thomasfosterau/effect-connect/blob/trunk/docs/core.md): usage per channel, the full API tables, testing a consumer, errors, effect-auth.
- [Repository README](https://github.com/thomasfosterau/effect-connect/blob/trunk/README.md)
- [Changelog](https://github.com/thomasfosterau/effect-connect/blob/trunk/packages/core/CHANGELOG.md)

## License

[MIT](https://github.com/thomasfosterau/effect-connect/blob/trunk/LICENSE.md)
