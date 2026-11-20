# `@thomasfosterau/effect-connect-alchemy-cloudflare`

Detail for the [package README](../packages/alchemy-cloudflare/README.md). Each builder returns the record of Worker `env` bindings one provider reads, under its own keys (`RESEND_API_KEY` for Resend, `TWILIO_*` for Twilio). Secrets are `Redacted`, which Alchemy deploys as secret bindings. Spread the record into your Worker's `env`, and the provider's `resolveTransport(env)` (or `layerConfig`) finds its credentials at runtime.

It binds credentials only and provisions nothing on the vendor's side. It runs on the deploy machine, inside your `alchemy.run.ts`, never in the Worker. Its peers `@alchemy.run/cloudflare` and `alchemy` are pinned to one exact beta (the provider peers on that exact `alchemy`), with `effect ^4.1.0`.

## Usage

On the deploy machine, build the bindings and pass them into the Worker's `env`:

```ts skip-type-checking
import * as Redacted from "effect/Redacted";
import { resendBindings, twilioBindings } from "@thomasfosterau/effect-connect-alchemy-cloudflare";

const env = {
  ...resendBindings({ apiKey: Redacted.make(process.env.RESEND_API_KEY!) }),
  ...twilioBindings({
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: Redacted.make(process.env.TWILIO_AUTH_TOKEN!),
    from: process.env.TWILIO_FROM,
  }),
};
// …then `env` in your Worker resource's props.
```

Or read the same names through `effect/Config` on the deploy machine, with the `…BindingsConfig` forms. Each one is a `Config` of the whole record, fails when a required value is missing, and leaves an unset or blank optional value out:

```ts skip-type-checking
import * as Effect from "effect/Effect";
import {
  resendBindingsConfig,
  twilioBindingsConfig,
} from "@thomasfosterau/effect-connect-alchemy-cloudflare";

const env = Effect.gen(function* () {
  return { ...(yield* resendBindingsConfig), ...(yield* twilioBindingsConfig) };
});
```

In the Worker, the provider reads them back:

```ts skip-type-checking
import * as Resend from "@thomasfosterau/effect-connect-resend";
import * as Twilio from "@thomasfosterau/effect-connect-twilio";

const EmailLive = Resend.resolveTransport(env); // the live sender: RESEND_API_KEY is bound
const SmsLive = Twilio.resolveTransport(env); // the live sender: the SID and token are bound
```

## API

| Export | Binds | Read at runtime by |
| --- | --- | --- |
| `resendBindings`, `resendBindingsConfig`, `ResendBindings`, `ResendBindingsInput` | `RESEND_API_KEY` (secret) | `effect-connect-resend`'s `resolveTransport(env)` (`ResendEnv`) |
| `twilioBindings`, `twilioBindingsConfig`, `TwilioBindings`, `TwilioBindingsInput` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (secret), `TWILIO_FROM` and `TWILIO_MESSAGING_SERVICE_SID` (only when set and non-blank) | `effect-connect-twilio`'s `resolveTransport(env)` (`TwilioEnv`) |
| `WorkerBindings<B>` | — | The constraint every bindings record meets: each value a `Cloudflare.WorkerBindingResource`, so the record spreads into a `Cloudflare.Worker`'s `env`. |
| `Deployed<B>` | — | `Cloudflare.InferEnv<B>`: the `env` a Worker receives for a bindings record `B`, every value a plain string. Each provider's env type accepts it. |

`Deployed<B>` is the provider's own `Cloudflare.InferEnv<B>`, so a Worker typed with it is checked against the env Alchemy actually deploys.

See also the [Resend](./resend.md) and [Twilio](./twilio.md) providers, whose `resolveTransport(env)` reads these bindings.
