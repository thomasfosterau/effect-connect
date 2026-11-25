# `@thomasfosterau/effect-connect-resend`

The Resend provider for [`@thomasfosterau/effect-connect`](https://github.com/thomasfosterau/effect-connect/tree/trunk/packages/core#readme): `POST /emails` over Effect's `HttpClient` (`effect/http`) with no SDK, a `Redacted` API key, a no-op layer for un-provisioned stages and an env-driven resolver that picks between the two.

> [!WARNING]
> Experimental and pre-1.0, largely written with Claude Code; the API may change without notice. Not production-ready.

## Install

```bash
pnpm add @thomasfosterau/effect-connect-resend @thomasfosterau/effect-connect effect
```

`effect` (`^4.0.0`) is a required peer dependency. Node.js 22 or newer.

## Example

```ts
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { FetchHttpClient } from "effect/http";
import { EmailService } from "@thomasfosterau/effect-connect";
import { Resend } from "@thomasfosterau/effect-connect-resend";

const EmailLive = Resend.layer({ apiKey: Redacted.make(process.env.RESEND_API_KEY!) }).pipe(
  Layer.provide(FetchHttpClient.layer),
);

const program = Effect.gen(function* () {
  const email = yield* EmailService.EmailService;
  const result = yield* email.send({
    from: { email: "noreply@example.com", name: "Example" },
    to: [{ email: "reader@example.com" }],
    subject: "Welcome",
    text: "Welcome aboard.",
    html: "<p>Welcome aboard.</p>",
  });
  // result.id is Resend's email id, as an Option (always `some` here)
});
```

## Entry points

The entry point `.` exports two namespaces, `Resend` and `ResendConfig`, each also a subpath of its own (`./Resend`, `./ResendConfig`).

| Export | Purpose |
| --- | --- |
| `Resend.layer(config)`, `Resend.layerConfig` | The `EmailService` over the `HttpClient` in context, from literal config or from `RESEND_API_KEY` / `RESEND_BASE_URL`. |
| `Resend.resolveTransport(env)`, `Resend.apiKeyFromEnv(env)`, `Resend.ResendEnv` | Pick the live sender or the no-op from a Worker env. |
| `Resend.noop` | The `EmailService` that succeeds without sending. |
| `ResendConfig.ResendConfig`, `ResendConfig.ResendConfigInput`, `ResendConfig.DEFAULT_BASE_URL` | The credential and host as a service. |
| `Resend.toResendPayload`, `Resend.formatAddress`, `Resend.ResendSendPayload` | The core-message to `POST /emails` mapping. |
| `Resend.layerEmailService` | The `EmailService` over a `ResendConfig` and `HttpClient` you provide. |

## Documentation

- [Resend reference](https://github.com/thomasfosterau/effect-connect/blob/trunk/docs/resend.md): Worker usage, what the transport pins, batches, message mapping, testing.
- [Core reference](https://github.com/thomasfosterau/effect-connect/blob/trunk/docs/core.md)
- [Repository README](https://github.com/thomasfosterau/effect-connect/blob/trunk/README.md)
- [Changelog](https://github.com/thomasfosterau/effect-connect/blob/trunk/packages/resend/CHANGELOG.md)

## License

[MIT](https://github.com/thomasfosterau/effect-connect/blob/trunk/LICENSE.md)
