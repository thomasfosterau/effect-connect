# @thomasfosterau/effect-connect

The provider-agnostic core: one message model and one service per channel (`Email`, `Sms`, `WhatsApp`, `Chat` and their `*Service` modules), their errors (`Errors.ts`), email templates and their renderers (`EmailTemplate`, `EmailHtml`, `EmailText`), the transport rules every provider applies (`Http.ts`) and the Worker-edge helpers (`Transport.ts`). Peer: `effect` only.

## Boundary

Imports nothing from this workspace and names no provider or vendor; providers depend on the core, never the reverse. Vendor-neutral HTTP code belongs here (`Http.ts`), so a new transport rule goes here, not into one provider.

## Invariants

- **One service per channel**, each `send` + `sendBatch` + `layerRecording`, so a consumer's requirements name exactly its channels. A new channel copies `Sms.ts` / `SmsService.ts`: a model module, a service module, `<Channel>SendError` / `<Channel>ValidationError` in `Errors.ts`, a `decode<Channel>Message` on `internal/issues.ts`, and a `layerRecording` on `internal/recording.ts`.
- **Every provider request goes through `refuseRedirects`** (`redirect: "manual"`, never `"error"`, which Workers rejects); a non-2xx message comes from `rejectionMessage`, a transport failure's from `describeHttpError`. A provider whose URL is the credential (an incoming webhook) uses `executeWithSecretUrl`, which never names the URL.
- **A send error's `status` is `Option<number>`**: `none` for transport failures.
- **Providers build `configFromEnv` / `resolveTransport(env)` / `noop` from `Transport.ts`**: a blank binding is absent; every `noop` logs a line naming no recipient and no body.
- **`internal/` is not public**: not re-exported, excluded from docgen.
- **`EmailMessage` is a rendered message, or a reference to a provider-rendered `template`** (never both: the schema rejects a `template` with `text` or `html`). An effect-auth `EmailSender` adapter is `render`, then `EmailService.send`; no dependency either way. A provider without template support fails such a send before any request.
- **Templates sit above `send`**: `EmailTemplate` renders to `EmailContent`, then an `EmailMessage`; nothing in a provider knows about `EmailTemplate`; providers see only the message's `template` reference. `EmailHtml` escapes every interpolation that is not `Html`, and `unsafeRaw` stays the only way around it. Renderer adapters are packages of their own, built on `fromRenderer`.
