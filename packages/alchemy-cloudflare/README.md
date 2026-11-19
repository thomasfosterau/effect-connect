# `@thomasfosterau/effect-connect-alchemy-cloudflare`

Deploy-time bindings for [`@thomasfosterau/effect-connect`](https://github.com/thomasfosterau/effect-connect/tree/trunk/packages/core#readme) on Cloudflare Workers deployed with [Alchemy](https://alchemy.run)'s Cloudflare provider. Each builder returns the record of Worker `env` bindings one provider reads (`RESEND_API_KEY` for Resend, the one provider today), with secrets as `Redacted` values. It binds credentials only and runs on the deploy machine, never in the Worker.

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
import { resendBindings } from "@thomasfosterau/effect-connect-alchemy-cloudflare";

const env = {
  ...resendBindings({ apiKey: Redacted.make(process.env.RESEND_API_KEY!) }),
};
// …then `env` in your Worker resource's props.
```

## Entry points

The package has the single entry point `.`.

| Export | Purpose |
| --- | --- |
| `resendBindings`, `resendBindingsConfig`, `ResendBindings`, `ResendBindingsInput` | The `RESEND_API_KEY` secret binding, from a value or from `effect/Config`. |
| `WorkerBindings<B>` | The constraint every bindings record meets. |
| `Deployed<B>` | `Cloudflare.InferEnv<B>`: the `env` a Worker receives for a bindings record. |

## Documentation

- [Alchemy Cloudflare reference](https://github.com/thomasfosterau/effect-connect/blob/trunk/docs/alchemy-cloudflare.md): peers, the Config forms, reading the bindings in the Worker, types.
- [Repository README](https://github.com/thomasfosterau/effect-connect/blob/trunk/README.md)
- [Changelog](https://github.com/thomasfosterau/effect-connect/blob/trunk/packages/alchemy-cloudflare/CHANGELOG.md)

## License

[MIT](https://github.com/thomasfosterau/effect-connect/blob/trunk/LICENSE.md)
