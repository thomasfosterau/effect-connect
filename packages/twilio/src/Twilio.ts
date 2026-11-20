/**
 * The core `SmsMessage` mapped onto Twilio's Messages API
 * (`POST /2010-04-01/Accounts/:sid/Messages.json`, form-encoded), sent over
 * Effect's `HttpClient` with no SDK: a fixed host, Basic auth, redirects
 * refused (the core's `refuseRedirects`), a truncated error body that never
 * holds the token, and no retry.
 *
 * @module Twilio
 * @since 0.1.0
 */

import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import {
  describeHttpError,
  droppingSender,
  httpErrorStatus,
  isSuccessStatus,
  redactSecrets,
  refuseRedirects,
  truncateUpstreamBody,
  SmsSendError,
  SmsService,
  type SmsMessage,
  type SmsSendResult,
} from "@thomasfosterau/effect-connect";
import { TwilioConfig } from "./TwilioConfig.ts";

/**
 * The form fields Twilio's create-message endpoint takes: `To`, `Body`, and
 * exactly one of `From` / `MessagingServiceSid`.
 *
 * @since 0.1.0
 */
export type TwilioSendPayload =
  | { readonly To: string; readonly Body: string; readonly From: string }
  | { readonly To: string; readonly Body: string; readonly MessagingServiceSid: string };

/**
 * The sender a send goes out from, in order of preference: the message's
 * `from`, the configured `from`, then the configured Messaging Service.
 */
interface Senders {
  readonly from: Option.Option<string>;
  readonly messagingServiceSid: Option.Option<string>;
}

/**
 * Map a core message onto Twilio's form fields, or `none` when neither the
 * message nor the configuration names a sender.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import * as Option from "effect/Option";
 * import { toTwilioPayload } from "@thomasfosterau/effect-connect-twilio";
 *
 * const payload = toTwilioPayload(
 *   { to: "+61412345678", body: "Your code is 123456" },
 *   { from: Option.some("Example"), messagingServiceSid: Option.none() },
 * );
 *
 * assert.deepStrictEqual(
 *   payload,
 *   Option.some({ To: "+61412345678", Body: "Your code is 123456", From: "Example" }),
 * );
 * ```
 *
 * @since 0.1.0
 */
export const toTwilioPayload = (
  message: SmsMessage,
  senders: Senders,
): Option.Option<TwilioSendPayload> =>
  Option.fromNullishOr(message.from).pipe(
    Option.orElse(() => senders.from),
    Option.map((from): TwilioSendPayload => ({ To: message.to, Body: message.body, From: from })),
    Option.orElse(() =>
      Option.map(senders.messagingServiceSid, (sid): TwilioSendPayload => ({
        To: message.to,
        Body: message.body,
        MessagingServiceSid: sid,
      })),
    ),
  );

const SendResponse = Schema.Struct({ sid: Schema.String });

const PROVIDER = "twilio";

const failure = (message: string, status: Option.Option<number>): SmsSendError =>
  new SmsSendError({ provider: PROVIDER, message, status });

const failureCausedBy = (
  message: string,
  status: Option.Option<number>,
  cause: unknown,
): SmsSendError => new SmsSendError({ provider: PROVIDER, message, status, cause });

/**
 * The core `SmsService` over Twilio's Messages API and the `HttpClient` in
 * context. Twilio has no batch endpoint, so `sendBatch` sends each message
 * concurrently (at most 10 at once) and fails on the first failure.
 *
 * @since 0.1.0
 */
export const layerSmsService: Layer.Layer<SmsService, never, TwilioConfig | HttpClient.HttpClient> =
  Layer.effect(
    SmsService,
    Effect.gen(function* () {
      const config = yield* TwilioConfig;
      const http = yield* HttpClient.HttpClient;
      const url = `${config.baseUrl}/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;
      // An error body that echoes the token or the Basic credential has it
      // removed before the message can reach a log line.
      const secrets = [
        Base64.encode(`${config.accountSid}:${Redacted.value(config.authToken)}`),
        Redacted.value(config.authToken),
      ];

      // Redacted before it is truncated, so a cut can never leave part of a
      // credential behind.
      const rejection = (response: HttpClientResponse.HttpClientResponse) =>
        response.text.pipe(
          Effect.map((body) => truncateUpstreamBody(redactSecrets(body, secrets))),
          Effect.orElseSucceed(() => ""),
          Effect.map((detail) =>
            Str.isEmpty(detail)
              ? `Twilio rejected the send: ${response.status}`
              : `Twilio rejected the send: ${response.status} ${detail}`,
          ),
        );

      const send = Effect.fn("Twilio.send")(function* (message: SmsMessage) {
        const payload = yield* Effect.fromOption(toTwilioPayload(message, config)).pipe(
          Effect.mapError(() =>
            failure(
              "Twilio needs a sender: set `from` on the message, or `from` or `messagingServiceSid` on the configuration",
              Option.none(),
            ),
          ),
        );
        const request = HttpClientRequest.post(url, { acceptJson: true }).pipe(
          HttpClientRequest.basicAuth(config.accountSid, config.authToken),
          HttpClientRequest.bodyUrlParams(payload),
        );
        const response = yield* http.execute(request).pipe(
          refuseRedirects,
          Effect.mapError((error) =>
            failureCausedBy(
              `Twilio was unreachable: ${describeHttpError(error)}`,
              httpErrorStatus(error),
              error,
            ),
          ),
        );
        if (!isSuccessStatus(response.status)) {
          return yield* failure(yield* rejection(response), Option.some(response.status));
        }
        const { sid } = yield* HttpClientResponse.schemaBodyJson(SendResponse)(response).pipe(
          Effect.mapError((cause) =>
            failureCausedBy(
              `Twilio answered ${response.status} with an unexpected body`,
              Option.some(response.status),
              cause,
            ),
          ),
        );
        const result: SmsSendResult = { id: Option.some(sid) };
        return result;
      });

      const sendBatch = (messages: ReadonlyArray<SmsMessage>) =>
        Effect.forEach(messages, send, { concurrency: 10 });

      return { send, sendBatch };
    }),
  );

/**
 * The sender used when no credentials are configured: every send
 * **succeeds** without sending, and logs one line naming neither the
 * recipient nor the body (which is often a one-time code).
 *
 * That is only safe while the message is advisory; if a send gates an
 * account, fail loudly at boot instead.
 *
 * @since 0.1.0
 */
export const noop: Layer.Layer<SmsService> = Layer.succeed(
  SmsService,
  droppingSender<SmsMessage>(
    () => "[effect-connect-twilio] no Twilio credentials configured; dropping an SMS",
  ),
);
