---
"@thomasfosterau/effect-connect": patch
"@thomasfosterau/effect-connect-twilio": patch
---

`executeWithSecretUrl` now redacts a vendor error body before truncating it, so a secret that straddles the 200-character bound can no longer leave its leading part in the error message. `rejectionMessage` takes an optional `secrets` list and applies the same order; the Twilio provider uses it instead of its own copy.
