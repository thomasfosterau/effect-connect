# `@thomasfosterau/effect-connect-alchemy-cloudflare`

Deploy-time bindings for [`@thomasfosterau/effect-connect`](https://github.com/thomasfosterau/effect-connect/tree/trunk/packages/core#readme) on Cloudflare Workers deployed with [Alchemy](https://alchemy.run)'s Cloudflare provider. Each builder returns the record of Worker `env` bindings one provider reads (`RESEND_API_KEY` for Resend; `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and the optional sender for Twilio), with secrets as `Redacted` values. It binds credentials only and runs on the deploy machine, never in the Worker.

> [!WARNING]
> Experimental and pre-1.0, largely written with Claude Code; the API may change without notice. Not production-ready.

## Install

```bash
pnpm add -D @thomasfosterau/effect-connect-alchemy-cloudflare @alchemy.run/cloudflare@2.0.0-beta.87 alchemy@2.0.0-beta.87 effect
```

All peers are required: `@alchemy.run/cloudflare` and `alchemy` (exactly `2.0.0-beta.87`) and `effect` `^4.1.0`. Node.js 22 or newer.

## Example

On the deploy machine, build the bindings and pass them into the Worker's `env`:

```ts skip-type-checking
import * as Redacted from "effect/Redacted";
import { Resend, Twilio } from "@thomasfosterau/effect-connect-alchemy-cloudflare";

const env = {
  ...Resend.resendBindings({ apiKey: Redacted.make(process.env.RESEND_API_KEY!) }),
  ...Twilio.twilioBindings({
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: Redacted.make(process.env.TWILIO_AUTH_TOKEN!),
    from: process.env.TWILIO_FROM,
  }),
};
// …then `env` in your Worker resource's props.
```

## Entry points

The entry point `.` exports each module as a namespace (`Bindings`, `Resend`, `Twilio`), and each is also a subpath of its own (`./Bindings`, `./Resend`, `./Twilio`).

| Export | Purpose |
| --- | --- |
| `Resend.resendBindings`, `Resend.resendBindingsConfig`, `Resend.ResendBindings`, `Resend.ResendBindingsInput` | The `RESEND_API_KEY` secret binding, from a value or from `effect/Config`. |
| `Twilio.twilioBindings`, `Twilio.twilioBindingsConfig`, `Twilio.TwilioBindings`, `Twilio.TwilioBindingsInput` | `TWILIO_ACCOUNT_SID`, the `TWILIO_AUTH_TOKEN` secret, and `TWILIO_FROM` / `TWILIO_MESSAGING_SERVICE_SID` when set, from values or from `effect/Config`. |
| `Bindings.WorkerBindings<B>` | The constraint every bindings record meets. |
| `Bindings.Deployed<B>` | `Cloudflare.InferEnv<B>`: the `env` a Worker receives for a bindings record. |

## Documentation

- [Alchemy Cloudflare reference](https://github.com/thomasfosterau/effect-connect/blob/trunk/docs/alchemy-cloudflare.md): peers, the Config forms, reading the bindings in the Worker, types.
- [Repository README](https://github.com/thomasfosterau/effect-connect/blob/trunk/README.md)
- [Changelog](https://github.com/thomasfosterau/effect-connect/blob/trunk/packages/alchemy-cloudflare/CHANGELOG.md)

## License

[MIT](https://github.com/thomasfosterau/effect-connect/blob/trunk/LICENSE.md)
