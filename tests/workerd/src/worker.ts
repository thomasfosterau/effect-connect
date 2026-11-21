/**
 * The Worker under test: each exported `test` handler runs one Resend or
 * Twilio send through that provider's `resolveTransport(env)`, the call a deployed Worker makes, inside
 * workerd. Every outbound `fetch` is routed to the stub origin (`origin.js`),
 * which answers with the status named in the bearer credential and counts
 * the requests it saw for it. One more renders an email template, whose
 * locale handling leans on `Intl`, which Workers ships its own build of.
 */

import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  EmailHtml,
  EmailSendError,
  EmailService,
  EmailTemplate,
  EmailTemplateError,
  SmsSendError,
  SmsService,
} from "@thomasfosterau/effect-connect";
import { resolveTransport } from "@thomasfosterau/effect-connect-resend";
import * as Twilio from "@thomasfosterau/effect-connect-twilio";

/** The stub origin, bound as a service so a test can ask it what it saw. */
interface Origin {
  readonly fetch: (url: string) => Promise<Response>;
}

interface Env {
  readonly ORIGIN: Origin;
}

/** A scenario did not behave as a deployed Worker must. */
class Unexpected extends Schema.TaggedError<Unexpected, { readonly brand: unique symbol }>()(
  "Unexpected",
  { message: Schema.String },
) {}

const expectThat = (holds: boolean, message: string): Effect.Effect<void, Unexpected> =>
  holds ? Effect.void : Effect.fail(new Unexpected({ message }));

/** One send with a credential that tells the origin which status to answer. */
const sendAnswered = (status: number) =>
  Effect.flatMap(EmailService, (email) =>
    email.send({
      from: { email: "noreply@example.test" },
      to: [{ email: "reader@example.test" }],
      subject: "workerd",
      text: "sent from inside workerd",
    }),
  ).pipe(Effect.provide(resolveTransport({ RESEND_API_KEY: `status-${String(status)}` })));

/** One Twilio send whose auth token tells the origin which status to answer. */
const smsAnswered = (status: number) =>
  Effect.flatMap(SmsService, (sms) =>
    sms.send({ to: "+61412345678", from: "workerd", body: "sent from inside workerd" }),
  ).pipe(
    Effect.provide(
      Twilio.resolveTransport({
        TWILIO_ACCOUNT_SID: "AC_workerd",
        TWILIO_AUTH_TOKEN: `sms-status-${String(status)}`,
      }),
    ),
  );

/** How many requests the origin saw for `status`'s credential (`prefix` keeps each provider's counts apart). */
const requestsSeen = (env: Env, status: number, prefix = "") =>
  Effect.tryPromise({
    try: () =>
      env.ORIGIN.fetch(`https://origin.test/seen?key=${prefix}status-${String(status)}`).then(
        (response) => response.text(),
      ),
    catch: () => new Unexpected({ message: "the stub origin could not be asked for its count" }),
  });

const succeedsOn200 = (env: Env) =>
  Effect.gen(function* () {
    const result = yield* sendAnswered(200);
    yield* expectThat(Option.isSome(result.id), "a 200 send answered no id");
    const seen = yield* requestsSeen(env, 200);
    yield* expectThat(seen === "1", `a 200 send made ${seen} requests, expected 1`);
  });

const refuses = (env: Env, status: number) =>
  Effect.gen(function* () {
    const error = yield* Effect.flip(sendAnswered(status)).pipe(
      Effect.mapError(
        () => new Unexpected({ message: `a ${String(status)} was answered as a success` }),
      ),
    );
    yield* expectThat(error instanceof EmailSendError, "a redirect did not fail as EmailSendError");
    yield* expectThat(
      error.message === `Resend was unreachable: redirect refused (${String(status)})`,
      `unexpected message for a ${String(status)}: ${error.message}`,
    );
    const seen = yield* requestsSeen(env, status);
    yield* expectThat(seen === "1", `a ${String(status)} made ${seen} requests, expected 1`);
  });

