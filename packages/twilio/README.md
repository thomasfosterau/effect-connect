# `@thomasfosterau/effect-connect-twilio`

The Twilio provider for [`@thomasfosterau/effect-connect`](https://github.com/thomasfosterau/effect-connect/tree/trunk/packages/core#readme): the `SmsService` over Twilio's Messages API with Effect's `HttpClient` (`effect/http`) and no SDK, a `Redacted` auth token, a no-op layer for un-provisioned stages and an env-driven resolver that picks between the two. Created using Claude Code; the API is in flux, so expect breaking changes.

## Install

```bash
pnpm add @thomasfosterau/effect-connect-twilio @thomasfosterau/effect-connect effect
```

`effect` (`^4.0.0`) is a required peer dependency. Node.js 22 or newer.

## Example

```ts
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { FetchHttpClient } from "effect/http";
import { SmsService } from "@thomasfosterau/effect-connect";
import { Twilio } from "@thomasfosterau/effect-connect-twilio";

const SmsLive = Twilio.layer({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: Redacted.make(process.env.TWILIO_AUTH_TOKEN!),
  from: "+61400000000",
}).pipe(Layer.provide(FetchHttpClient.layer));

const program = Effect.gen(function* () {
  const sms = yield* SmsService.SmsService;
  const result = yield* sms.send({ to: "+61412345678", body: "Your code is 123456" });
  // result.id is Twilio's message SID, as an Option (always `some` here)
});
```

## Entry points

The entry point `.` exports two namespaces, `Twilio` and `TwilioConfig`, each also a subpath of its own (`./Twilio`, `./TwilioConfig`).

| Export | Purpose |
| --- | --- |
| `Twilio.layer(config)`, `Twilio.layerConfig` | The `SmsService` over the `HttpClient` in context, from literal config or from `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` / `TWILIO_MESSAGING_SERVICE_SID` / `TWILIO_BASE_URL`. |
| `Twilio.resolveTransport(env)`, `Twilio.configFromEnv(env)`, `Twilio.TwilioEnv` | Pick the live sender or the no-op from a Worker env. |
| `Twilio.noop` | The `SmsService` that succeeds without sending. |
| `TwilioConfig.TwilioConfig`, `TwilioConfig.TwilioConfigInput`, `TwilioConfig.DEFAULT_BASE_URL` | The account, credential, default sender and host as a service. |
| `Twilio.toTwilioPayload`, `Twilio.TwilioSendPayload` | The core-message to form-fields mapping. |
| `Twilio.layerSmsService` | The `SmsService` over a `TwilioConfig` and `HttpClient` you provide. |

## Documentation

- [Twilio reference](https://github.com/thomasfosterau/effect-connect/blob/trunk/docs/twilio.md): Worker usage, what the transport pins, senders, batches.
- [Core reference](https://github.com/thomasfosterau/effect-connect/blob/trunk/docs/core.md)
- [Repository README](https://github.com/thomasfosterau/effect-connect/blob/trunk/README.md)

## License

MIT
