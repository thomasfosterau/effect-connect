---
"@thomasfosterau/effect-connect": patch
"@thomasfosterau/effect-connect-resend": patch
---

Sends work on Cloudflare Workers again. `refuseRedirects` pinned `redirect: "error"` on the underlying `fetch`, and Workers rejects that value before sending anything, so every request that went through it failed there, a 200 included; every Resend send does.

`refuseRedirects` now pins `redirect: "manual"` and refuses the redirect itself: a 3xx answer (or the opaque redirect, status `0`, that other runtimes give) fails as an `HttpClientError` whose reason is a `StatusCodeError` described `redirect refused`. The redirect is never followed, there is exactly one request, and the response's body and `Location` are never read: the body is cancelled. Its type narrows to effects that answer an `HttpClientResponse` and fail with `HttpClientError`, which is how every provider already used it.

`describeHttpError` and `describeHttpErrorWithoutUrl` describe such a failure as `redirect refused (302)`: the status alone, with no method and no URL. A Resend send answered by a redirect fails as `EmailSendError` with `Resend was unreachable: redirect refused (302)` and `status: some(302)`.

`@thomasfosterau/effect-connect-resend` has no code change of its own; its patch release raises its `@thomasfosterau/effect-connect` dependency to the fixed version, so upgrading the provider alone brings the fix.
