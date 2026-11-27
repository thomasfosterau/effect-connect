/**
 * The Worker bindings `@thomasfosterau/effect-connect-twilio` reads
 * (`TwilioEnv`): the account SID, the auth token as a secret, and the
 * optional default sender and Messaging Service.
 *
 * @module Twilio
 * @since 0.4.0
 */

import * as Config from "effect/Config";
import * as Option from "effect/Option";
import type * as Redacted from "effect/Redacted";
import * as Str from "effect/String";

/**
 * What {@link twilioBindings} takes.
 *
 * @since 0.4.0
 */
export interface TwilioBindingsInput {
  /** The Twilio account SID (`AC…`). */
  readonly accountSid: string;
  /** The Twilio auth token. */
  readonly authToken: Redacted.Redacted;
  /** The default sender (an E.164 number or alphanumeric sender ID). */
  readonly from?: string;
  /** The Messaging Service SID (`MG…`), sent when a message names no sender. */
  readonly messagingServiceSid?: string;
}

/**
 * The Twilio bindings for a Worker's `env`: `TWILIO_ACCOUNT_SID`,
 * `TWILIO_AUTH_TOKEN` (deployed as a secret because it is `Redacted`), and
 * `TWILIO_FROM` / `TWILIO_MESSAGING_SERVICE_SID` only when they are set.
 *
 * @since 0.4.0
 */
export interface TwilioBindings {
  readonly TWILIO_ACCOUNT_SID: string;
  readonly TWILIO_AUTH_TOKEN: Redacted.Redacted;
  readonly TWILIO_FROM?: string;
  readonly TWILIO_MESSAGING_SERVICE_SID?: string;
}

const nonBlank = (value: Option.Option<string>): Option.Option<string> =>
  Option.filter(value, (raw) => Str.isNonEmpty(raw.trim()));

const bindings = (
  accountSid: string,
  authToken: Redacted.Redacted,
  from: Option.Option<string>,
  messagingServiceSid: Option.Option<string>,
): TwilioBindings => ({
  TWILIO_ACCOUNT_SID: accountSid,
  TWILIO_AUTH_TOKEN: authToken,
  ...Option.match(nonBlank(from), {
    onNone: () => ({}),
    onSome: (TWILIO_FROM) => ({ TWILIO_FROM }),
  }),
  ...Option.match(nonBlank(messagingServiceSid), {
    onNone: () => ({}),
    onSome: (TWILIO_MESSAGING_SERVICE_SID) => ({ TWILIO_MESSAGING_SERVICE_SID }),
  }),
});

/**
 * The Twilio bindings from literal values, to spread into a Worker's `env`.
 * A blank `from` or `messagingServiceSid` is left out of the record, as an
 * unset one is.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import * as Redacted from "effect/Redacted";
 * import { Twilio } from "@thomasfosterau/effect-connect-alchemy-cloudflare";
 *
 * const env = Twilio.twilioBindings({
 *   accountSid: "AC123",
 *   authToken: Redacted.make("token"),
 *   from: "+61400000000",
 * });
 * assert.strictEqual(env.TWILIO_ACCOUNT_SID, "AC123");
 * assert.strictEqual(Redacted.value(env.TWILIO_AUTH_TOKEN), "token");
 * assert.strictEqual(env.TWILIO_FROM, "+61400000000");
 * assert.ok(!("TWILIO_MESSAGING_SERVICE_SID" in env));
 * ```
 *
 * @since 0.4.0
 */
export const twilioBindings = (input: TwilioBindingsInput): TwilioBindings =>
  bindings(
    input.accountSid,
    input.authToken,
    Option.fromNullishOr(input.from),
    Option.fromNullishOr(input.messagingServiceSid),
  );

/**
 * The Twilio bindings read through `effect/Config` on the deploy machine:
 * `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` (required, the token
 * redacted), `TWILIO_FROM` and `TWILIO_MESSAGING_SERVICE_SID` (optional,
 * left out when unset or blank). Fails with a `ConfigError` when the SID or
 * token is unset or empty, so a deploy never ships a Worker without them.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import * as ConfigProvider from "effect/ConfigProvider";
 * import * as Effect from "effect/Effect";
 * import * as Redacted from "effect/Redacted";
 * import { Twilio } from "@thomasfosterau/effect-connect-alchemy-cloudflare";
 *
 * const env = Effect.runSync(
 *   Twilio.twilioBindingsConfig.parse(
 *     ConfigProvider.fromEnv({
 *       env: { TWILIO_ACCOUNT_SID: "AC123", TWILIO_AUTH_TOKEN: "token" },
 *     }),
 *   ),
 * );
 * assert.strictEqual(env.TWILIO_ACCOUNT_SID, "AC123");
 * assert.strictEqual(Redacted.value(env.TWILIO_AUTH_TOKEN), "token");
 * assert.ok(!("TWILIO_FROM" in env));
 * ```
 *
 * @since 0.4.0
 */
export const twilioBindingsConfig: Config.Config<TwilioBindings> = Config.all({
  accountSid: Config.String("TWILIO_ACCOUNT_SID"),
  authToken: Config.Redacted("TWILIO_AUTH_TOKEN"),
  from: Config.option(Config.String("TWILIO_FROM")),
  messagingServiceSid: Config.option(Config.String("TWILIO_MESSAGING_SERVICE_SID")),
}).pipe(
  Config.map(({ accountSid, authToken, from, messagingServiceSid }) =>
    bindings(accountSid, authToken, from, messagingServiceSid),
  ),
);
