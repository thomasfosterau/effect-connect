# @thomasfosterau/effect-connect-resend

The Resend provider: `POST /emails` and `/emails/batch` over `effect/http`, no SDK.

## Boundary

Imports the core only; never another provider.

## Invariants

- **`index.ts` only re-exports modules as namespaces**: the layers, `noop` and the Worker resolver live in the provider module itself, beside the payload mapping.
- **A fixed literal host** (`DEFAULT_BASE_URL`); `baseUrl` is for test stubs, never request input.
- **Redirects are refused** through the core's `refuseRedirects`, after one request, with the body and `Location` unread. `tests/workerd` proves it under the real runtime.
- **A non-2xx fails with the status and a truncated body**; the key never appears in a message. No retry: the caller decides.
- **`noop` succeeds and logs the subject only**, never the recipient or body (a verification URL is the token). Safe only while the mail is advisory.
- **`sendBatch` is one request** (Resend's limit is 100; the caller chunks); an empty batch makes none.
- **`layerConfig` fails at construction on an empty `RESEND_API_KEY`**; `resolveTransport(env)` is the path that tolerates a missing key.
