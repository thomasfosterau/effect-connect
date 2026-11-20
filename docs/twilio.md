# `@thomasfosterau/effect-connect-twilio`

Detail for the [package README](../packages/twilio/README.md): the Twilio provider for the [core](./core.md), the `SmsService` over `POST /2010-04-01/Accounts/:sid/Messages.json` with Effect's `HttpClient` and no SDK. It runs on Cloudflare Workers and in browsers as well as on Node.

## Usage

```ts
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { FetchHttpClient } from "effect/http";
import { SmsService } from "@thomasfosterau/effect-connect";
import * as Twilio from "@thomasfosterau/effect-connect-twilio";

const SmsLive = Twilio.layer({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: Redacted.make(process.env.TWILIO_AUTH_TOKEN!),
  from: "+61400000000",
}).pipe(Layer.provide(FetchHttpClient.layer));

const program = Effect.gen(function* () {
  const sms = yield* SmsService;
  const result = yield* sms.send({ to: "+61412345678", body: "Your code is 123456" });
  // result.id is Twilio's message SID (`SM…`), as an Option (always `some` here)
});
```

`Twilio.layerConfig` reads `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (redacted) and the optional `TWILIO_FROM`, `TWILIO_MESSAGING_SERVICE_SID` and `TWILIO_BASE_URL` through `effect/Config` instead. It fails at layer construction with a `ConfigError` when the SID or token is unset or empty; an empty optional value counts as unset. On a Worker whose stages may lack the credentials, use `resolveTransport(env)` below.

## Senders

A send goes out from the message's own `from`, else the configured `from`, else the configured Messaging Service (`MessagingServiceSid`). With none of the three, it fails with an `SmsSendError` (`status: none`) before any request is made.

## On a Worker: `resolveTransport(env)`

`resolveTransport(env)` is the one call a Worker makes: the live sender on the platform `fetch` when `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are both bound and non-blank (the token as a string or a `Redacted`), the logging no-op otherwise.

```ts
import * as Effect from "effect/Effect";
import type { SmsService } from "@thomasfosterau/effect-connect";
import * as Twilio from "@thomasfosterau/effect-connect-twilio";

declare const handle: (request: Request) => Effect.Effect<Response, never, SmsService>;

export default {
  fetch: (request: Request, env: Twilio.TwilioEnv) =>
    handle(request).pipe(Effect.provide(Twilio.resolveTransport(env)), Effect.runPromise),
};
```

`Twilio.noop` succeeds without sending and logs one fixed line: never the recipient, never the body (often a one-time code). That trade is only safe while the message is advisory; an SMS that gates an account should fail loudly at boot instead.

## What the transport pins

- **A fixed literal host.** `https://api.twilio.com` is a compile-time constant; `baseUrl` exists for a stub server in a test. The account SID is path-encoded.
- **Basic auth** with the account SID and the `Redacted` token, built without any Node global.
- **Redirects are refused**: `redirect: "manual"` on the underlying fetch, and a 3xx fails as `SmsSendError` (`Twilio was unreachable: redirect refused (302)`, `status: some(302)`) after one request, so the credentials are never replayed elsewhere.
- **Truncated, redacted error bodies.** A non-2xx becomes an `SmsSendError` with `provider: "twilio"`, `status: some(status)` and at most 200 characters of the response (Twilio's `{ code, message }`), with the token and the Basic credential replaced by `[redacted]`; a transport failure carries `status: none`.
- **No retry.** The caller decides the policy (`Effect.retry`).

## Batches

Twilio has no batch endpoint, so `sendBatch(messages)` sends each message, at most 10 at once, and answers one result per message in order. The whole batch fails on the first failure; call `send` per message for per-message outcomes.

## Testing a consumer

Provide `SmsService.layerRecording(sent)` from the core. To exercise this package's own transport, provide `FetchHttpClient.layer` with a stub `Fetch`, as the [Resend reference](./resend.md#testing-a-consumer) shows.
