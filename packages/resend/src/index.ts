/**
 * `@thomasfosterau/effect-connect-resend` — the Resend provider for
 * `@thomasfosterau/effect-connect`: `POST /emails` over `effect/http`
 * with no SDK, a `Redacted` key, a no-op layer for un-provisioned stages and
 * an env-driven resolver that picks between the two.
 *
 * @module index
 * @since 0.1.0
 */

/**
 * The Resend provider: the payload mapping, the `EmailService` layers, the
 * no-op transport and the Worker env resolver (`layer`, `layerConfig`,
 * `noop`, `resolveTransport`).
 *
 * @since 0.1.0
 */
export * as Resend from "./Resend.ts";
/**
 * The Resend credential and host, as a service.
 *
 * @since 0.1.0
 */
export * as ResendConfig from "./ResendConfig.ts";
