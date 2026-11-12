# @thomasfosterau/effect-connect

## 0.2.1

### Patch Changes

- [#158](https://github.com/thomasfosterau/effect-connect/pull/158) [`4cf63cd`](https://github.com/thomasfosterau/effect-connect/commit/4cf63cd06820181c64fad175e6d236ec0361e567) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - Sends work on Cloudflare Workers again. `refuseRedirects` pinned `redirect: "error"` on the underlying `fetch`, and Workers rejects that value before sending anything, so every request that went through it failed there, a 200 included; every Resend send does.
  
  `refuseRedirects` now pins `redirect: "manual"` and refuses the redirect itself: a 3xx answer (or the opaque redirect, status `0`, that other runtimes give) fails as an `HttpClientError` whose reason is a `StatusCodeError` described `redirect refused`. The redirect is never followed, there is exactly one request, and the response's body and `Location` are never read: the body is cancelled, and the response the error keeps has the status and no headers.
  
  Every call 0.2.0 accepted still compiles, point-free in a pipe included. Its signature is still `<A, E, R>(effect: Effect<A, E, R>)`; the result's error type is now `E | HttpClientError`, which is the same type as before for a request (whose `E` is already `HttpClientError`). An effect that answers something other than an `HttpClientResponse` only has the option pinned, as before.
  
  `describeHttpError` and `describeHttpErrorWithoutUrl` describe such a failure as `redirect refused (302)`: the status alone, with no method and no URL. A Resend send answered by a redirect fails as `EmailSendError` with `Resend was unreachable: redirect refused (302)` and `status: some(302)`.
  
  `@thomasfosterau/effect-connect-resend` has no code change of its own; its patch release raises its `@thomasfosterau/effect-connect` dependency to the fixed version, so upgrading the provider alone brings the fix.

## 0.2.0

### Minor Changes

- [#142](https://github.com/thomasfosterau/effect-connect/pull/142) [`5fffc73`](https://github.com/thomasfosterau/effect-connect/commit/5fffc730f652e3e92479dbf39b20d40dec0df419) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - Every error class (`EmailSendError`, `EmailValidationError`, and the SMS, WhatsApp and chat equivalents) is now nominally branded (`Schema.TaggedError<Self, { readonly brand: unique symbol }>`). A plain object with the same fields is no longer assignable to the error type: construct the error with `new`. Runtime behaviour and the encoded form are unchanged.

### Patch Changes

- [#139](https://github.com/thomasfosterau/effect-connect/pull/139) [`a36997e`](https://github.com/thomasfosterau/effect-connect/commit/a36997ee7d23b7c8c12758a68012c6b12089f496) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - The published tarballs now include `CHANGELOG.md`, so the release notes can be read from `node_modules`.

## 0.1.0

### Minor Changes

- [#89](https://github.com/thomasfosterau/effect-connect/pull/89) [`82bb51d`](https://github.com/thomasfosterau/effect-connect/commit/82bb51d12add1c232d472cd58d376fcf43393b93) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - The core adds a chat channel beside email and SMS, as its own service:

  - `ChatMessage` (`{ text, username? }`: non-empty text and an optional display-name override) and `ChatSendResult` as `effect/Schema` schemas.
  - `ChatService` (`Context.Service`: `send`, `sendBatch`), the `sendChat` / `sendChatBatch` accessors and `ChatService.layerRecording(sent)`.
  - `ChatSendError` / `ChatValidationError` (`Schema.TaggedError`) and `decodeChatMessage`.
  - `executeWithSecretUrl` (with `SecretUrlRequestOptions`), `describeHttpErrorWithoutUrl` and `redactSecrets` in `Http`, for a provider whose request URL is the credential: Effect's own `HttpClientError` message names the request URL, so these compose every failure message without it.

- [#81](https://github.com/thomasfosterau/effect-connect/pull/81) [`51d489d`](https://github.com/thomasfosterau/effect-connect/commit/51d489d93584bf2a9d3f37373ab6be8fabcd1321) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - The core gains an `Http` module with the transport rules every provider applies over `effect/http`: `refuseRedirects` (pins `redirect: "error"` over the consumer's `FetchHttpClient.RequestInit`), `rejectionMessage` (a non-2xx as the status plus the truncated body), `describeHttpError`, `httpErrorStatus` and `isSuccessStatus`. The Resend provider uses them in place of their own copies; its behaviour and error messages are unchanged.

- [#91](https://github.com/thomasfosterau/effect-connect/pull/91) [`7a1e87e`](https://github.com/thomasfosterau/effect-connect/commit/7a1e87ec5ee00f912ff21cf5aac0f20ac208dd4c) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - The core gains a `Transport` module with the Worker-edge helpers every provider's `configFromEnv`, `resolveTransport(env)` and `noop` are built from: `boundString` / `boundSecret` (a binding is `some` when present and non-blank; a secret may arrive plain or `Redacted`), the `EnvBinding` / `EnvSecretBinding` types, `selectTransport(config, live, fallback)` and `droppingSender(line)`. The Resend provider uses them in place of its own copies. Its behaviour and log lines are unchanged, and `ResendEnv` now names its bindings with the shared types.

- [#78](https://github.com/thomasfosterau/effect-connect/pull/78) [`e6666ec`](https://github.com/thomasfosterau/effect-connect/commit/e6666ecc6a7f64ec237870f0664a2a8f94795f26) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - The packages ship as effect-connect, a messaging abstraction over email and SMS: `@thomasfosterau/effect-connect` (the core, formerly `@thomasfosterau/effect-email`) and `@thomasfosterau/effect-connect-resend`. None was published under the old names. Every `Context.Service` key moves to the new package names (`@thomasfosterau/effect-connect/EmailService`, …), and the Resend no-op logs under `[effect-connect-resend]`.

  The core adds an SMS channel beside email, as its own service:

  - `PhoneNumber` (E.164), `SmsSender` (E.164, short code or alphanumeric sender ID), `SmsMessage` (`{ to, from?, body }`), `SmsSendResult` as `effect/Schema` schemas.
  - `SmsService` (`Context.Service`: `send`, `sendBatch`), the `sendSms` / `sendSmsBatch` accessors and `SmsService.layerRecording(sent)`.
  - `SmsSendError` / `SmsValidationError` (`Schema.TaggedError`) and `decodeSmsMessage`.

- [#11](https://github.com/thomasfosterau/effect-connect/pull/11) [`36ecd31`](https://github.com/thomasfosterau/effect-connect/commit/36ecd31031998ebd38933aaececc64d383c18b80) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - Initial release, on Effect `4.0.0-rc.118`. The `effect` peer floor is `>=4.0.0-rc.118`: the packages import `effect/http/*`, which earlier rc releases spell `effect/unstable/http/*`.

  Under rc.118's `ConfigProvider` an empty environment variable counts as missing, so the Resend package's `layerConfig` falls back to the default base URL when `*_BASE_URL` is `""`, and Resend's `layerConfig` fails at layer construction with a `ConfigError` when `RESEND_API_KEY` is `""` or unset.

  `@thomasfosterau/effect-connect` (peer: `effect`) — the provider-agnostic core:

  - `EmailAddress`, `Recipient`, `Attachment`, `EmailMessage`, `EmailSendResult` as `effect/Schema` schemas.
  - `EmailService` (`Context.Service`: `send`, `sendBatch`), the `send` / `sendBatch` accessors and `EmailService.layerRecording(sent)` test double.
  - `EmailSendError` / `EmailValidationError` (`Schema.TaggedError`), `decodeEmailMessage`, `recipientAddresses`, `truncateUpstreamBody`.

  `@thomasfosterau/effect-connect-resend` (peer: `effect`; depends on the core) — the Resend provider, the library form of the applications' hand-rolled `POST /emails` senders:

  - `layer` / `layerConfig` over `effect/http` with a `Redacted` key, `redirect: "error"` pinned on the fetch, truncated error bodies, `POST /emails/batch` for `sendBatch`.
  - `noop` (succeeds, logs the subject only) and `resolveTransport(env)` / `apiKeyFromEnv`; `toResendPayload`, `formatAddress`, `ResendSendPayload`.

- [#88](https://github.com/thomasfosterau/effect-connect/pull/88) [`e551db8`](https://github.com/thomasfosterau/effect-connect/commit/e551db805e0f1f89229cc2aa414b7adc2214adf9) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - A WhatsApp channel. The core gains `WhatsAppMessage`, a union on `_tag` of a free-form text message (`{ _tag: "Text", to, from?, body }`, valid only inside WhatsApp's 24-hour customer-service window) and a template message (`{ _tag: "Template", to, from?, template: { id, variables? } }`), with `WhatsAppSendResult`, `decodeWhatsAppMessage`, the `WhatsAppService` contract (`send`, `sendBatch`, `layerRecording`), the `sendWhatsApp` / `sendWhatsAppBatch` accessors and the `WhatsAppSendError` / `WhatsAppValidationError` errors.

### Patch Changes

- [#34](https://github.com/thomasfosterau/effect-connect/pull/34) [`7d8ea4e`](https://github.com/thomasfosterau/effect-connect/commit/7d8ea4ee126c1fa52d6399dda1e031455e8bcaa8) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - Doc comments state each provider's failure modes: Resend's `layerConfig` fails at layer construction with a `ConfigError` on an unset or empty API key variable.

- [#34](https://github.com/thomasfosterau/effect-connect/pull/34) [`c03d582`](https://github.com/thomasfosterau/effect-connect/commit/c03d5820a314658f268b9615775260b9a041c6b8) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - Each package tarball ships `dist`, `src` (without tests), `README.md` and `LICENSE`; the README carries everything a consumer needs.

- [#35](https://github.com/thomasfosterau/effect-connect/pull/35) [`66ed5cf`](https://github.com/thomasfosterau/effect-connect/commit/66ed5cfc4a86e8ecdec236cc6fa44838ad8ff31c) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - Tested against effect 4.0.0; peer floor unchanged (`>=4.0.0-rc.118`).

- [#123](https://github.com/thomasfosterau/effect-connect/pull/123) [`314f7e6`](https://github.com/thomasfosterau/effect-connect/commit/314f7e695306e3441818283b1f826376947c0af5) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - The `effect` peer range is now `^4.0.0` (was `>=4.0.0-rc.118`), per the peer-range policy: every 4.x release from 4.0.0 is supported, and a package's floor is raised only when one of its own dependencies requires it. Only the form of the range changes; Effect 4 release candidates are no longer in range.

- [#103](https://github.com/thomasfosterau/effect-connect/pull/103) [`d22f8e8`](https://github.com/thomasfosterau/effect-connect/commit/d22f8e856f3c82b0bcc6ae454398f63be8ecb2cd) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - Spell `Redacted.Redacted<string>` as `Redacted.Redacted` (its default type argument) in the emitted declarations. No behaviour change.
