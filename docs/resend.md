# `@thomasfosterau/effect-connect-resend`

Detail for the [package README](../packages/resend/README.md): the Resend provider for the [core](./core.md), `POST /emails` over Effect's `HttpClient` with no SDK. It runs on Cloudflare Workers and in browsers as well as on Node.

## Usage

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

`Resend.layerConfig` reads `RESEND_API_KEY` (and an optional `RESEND_BASE_URL`) through `effect/Config` instead. It fails at layer construction with a `ConfigError` when `RESEND_API_KEY` is unset or empty (an empty variable counts as missing); an empty `RESEND_BASE_URL` falls back to the default host. On a Worker whose stages may lack the key, use `Resend.resolveTransport(env)` below.

## API

The package root exports two namespaces, `Resend` and `ResendConfig`; each is also a subpath (`@thomasfosterau/effect-connect-resend/Resend`). Earlier versions exported their members flat from the root, and `layer`, `layerConfig`, `resolveTransport`, `apiKeyFromEnv` and `ResendEnv` from the root alone: they are now in `Resend`, so `import * as Resend from "@thomasfosterau/effect-connect-resend"` becomes `import { Resend } from "@thomasfosterau/effect-connect-resend"`.

| Export | What it is |
| --- | --- |
| `Resend.layer(config)`, `Resend.layerConfig` | The `EmailService` over the `HttpClient` in context, from literal config or from `RESEND_API_KEY` / `RESEND_BASE_URL`. |
| `Resend.resolveTransport(env)`, `Resend.apiKeyFromEnv(env)`, `Resend.ResendEnv` | Pick the live sender or the no-op from a Worker env; needs no `HttpClient`. |
| `Resend.noop` | The `EmailService` that succeeds without sending and logs the subject only. |
| `ResendConfig.ResendConfig`, `ResendConfig.ResendConfigInput`, `ResendConfig.DEFAULT_BASE_URL` | The credential and host as a service. |
| `Resend.toResendPayload`, `Resend.formatAddress`, `Resend.ResendSendPayload` | The core-message → `POST /emails` mapping. |
| `Resend.layerEmailService` | The `EmailService` over a `ResendConfig` and `HttpClient` you provide yourself. |

## On a Worker: `Resend.resolveTransport(env)`

For stages deployed without the credential, `Resend.resolveTransport` is the one call a Worker makes: the live sender on the platform `fetch` when `RESEND_API_KEY` is bound and non-blank (as a string or a `Redacted`), the logging no-op otherwise, so the fallback cannot be forgotten.

```ts
import * as Effect from "effect/Effect";
import type { EmailService } from "@thomasfosterau/effect-connect";
import { Resend } from "@thomasfosterau/effect-connect-resend";

// Your request handler; it sends through the EmailService in context.
declare const handle: (
  request: Request,
) => Effect.Effect<Response, never, EmailService.EmailService>;

export default {
  fetch: (request: Request, env: Resend.ResendEnv) =>
    handle(request).pipe(Effect.provide(Resend.resolveTransport(env)), Effect.runPromise),
};
```

`Resend.noop` succeeds without sending and logs the subject only — never the recipient, never the body (a verification URL is the token). That trade is only safe while the mail is advisory; a send that gates an account should fail loudly at boot instead.

## What the transport pins

- **A fixed literal host.** `https://api.resend.com` is a compile-time constant; `baseUrl` exists for a stub server in a test, never for request input.
- **Redirects are refused**: `redirect: "manual"` on the underlying fetch (layered over your own `FetchHttpClient.RequestInit`), and a 3xx fails as `EmailSendError` (`Resend was unreachable: redirect refused (302)`, `status: some(302)`) after one request. Workers' default (`follow`) replays the request, bearer token included, at whatever host the response names. (`redirect: "error"` is not an option: Workers rejects it on every request.)
- **Truncated error bodies.** A non-2xx becomes an `EmailSendError` with `provider: "resend"`, `status: some(status)` and at most 200 characters of the response; an unreadable body still fails with the status; a transport failure carries `status: none`. The key never appears in a message.
- **No retry.** The caller decides the policy (`Effect.retry`).

## Batches

`sendBatch(messages)` is one `POST /emails/batch`, one result per message in order. Resend accepts up to 100 messages per request; chunk beyond that. An empty batch makes no request.

## Message mapping

| Core `EmailMessage`                  | Resend `POST /emails`                      |
| ------------------------------------ | ------------------------------------------ |
| `from`, `to`, `cc`, `bcc`            | `Name <address>` strings (`formatAddress`) |
| `replyTo`                            | `reply_to: [address]`                      |
| `subject`, `text`, `html`, `headers` | the same                                   |
| `attachments`                        | `attachments` (`content_type`)             |
| `tags`                               | `tags: [{ name: tag, value: tag }]`        |
| `template`                           | `template: { id, variables }`              |

A message with a `template` sends a published Resend template (by id or alias) instead of a body; its `subject` overrides the template's default, and Resend rejects the send when a variable the template uses is missing.

`Resend.toResendPayload(message)` is exported for callers that want to inspect the payload.

## Testing a consumer

Provide `EmailService.EmailService.layerRecording(sent)` from the core. To exercise this package's own transport, provide `FetchHttpClient.layer` with a stub `Fetch`:

```ts
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { FetchHttpClient } from "effect/http";
import { Resend } from "@thomasfosterau/effect-connect-resend";

// Your stand-in for the platform fetch: return canned Responses.
declare const stubFetch: typeof globalThis.fetch;

const http = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.Fetch, stubFetch)),
);
const EmailStub = Resend.layer({ apiKey: Redacted.make("re_test") }).pipe(Layer.provide(http));
```

See also the [core](./core.md) and the [Alchemy Cloudflare bindings](./alchemy-cloudflare.md), which deploy the `RESEND_API_KEY` binding `resolveTransport(env)` reads.
