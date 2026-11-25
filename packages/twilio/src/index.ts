/**
 * `@thomasfosterau/effect-connect-twilio` — the Twilio provider for
 * `@thomasfosterau/effect-connect`: the `SmsService` over Twilio's Messages
 * API with `effect/http` and no SDK, a `Redacted` auth token, a no-op layer
 * for un-provisioned stages and an env-driven resolver that picks between
 * the two.
 *
 * @module index
 * @since 0.1.0
 */

/**
 * The Twilio provider: the payload mapping, the `SmsService` layers, the
 * no-op transport and the Worker env resolver (`layer`, `layerConfig`,
 * `noop`, `resolveTransport`).
 *
 * @since 0.1.0
 */
export * as Twilio from "./Twilio.ts";
/**
 * The Twilio account, credential, default sender and host, as a service.
 *
 * @since 0.1.0
 */
export * as TwilioConfig from "./TwilioConfig.ts";
