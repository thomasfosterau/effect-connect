/**
 * `@thomasfosterau/effect-connect` — the provider-agnostic core: one message
 * model and one service contract per channel (email, SMS, WhatsApp),
 * and their errors. Chat is `effect/chat`, Effect's own. Providers (`@thomasfosterau/effect-connect-resend` for email)
 * implement a channel's service over `effect/http`, through the shared
 * transport rules in `Http`.
 *
 * @module index
 * @since 0.1.0
 */

/**
 * The email message model: addresses, recipients, attachments, the message and the result of a send.
 *
 * @since 0.1.0
 */
export * from "./Email.ts";
/**
 * The `EmailService` contract, its accessors and the recording test double.
 *
 * @since 0.1.0
 */
export * from "./EmailService.ts";
/**
 * HTML for email bodies, escaped by construction, with accessible helpers and the document shell.
 *
 * @since 0.4.0
 */
export * as EmailHtml from "./EmailHtml.ts";
/**
 * Plain-text email bodies: written with the `text` template, or derived from HTML.
 *
 * @since 0.4.0
 */
export * as EmailText from "./EmailText.ts";
/**
 * Typed, localised email templates that render a subject, HTML and text together.
 *
 * @since 0.4.0
 */
export * as EmailTemplate from "./EmailTemplate.ts";
/**
 * The SMS message model: phone numbers, senders, the message and the result of a send.
 *
 * @since 0.1.0
 */
export * from "./Sms.ts";
/**
 * The `SmsService` contract, its accessors and the recording test double.
 *
 * @since 0.1.0
 */
export * from "./SmsService.ts";
/**
 * The WhatsApp message model: free-form text and pre-approved template messages, and the result of a send.
 *
 * @since 0.1.0
 */
export * from "./WhatsApp.ts";
/**
 * The `WhatsAppService` contract, its accessors and the recording test double.
 *
 * @since 0.1.0
 */
export * from "./WhatsAppService.ts";
/**
 * The transport rules every provider applies over `effect/http`: redirect refusal, bounded error bodies.
 *
 * @since 0.1.0
 */
export * from "./Http.ts";
/**
 * Choosing a transport at a Worker's edge: env bindings, the live-or-no-op switch and the no-op sender.
 *
 * @since 0.1.0
 */
export * from "./Transport.ts";
/**
 * The failures the channel contracts admit, and the vendor-body bound.
 *
 * @since 0.1.0
 */
export * from "./Errors.ts";
