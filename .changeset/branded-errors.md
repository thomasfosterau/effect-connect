---
"@thomasfosterau/effect-connect": minor
---

Every error class (`EmailSendError`, `EmailValidationError`, and the SMS, WhatsApp and chat equivalents) is now nominally branded (`Schema.TaggedError<Self, { readonly brand: unique symbol }>`). A plain object with the same fields is no longer assignable to the error type: construct the error with `new`. Runtime behaviour and the encoded form are unchanged.
