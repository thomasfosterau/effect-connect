# @thomasfosterau/effect-connect-twilio

The Twilio provider: `POST /2010-04-01/Accounts/:sid/Messages.json` (form-encoded) over `effect/http`, no SDK.

## Boundary

Imports the core only; never another provider.

## Invariants

- **A fixed literal host** (`DEFAULT_BASE_URL`); `baseUrl` is for test stubs, never request input. The account SID is path-encoded.
- **Basic auth** (`HttpClientRequest.basicAuth`, account SID and `Redacted` token); no Node global, so it runs on Workers.
- **Redirects are refused** through the core's `refuseRedirects`, after one request, with the body and `Location` unread. `tests/workerd` proves it under the real runtime.
- **A non-2xx fails with the status and a truncated body**, with the token and the Basic credential redacted; the message body (often a one-time code) never appears in an error or a log. No retry: the caller decides.
- **The sender is the message's `from`, else the configured `from`, else `MessagingServiceSid`**; with none, the send fails before any request.
- **`sendBatch` sends each message** (Twilio has no batch endpoint), at most 10 at once, failing on the first failure.
- **`noop` succeeds and logs one fixed line**, never the recipient or the body. Safe only while the message is advisory.
- **`layerConfig` fails at construction on an empty `TWILIO_ACCOUNT_SID` or `TWILIO_AUTH_TOKEN`**; `resolveTransport(env)` is the path that tolerates missing credentials.