const smsSucceedsOn201 = (env: Env) =>
  Effect.gen(function* () {
    const result = yield* smsAnswered(201);
    yield* expectThat(Option.isSome(result.id), "a 201 SMS send answered no id");
    const seen = yield* requestsSeen(env, 201, "sms-");
    yield* expectThat(seen === "1", `a 201 SMS send made ${seen} requests, expected 1`);
  });

const smsRefuses = (env: Env, status: number) =>
  Effect.gen(function* () {
    const error = yield* Effect.flip(smsAnswered(status)).pipe(
      Effect.mapError(
        () => new Unexpected({ message: `an SMS ${String(status)} was answered as a success` }),
      ),
    );
    yield* expectThat(error instanceof SmsSendError, "a redirect did not fail as SmsSendError");
    yield* expectThat(
      error.message === `Twilio was unreachable: redirect refused (${String(status)})`,
      `unexpected message for an SMS ${String(status)}: ${error.message}`,
    );
    const seen = yield* requestsSeen(env, status, "sms-");
    yield* expectThat(seen === "1", `an SMS ${String(status)} made ${seen} requests, expected 1`);
  });

const Welcome = EmailTemplate.make({
  data: Schema.Struct({ name: Schema.String }),
  messages: { en: { subject: "Welcome" }, ar: { subject: "مرحبا" } },
  subject: (_, { t }) => t.subject,
  html: ({ name }, { t }) =>
    EmailHtml.html`<p>${t.subject} ${name}</p><a href="https://example.test">Start</a>`,
});

/** A Resend send of a provider template: a JSON body with `template` and no `html` / `text`. */
const sendsProviderTemplate = (env: Env) =>
  Effect.gen(function* () {
    const result = yield* Effect.flatMap(EmailService, (email) =>
      email.send({
        from: { email: "noreply@example.test" },
        to: [{ email: "reader@example.test" }],
        subject: "workerd",
        template: { id: "welcome", variables: { NAME: "Ada", COUNT: 1 } },
      }),
    ).pipe(Effect.provide(resolveTransport({ RESEND_API_KEY: "template-status-200" })));
    yield* expectThat(Option.isSome(result.id), "a template send answered no id");
    const seen = yield* requestsSeen(env, 200, "template-");
    yield* expectThat(seen === "1", `a template send made ${seen} requests, expected 1`);
  });

const rendersTemplate = () =>
  Effect.gen(function* () {
    const content = yield* EmailTemplate.render(Welcome, { name: "<Ada>" }, { locale: "ar-EG" });
    yield* expectThat(
      content.html.includes('<html lang="ar" dir="rtl">'),
      "the template did not render an Arabic, right-to-left document",
    );
    yield* expectThat(
      content.text === "مرحبا <Ada>\n\nStart (https://example.test)",
      `unexpected derived text: ${content.text}`,
    );
  });

/** workerd's test controller, which no scenario uses. */
type TestController = Readonly<Record<string, never>>;

/**
 * A scenario as a `test` handler `workerd test` runs. This is the Worker's
 * entry point: the one place the effect is run, with the transport provided
 * from the handler's `env`.
 */
const scenario = (
  run: (
    env: Env,
  ) => Effect.Effect<void, Unexpected | EmailSendError | SmsSendError | EmailTemplateError>,
) => ({
  test: (_controller: TestController, env: Env) => Effect.runPromise(run(env)),
});

export const send200 = scenario(succeedsOn200);
export const redirect301 = scenario((env) => refuses(env, 301));
export const redirect302 = scenario((env) => refuses(env, 302));
export const redirect303 = scenario((env) => refuses(env, 303));
export const redirect307 = scenario((env) => refuses(env, 307));
export const redirect308 = scenario((env) => refuses(env, 308));
export const sms201 = scenario(smsSucceedsOn201);
export const smsRedirect302 = scenario((env) => smsRefuses(env, 302));
export const smsRedirect307 = scenario((env) => smsRefuses(env, 307));
export const template = scenario(rendersTemplate);
export const providerTemplate = scenario(sendsProviderTemplate);
