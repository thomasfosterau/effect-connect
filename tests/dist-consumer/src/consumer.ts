/**
 * A consumer's view of every package, imported through their EMITTED
 * declarations (`paths` in tsconfig.json points the package names at
 * `dist/index.d.ts`). Each block exercises the types a real consumer
 * depends on, so a declaration that degrades to `any` fails here rather
 * than in an application. Never executed; type-checked only.
 */

import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as HttpClient from "effect/http/HttpClient";
import type * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import type * as HttpClientResponse from "effect/http/HttpClientResponse";
import {
  Email,
  EmailService,
  Errors,
  Http,
  Sms,
  SmsService,
  WhatsApp,
  WhatsAppService,
} from "@thomasfosterau/effect-connect";
import { Resend } from "@thomasfosterau/effect-connect-resend";
import { Twilio } from "@thomasfosterau/effect-connect-twilio";
import type * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "@thomasfosterau/effect-connect-alchemy-cloudflare";

/** A compile-time assertion: `T` must be exactly `true`. */
type Assert<T extends true> = T;
type Equals<A, B> =
  (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2 ? true : false;

// ── core ──────────────────────────────────────────────────────────────────

const message: Email.EmailMessage = {
  from: { email: "noreply@example.com", name: "Example" },
  to: [{ email: "reader@example.com" }],
  subject: "Welcome",
  text: "Welcome aboard.",
};

export const sent = Effect.flatMap(EmailService.EmailService, (email) => email.send(message));
export const decoded = Email.decodeEmailMessage({});
export const recording: Layer.Layer<EmailService.EmailService> =
  EmailService.EmailService.layerRecording([]);

const sms: Sms.SmsMessage = { to: "+61412345678", body: "Your code is 123456" };

export const smsSent = SmsService.sendSms(sms);
export const smsDecoded = Sms.decodeSmsMessage({});
export const smsRecording: Layer.Layer<SmsService.SmsService> =
  SmsService.SmsService.layerRecording([]);

const whatsapp: WhatsApp.WhatsAppMessage = {
  _tag: "Template",
  to: "+61412345678",
  template: { id: "HX0123", variables: { "1": "123456" } },
};

export const whatsappSent = WhatsAppService.sendWhatsApp(whatsapp);
export const whatsappDecoded = WhatsApp.decodeWhatsAppMessage({});
export const whatsappRecording: Layer.Layer<WhatsAppService.WhatsAppService> =
  WhatsAppService.WhatsAppService.layerRecording([]);

// ── resend ────────────────────────────────────────────────────────────────

export const resendLayer: Layer.Layer<EmailService.EmailService, never, HttpClient.HttpClient> =
  Resend.layer({
    apiKey: Redacted.make("re_key"),
  });
export const resolved: Layer.Layer<EmailService.EmailService> = Resend.resolveTransport({
  RESEND_API_KEY: "re_key",
});
export const noop: Layer.Layer<EmailService.EmailService> = Resend.noop;
export const resendPayload: Resend.ResendSendPayload = Resend.toResendPayload(message);

// ── twilio ────────────────────────────────────────────────────────────────

export const twilioLayer: Layer.Layer<SmsService.SmsService, never, HttpClient.HttpClient> =
  Twilio.layer({
    accountSid: "AC123",
    authToken: Redacted.make("token"),
    from: "Example",
  });
export const twilioResolved: Layer.Layer<SmsService.SmsService> = Twilio.resolveTransport({
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_AUTH_TOKEN: "token",
});
export const twilioNoop: Layer.Layer<SmsService.SmsService> = Twilio.noop;
export const twilioPayload: Option.Option<Twilio.TwilioSendPayload> = Twilio.toTwilioPayload(
  { to: "+61412345678", body: "Your code is 123456" },
  { from: Option.some("Example"), messagingServiceSid: Option.none() },
);

// ── refuseRedirects: every call shape 0.2.0 accepted still compiles ─────────

/** A request as a provider executes it. */
const executed = Effect.flatMap(HttpClient.HttpClient, (http) =>
  http.execute(HttpClientRequest.get("https://api.example.test/send")),
);

/** Called directly on a request: the same type 0.2.0 answered. */
export const refusedDirect = Http.refuseRedirects(executed);

/** Point-free in a pipe, the shape every provider uses: the response and the error still infer. */
export const refusedPiped = executed.pipe(
  Http.refuseRedirects,
  Effect.mapError((error) => error.reason._tag),
  Effect.map((response) => response.status),
);

/** On an effect that answers no response (0.2.0 took any effect): still accepted. */
export const pinnedOnly = Http.refuseRedirects(Effect.succeed("not a response"));

// ── alchemy-cloudflare ────────────────────────────────────────────────────

export const resendBindings: Alchemy.Resend.ResendBindings = Alchemy.Resend.resendBindings({
  apiKey: Redacted.make("re_123"),
});

export const twilioBindings: Alchemy.Twilio.TwilioBindings = Alchemy.Twilio.twilioBindings({
  accountSid: "AC123",
  authToken: Redacted.make("token"),
  from: "+61400000000",
});

/**
 * Every compile-time assertion, exported so `noUnusedLocals` keeps them and a
 * failing one names itself in the error.
 */
export type Checks = [
  /** _refuseRedirectsKeepsARequestsType */ Assert<
    Equals<
      typeof refusedDirect,
      Effect.Effect<
        HttpClientResponse.HttpClientResponse,
        HttpClientError.HttpClientError,
        HttpClient.HttpClient
      >
    >
  >,
  /** _refuseRedirectsInfersInAPipe */ Assert<Equals<Effect.Success<typeof refusedPiped>, number>>,
  /** _refuseRedirectsTakesAnyEffect */ Assert<Equals<Effect.Success<typeof pinnedOnly>, string>>,
  /** _resultIdIsOption */ Assert<Equals<Email.EmailSendResult["id"], Option.Option<string>>>,
  /** _sendSucceedsWithResult */ Assert<Equals<Effect.Success<typeof sent>, Email.EmailSendResult>>,
  /** _sendFailsWithSendError */ Assert<Equals<Effect.Error<typeof sent>, Errors.EmailSendError>>,
  /** _sendRequiresService */ Assert<
    Equals<Effect.Services<typeof sent>, EmailService.EmailService>
  >,
  /** _decodeFailsWithValidation */ Assert<
    Equals<Effect.Error<typeof decoded>, Errors.EmailValidationError>
  >,
  /** _sendErrorTag */ Assert<Equals<Errors.EmailSendError["_tag"], "EmailSendError">>,
  /** _sendErrorStatus */ Assert<Equals<Errors.EmailSendError["status"], Option.Option<number>>>,
  /** _smsResultIdIsOption */ Assert<Equals<Sms.SmsSendResult["id"], Option.Option<string>>>,
  /** _smsSendSucceedsWithResult */ Assert<
    Equals<Effect.Success<typeof smsSent>, Sms.SmsSendResult>
  >,
  /** _smsSendFailsWithSendError */ Assert<
    Equals<Effect.Error<typeof smsSent>, Errors.SmsSendError>
  >,
  /** _smsSendRequiresService */ Assert<
    Equals<Effect.Services<typeof smsSent>, SmsService.SmsService>
  >,
  /** _smsDecodeFailsWithValidation */ Assert<
    Equals<Effect.Error<typeof smsDecoded>, Errors.SmsValidationError>
  >,
  /** _smsSendErrorTag */ Assert<Equals<Errors.SmsSendError["_tag"], "SmsSendError">>,
  /** _whatsappResultIdIsOption */ Assert<
    Equals<WhatsApp.WhatsAppSendResult["id"], Option.Option<string>>
  >,
  /** _whatsappSendSucceedsWithResult */ Assert<
    Equals<Effect.Success<typeof whatsappSent>, WhatsApp.WhatsAppSendResult>
  >,
  /** _whatsappSendFailsWithSendError */ Assert<
    Equals<Effect.Error<typeof whatsappSent>, Errors.WhatsAppSendError>
  >,
  /** _whatsappSendRequiresService */ Assert<
    Equals<Effect.Services<typeof whatsappSent>, WhatsAppService.WhatsAppService>
  >,
  /** _whatsappDecodeFailsWithValidation */ Assert<
    Equals<Effect.Error<typeof whatsappDecoded>, Errors.WhatsAppValidationError>
  >,
  /** _whatsappSendErrorTag */ Assert<
    Equals<Errors.WhatsAppSendError["_tag"], "WhatsAppSendError">
  >,
  /** _whatsappTags */ Assert<Equals<WhatsApp.WhatsAppMessage["_tag"], "Text" | "Template">>,
  /** _alchemyResendKeyRedacted */ Assert<
    Equals<Alchemy.Resend.ResendBindings["RESEND_API_KEY"], Redacted.Redacted>
  >,
  /** _alchemyResendDeployedIsEnv */ Assert<
    Alchemy.Bindings.Deployed<Alchemy.Resend.ResendBindings> extends Resend.ResendEnv ? true : false
  >,
  /** _alchemyDeployedIsInferEnv */ Assert<
    Equals<
      Alchemy.Bindings.Deployed<Alchemy.Resend.ResendBindings>,
      Cloudflare.InferEnv<Cloudflare.Worker<Alchemy.Resend.ResendBindings>>
    >
  >,
  /** _alchemyResendDeployedKeyString */ Assert<
    Equals<
      Alchemy.Bindings.Deployed<Alchemy.Resend.ResendBindings>,
      { readonly RESEND_API_KEY: string }
    >
  >,
  /** _alchemyResendIsWorkerBindings */ Assert<
    Alchemy.Resend.ResendBindings extends Alchemy.Bindings.WorkerBindings<Alchemy.Resend.ResendBindings>
      ? true
      : false
  >,
  /** _alchemyTwilioTokenRedacted */ Assert<
    Equals<Alchemy.Twilio.TwilioBindings["TWILIO_AUTH_TOKEN"], Redacted.Redacted>
  >,
  /** _alchemyTwilioDeployedIsEnv */ Assert<
    Alchemy.Bindings.Deployed<Alchemy.Twilio.TwilioBindings> extends Twilio.TwilioEnv ? true : false
  >,
  /** _alchemyTwilioDeployedIsInferEnv */ Assert<
    Equals<
      Alchemy.Bindings.Deployed<Alchemy.Twilio.TwilioBindings>,
      Cloudflare.InferEnv<Cloudflare.Worker<Alchemy.Twilio.TwilioBindings>>
    >
  >,
  /** _alchemyTwilioDeployedOptionals */ Assert<
    Equals<
      Alchemy.Bindings.Deployed<Alchemy.Twilio.TwilioBindings>,
      {
        readonly TWILIO_ACCOUNT_SID: string;
        readonly TWILIO_AUTH_TOKEN: string;
        readonly TWILIO_FROM?: string;
        readonly TWILIO_MESSAGING_SERVICE_SID?: string;
      }
    >
  >,
  /** _alchemyTwilioIsWorkerBindings */ Assert<
    Alchemy.Twilio.TwilioBindings extends Alchemy.Bindings.WorkerBindings<Alchemy.Twilio.TwilioBindings>
      ? true
      : false
  >,
  /** _resendPayloadTo */ Assert<
    Equals<Resend.ResendSendPayload["to"], readonly [string, ...Array<string>]>
  >,
];
