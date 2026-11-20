/**
 * The Twilio account, credential, default sender and host, as a service with
 * two constructors: a literal (`layer`) and one read from `effect/Config`
 * (`layerConfig`).
 *
 * @module TwilioConfig
 * @since 0.1.0
 */

import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as Redacted from "effect/Redacted";
import * as Str from "effect/String";

/**
 * Twilio's API host. A literal, so no input can steer where the credential is
 * sent; `baseUrl` exists for a stub server in a test, never for request input.
 *
 * @since 0.1.0
 */
export const DEFAULT_BASE_URL = "https://api.twilio.com";

/**
 * What {@link TwilioConfig.layer} takes.
 *
 * @since 0.1.0
 */
export interface TwilioConfigInput {
  /** The account SID (`AC…`): the Basic-auth username and part of the request path. */
  readonly accountSid: string;
  /** The auth token. Wrap with `Redacted.make(...)` or read it via `Config.Redacted(...)`. */
  readonly authToken: Redacted.Redacted;
  /** The sender used when a message names none: an E.164 number, a short code or an alphanumeric sender ID. */
  readonly from?: string;
  /** A Messaging Service SID (`MG…`), used when neither the message nor `from` names a sender. */
  readonly messagingServiceSid?: string;
  /** The API host, without a trailing slash. Defaults to {@link DEFAULT_BASE_URL}. */
  readonly baseUrl?: string;
}

/**
 * The Twilio configuration as a service.
 *
 * @since 0.1.0
 */
export class TwilioConfig extends Context.Service<
  TwilioConfig,
  {
    readonly accountSid: string;
    readonly authToken: Redacted.Redacted;
    readonly from: Option.Option<string>;
    readonly messagingServiceSid: Option.Option<string>;
    readonly baseUrl: string;
  }
>()("@thomasfosterau/effect-connect-twilio/TwilioConfig") {
  /**
   * A configuration from literal values.
   *
   * @since 0.1.0
   */
  static readonly layer = (config: TwilioConfigInput): Layer.Layer<TwilioConfig> =>
    Layer.succeed(TwilioConfig, {
      accountSid: config.accountSid,
      authToken: config.authToken,
      from: nonBlank(Option.fromNullishOr(config.from)),
      messagingServiceSid: nonBlank(Option.fromNullishOr(config.messagingServiceSid)),
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
    });

  /**
   * A configuration read through `effect/Config`: `TWILIO_ACCOUNT_SID` and
   * `TWILIO_AUTH_TOKEN` (required, the token redacted), `TWILIO_FROM`,
   * `TWILIO_MESSAGING_SERVICE_SID` and `TWILIO_BASE_URL` (optional). Fails
   * with a `ConfigError` when a required value is unset or empty; an empty
   * optional value counts as unset.
   *
   * @since 0.1.0
   */
  static readonly layerConfig = Layer.effect(
    TwilioConfig,
    Effect.gen(function* () {
      const accountSid = yield* Config.String("TWILIO_ACCOUNT_SID");
      const authToken = yield* Config.Redacted("TWILIO_AUTH_TOKEN");
      const from = yield* Config.option(Config.String("TWILIO_FROM"));
      const messagingServiceSid = yield* Config.option(
        Config.String("TWILIO_MESSAGING_SERVICE_SID"),
      );
      const baseUrl = yield* Config.String("TWILIO_BASE_URL").pipe(
        Config.withDefault(DEFAULT_BASE_URL),
      );
      return {
        accountSid,
        authToken,
        from: nonBlank(from),
        messagingServiceSid: nonBlank(messagingServiceSid),
        baseUrl,
      };
    }),
  );
}

const nonBlank = (value: Option.Option<string>): Option.Option<string> =>
  Option.filter(value, (raw) => Str.isNonEmpty(raw.trim()));
