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

import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as HttpClient from "effect/http/HttpClient";
import {
  boundSecret,
  boundString,
  selectTransport,
  type EnvBinding,
  type EnvSecretBinding,
  type SmsService,
} from "@thomasfosterau/effect-connect";
import { layerSmsService, noop } from "./Twilio.ts";
import { TwilioConfig, type TwilioConfigInput } from "./TwilioConfig.ts";

/**
 * The Twilio sender: the payload mapping, the `SmsService` layer and the no-op transport.
 *
 * @since 0.1.0
 */
export * from "./Twilio.ts";
/**
 * The Twilio account, credential, default sender and host, as a service.
 *
 * @since 0.1.0
 */
export * from "./TwilioConfig.ts";

/**
 * The Twilio provider from literal configuration, over the `HttpClient` in
 * context (provide `FetchHttpClient.layer` on Workers, browsers and Node).
 *
 * @since 0.1.0
 */
export const layer = (
  config: TwilioConfigInput,
): Layer.Layer<SmsService, never, HttpClient.HttpClient> =>
  layerSmsService.pipe(Layer.provide(TwilioConfig.layer(config)));

/**
 * The Twilio provider configured through `effect/Config`
 * (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, optional `TWILIO_FROM`,
 * `TWILIO_MESSAGING_SERVICE_SID` and `TWILIO_BASE_URL`), over the
 * `HttpClient` in context. Fails at layer construction with a `ConfigError`
 * when the SID or token is unset or empty. On a Worker,
 * {@link resolveTransport} tolerates missing credentials.
 *
 * @since 0.1.0
 */
export const layerConfig = layerSmsService.pipe(Layer.provide(TwilioConfig.layerConfig));

/**
 * The env {@link resolveTransport} reads: the Worker's Twilio bindings, if any.
 *
 * @since 0.1.0
 */
export interface TwilioEnv {
  readonly TWILIO_ACCOUNT_SID?: EnvBinding;
  readonly TWILIO_AUTH_TOKEN?: EnvSecretBinding;
  readonly TWILIO_FROM?: EnvBinding;
  readonly TWILIO_MESSAGING_SERVICE_SID?: EnvBinding;
}

/**
 * The configuration from a Worker env: `none` unless both the account SID
 * and the auth token are bound and non-blank. A blank `TWILIO_FROM` or
 * `TWILIO_MESSAGING_SERVICE_SID` counts as unbound.
 *
 * @since 0.1.0
 */
export const configFromEnv = (env: TwilioEnv): Option.Option<TwilioConfigInput> =>
  Option.map(
    Option.all({
      accountSid: boundString(env.TWILIO_ACCOUNT_SID),
      authToken: boundSecret(env.TWILIO_AUTH_TOKEN),
    }),
    ({ accountSid, authToken }): TwilioConfigInput => ({
      accountSid,
      authToken,
      ...Option.match(boundString(env.TWILIO_FROM), {
        onNone: () => ({}),
        onSome: (from) => ({ from }),
      }),
      ...Option.match(boundString(env.TWILIO_MESSAGING_SERVICE_SID), {
        onNone: () => ({}),
        onSome: (messagingServiceSid) => ({ messagingServiceSid }),
      }),
    }),
  );

/**
 * Pick the transport for a Worker's environment: the live sender (on the
 * platform `fetch`, via `FetchHttpClient`) when the account SID and auth
 * token are bound, the logging {@link noop} when they are not.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import * as Effect from "effect/Effect";
 * import * as Option from "effect/Option";
 * import { sendSms } from "@thomasfosterau/effect-connect";
 * import { resolveTransport } from "@thomasfosterau/effect-connect-twilio";
 *
 * // No auth token bound: the no-op transport, which succeeds without a network call.
 * const result = Effect.runSync(
 *   sendSms({ to: "+61412345678", body: "Your code is 123456" }).pipe(
 *     Effect.provide(resolveTransport({ TWILIO_ACCOUNT_SID: "AC123" })),
 *   ),
 * );
 *
 * assert.ok(Option.isNone(result.id));
 * ```
 *
 * @since 0.1.0
 */
export const resolveTransport = (env: TwilioEnv): Layer.Layer<SmsService> =>
  selectTransport(configFromEnv(env), layer, noop);
