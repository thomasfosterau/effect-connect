---
"@thomasfosterau/effect-connect": patch
"@thomasfosterau/effect-connect-resend": patch
"@thomasfosterau/effect-connect-twilio": patch
---

`rejectionMessage` now reads only a bounded prefix of a vendor's error body and cancels the rest, so a huge or never-ending error body is no longer buffered whole before it is truncated. The message is unchanged: the status, then at most 200 characters with any secrets redacted. A failed read or cancel still leaves the status.
