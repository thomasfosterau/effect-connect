# effect-connect

Effect-native messaging for email, SMS, WhatsApp and chat: one provider-agnostic service per channel, and providers that speak HTTP through `effect/http` with no vendor SDK, so they run on Cloudflare Workers, browsers and Node alike.

> [!WARNING]
> Experimental and pre-1.0, largely written with Claude Code; the API may change without notice. **Not production-ready:** it handles credentials and personal data, and has not been audited.

## Install

```bash
pnpm add @thomasfosterau/effect-connect @thomasfosterau/effect-connect-resend effect
```

## Usage

Code sends through a channel's service; the edge provides one provider's layer per channel (or `EmailService.layerRecording` in a test).

```ts
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { FetchHttpClient } from "effect/http";
import { EmailService } from "@thomasfosterau/effect-connect";
import * as Resend from "@thomasfosterau/effect-connect-resend";

const sendWelcome = (to: string) =>
  Effect.gen(function* () {
    const email = yield* EmailService;
    return yield* email.send({
      from: { email: "noreply@example.com", name: "Example" },
      to: [{ email: to }],
      subject: "Welcome",
      text: "Welcome aboard.",
    });
  });

const EmailLive = Resend.layer({ apiKey: Redacted.make("re_…") }).pipe(
  Layer.provide(FetchHttpClient.layer),
);

Effect.runPromise(sendWelcome("reader@example.com").pipe(Effect.provide(EmailLive)));
```

## Packages

| Package | What it is | Guide |
| --- | --- | --- |
| [`@thomasfosterau/effect-connect`](packages/core) | Message models, the `EmailService` / `SmsService` / `WhatsAppService` / `ChatService` contracts, errors, test layers and shared HTTP transport rules. | [core](docs/core.md) |
| [`@thomasfosterau/effect-connect-resend`](packages/resend) | Resend email provider, a no-op layer and a Worker env resolver. | [resend](docs/resend.md) |
| [`@thomasfosterau/effect-connect-twilio`](packages/twilio) | Twilio SMS provider, a no-op layer and a Worker env resolver. | [twilio](docs/twilio.md) |
| [`@thomasfosterau/effect-connect-alchemy-cloudflare`](packages/alchemy-cloudflare) | Deploy-time Worker bindings for Alchemy's Cloudflare provider. | [alchemy-cloudflare](docs/alchemy-cloudflare.md) |

## More

[Contributing](docs/CONTRIBUTING.md) · [Security](docs/SECURITY.md) · [Publishing](docs/PUBLISHING.md) · [License](LICENSE.md) (MIT)
