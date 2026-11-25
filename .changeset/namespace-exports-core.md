---
"@thomasfosterau/effect-connect": minor
---

The package root now exports each module as a namespace, as Effect does, instead of re-exporting every module's members flat: `Email`, `EmailService`, `Sms`, `SmsService`, `WhatsApp`, `WhatsAppService`, `Errors`, `Http` and `Transport` join `EmailHtml`, `EmailText` and `EmailTemplate`. The subpaths (`./Email`, `./EmailService`, …) are unchanged.

Migration: prefix each root import with its module, or import it from the module's subpath unchanged.

- `import { EmailService, send } from "@thomasfosterau/effect-connect"` becomes `import { EmailService } from "@thomasfosterau/effect-connect"`, with `yield* EmailService.EmailService`, `EmailService.send(…)` and `EmailService.EmailService.layerRecording(sent)`; or `import { EmailService, send } from "@thomasfosterau/effect-connect/EmailService"`.
- The email model (`EmailMessage`, `Recipient`, …), `decodeEmailMessage` and `recipientAddresses` → `Email.*`; `SmsMessage`, `decodeSmsMessage` → `Sms.*`; `sendSms`, `sendSmsBatch` → `SmsService.*`; the WhatsApp names likewise under `WhatsApp` and `WhatsAppService`.
- `EmailSendError`, `SmsSendError`, `WhatsAppSendError`, the `*ValidationError`s, `EmailTemplateError`, `truncateUpstreamBody` and `UPSTREAM_BODY_LIMIT` → `Errors.*`.
- `refuseRedirects`, `rejectionMessage`, `describeHttpError` and the other transport rules → `Http.*`; `boundString`, `boundSecret`, `selectTransport`, `droppingSender` and the `Env*Binding` types → `Transport.*`.
