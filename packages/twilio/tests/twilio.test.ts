// The network is stubbed at `FetchHttpClient.Fetch`; nothing reaches Twilio.

import { describe, expect, layer, test } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import {
  SmsSendError,
  SmsService,
  UPSTREAM_BODY_LIMIT,
  type SmsMessage,
} from "@thomasfosterau/effect-connect";
import {
  configFromEnv,
  layer as twilioLayer,
  layerConfig,
  resolveTransport,
  toTwilioPayload,
} from "../src/index.ts";

const ACCOUNT_SID = "AC_test_account";
const AUTH_TOKEN = "test-auth-token";
const BASIC = Base64.encode(`${ACCOUNT_SID}:${AUTH_TOKEN}`);
const CODE = "654321";

const message = (overrides: Partial<SmsMessage> = {}): SmsMessage => ({
  to: "+61412345678",
  body: `Your verification code: ${CODE}`,
  ...overrides,
});

interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit;
  readonly headers: Headers;
  /** The form fields the client sent; empty when it sent no body. */
  readonly form: Readonly<Record<string, string>>;
}

const textOf = (raw: RequestInit["body"]): string =>
  P.isString(raw)
    ? raw
    : raw instanceof Uint8Array
      ? new TextDecoder().decode(raw)
      : raw instanceof URLSearchParams
        ? raw.toString()
        : "";

/** The requests the stub `fetch` behind the current test's layer has seen. */
class StubCalls extends Context.Service<StubCalls, Array<CapturedRequest>>()(
  "effect-connect-twilio/tests/StubCalls",
) {}

const stubFetch = (respond: (request: CapturedRequest) => Response | Promise<Response>) =>
  Layer.unwrap(
    Effect.sync(() => {
      const calls: Array<CapturedRequest> = [];
      const fetch: typeof globalThis.fetch = async (input, init) => {
        const captured: CapturedRequest = {
          url: input instanceof Request ? input.url : String(input),
          init: init ?? {},
          headers: new Headers(init?.headers),
          form: R.fromEntries(new URLSearchParams(textOf(init?.body))),
        };
        calls.push(captured);
        return respond(captured);
      };
      return Layer.merge(
        Layer.succeed(StubCalls, calls),
        Layer.succeed(FetchHttpClient.Fetch, fetch),
      );
    }),
  );

const stubHttp = (respond: (request: CapturedRequest) => Response | Promise<Response>) =>
  FetchHttpClient.layer.pipe(Layer.provideMerge(stubFetch(respond)));

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Json));
const json = (body: Schema.Json, status = 201): Response =>
  new Response(encodeJson(body), { status, headers: { "content-type": "application/json" } });
const accepted = () => json({ sid: "SM123" });

class StubFailure extends Schema.TaggedError<StubFailure, { readonly brand: unique symbol }>()(
  "StubFailure",
  { message: Schema.String },
) {}

const defaultConfig: Parameters<typeof twilioLayer>[0] = {
  accountSid: ACCOUNT_SID,
  authToken: Redacted.make(AUTH_TOKEN),
  from: "+61400000000",
};

const twilioOver = (
  respond: (request: CapturedRequest) => Response | Promise<Response>,
  config: Parameters<typeof twilioLayer>[0] = defaultConfig,
) => twilioLayer(config).pipe(Layer.provideMerge(stubHttp(respond)));

const sendMessage = (overrides: Partial<SmsMessage> = {}) =>
  Effect.flatMap(SmsService, (sms) => sms.send(message(overrides)));

describe("SmsService.send", () => {
  layer(twilioOver(accepted), { buildPerTest: true })((it) => {
    it.effect("POSTs the form to the account's Messages endpoint with Basic auth", () =>
      Effect.gen(function* () {
        const calls = yield* StubCalls;
        const result = yield* sendMessage();

        expect(result.id).toStrictEqual(Option.some("SM123"));
        expect(calls).toHaveLength(1);
        const [request] = calls;
        expect(request.url).toBe(
          `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
        );
        expect(request.init.method).toBe("POST");
        expect(request.headers.get("authorization")).toBe(`Basic ${BASIC}`);
        expect(request.headers.get("content-type")).toContain("application/x-www-form-urlencoded");
        expect(request.form).toEqual({
          To: "+61412345678",
          From: "+61400000000",
          Body: `Your verification code: ${CODE}`,
        });
      }),
    );

    it.effect("prefers the message's own sender to the configured one", () =>
      Effect.gen(function* () {
        const calls = yield* StubCalls;
        yield* sendMessage({ from: "Example" });
        expect(calls[0].form.From).toBe("Example");
      }),
    );

    it.effect("refuses to follow redirects, layered over the consumer's RequestInit", () =>
      Effect.gen(function* () {
        const calls = yield* StubCalls;
        yield* sendMessage().pipe(
          Effect.provideService(FetchHttpClient.RequestInit, { credentials: "omit" }),
        );
        expect(calls[0].init.redirect).toBe("manual");
        expect(calls[0].init.credentials).toBe("omit");
      }),
    );
  });

  layer(
    twilioOver(accepted, {
      accountSid: ACCOUNT_SID,
      authToken: Redacted.make(AUTH_TOKEN),
      messagingServiceSid: "MG123",
    }),
  )((it) => {
    it.effect("falls back to the Messaging Service when no sender is named", () =>
      Effect.gen(function* () {
        const calls = yield* StubCalls;
        yield* sendMessage();
        expect(calls[0].form).toEqual({
          To: "+61412345678",
          MessagingServiceSid: "MG123",
          Body: `Your verification code: ${CODE}`,
        });
      }),
    );
  });

  layer(twilioOver(accepted, { accountSid: ACCOUNT_SID, authToken: Redacted.make(AUTH_TOKEN) }))(
    (it) => {
      it.effect("fails before any request when no sender is named anywhere", () =>
        Effect.gen(function* () {
          const calls = yield* StubCalls;
          const error = yield* Effect.flip(sendMessage());
          expect(error).toBeInstanceOf(SmsSendError);
          expect(error.status).toStrictEqual(Option.none());
          expect(error.message).toContain("needs a sender");
          expect(calls).toHaveLength(0);
        }),
      );
    },
  );

  layer(
    twilioOver(
      () =>
        new Response("moved", {
          status: 307,
          headers: { location: "https://elsewhere.example.test/Messages.json" },
        }),
    ),
  )((it) => {
    it.effect("fails a redirect after one request, naming only its status", () =>
      Effect.gen(function* () {
        const calls = yield* StubCalls;
        const error = yield* Effect.flip(sendMessage());
        expect(error.status).toStrictEqual(Option.some(307));
        expect(error.message).toBe("Twilio was unreachable: redirect refused (307)");
        expect(calls).toHaveLength(1);
      }),
    );
  });

  layer(
    twilioOver(() =>
      json(
        {
          code: 21211,
          message: `Invalid 'To' for token ${AUTH_TOKEN} and ${BASIC} ${"x".repeat(5_000)}`,
          status: 400,
        },
        400,
      ),
    ),
  )((it) => {
    it.effect("fails a non-2xx with a truncated body that never holds the credential", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(sendMessage());
        expect(error).toBeInstanceOf(SmsSendError);
        expect(error.provider).toBe("twilio");
        expect(error.status).toStrictEqual(Option.some(400));
        expect(error.message).toContain("21211");
        expect(error.message.length).toBeLessThan(UPSTREAM_BODY_LIMIT + 100);
        expect(error.message).not.toContain(AUTH_TOKEN);
        expect(error.message).not.toContain(BASIC);
        expect(error.message).not.toContain(CODE);
      }),
    );
  });

  layer(
    twilioOver(() =>
      // The token starts a few characters before the truncation limit.
      json({ message: `${"x".repeat(UPSTREAM_BODY_LIMIT - 20)}${AUTH_TOKEN}` }, 401),
    ),
  )((it) => {
    it.effect("redacts a credential before truncating, so no part of it survives a cut", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(sendMessage());
        expect(error.message).not.toContain(AUTH_TOKEN.slice(0, 8));
      }),
    );
  });

  layer(twilioOver(() => Promise.reject(new StubFailure({ message: "network down" }))))((it) => {
    it.effect("fails with no status when Twilio is unreachable", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(sendMessage());
        expect(error.status).toStrictEqual(Option.none());
        expect(error.message).toContain("unreachable");
      }),
    );
  });

  layer(twilioOver(() => json({ ok: true })))((it) => {
    it.effect("fails when a 2xx body is not the shape Twilio documents", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(sendMessage());
        expect(error.status).toStrictEqual(Option.some(201));
        expect(error.message).toContain("unexpected body");
      }),
    );
  });
});

describe("SmsService.sendBatch", () => {
  layer(twilioOver((request) => json({ sid: `SM-${request.form.To}` })))((it) => {
    it.effect("sends one request per message and answers the ids in order", () =>
      Effect.gen(function* () {
        const calls = yield* StubCalls;
        const results = yield* Effect.flatMap(SmsService, (sms) =>
          sms.sendBatch([message({ to: "+61411111111" }), message({ to: "+61422222222" })]),
        );
        expect(results.map((result) => result.id)).toStrictEqual([
          Option.some("SM-+61411111111"),
          Option.some("SM-+61422222222"),
        ]);
        expect(calls).toHaveLength(2);
      }),
    );
  });
});

describe("toTwilioPayload", () => {
  test("answers none when no sender is available", () => {
    expect(
      toTwilioPayload(message(), { from: Option.none(), messagingServiceSid: Option.none() }),
    ).toStrictEqual(Option.none());
  });
});

/** `layerConfig` reading its config from `env`. */
const configuredBy = (env: Record<string, string>) =>
  layerConfig.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));

describe("layerConfig", () => {
  layer(
    configuredBy({
      TWILIO_ACCOUNT_SID: ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: AUTH_TOKEN,
      TWILIO_FROM: "Example",
      TWILIO_BASE_URL: "https://stub.local",
    }).pipe(Layer.provideMerge(stubHttp(accepted))),
  )((it) => {
    it.effect("reads the account, token, sender and host through effect/Config", () =>
      Effect.gen(function* () {
        const calls = yield* StubCalls;
        yield* sendMessage();
        expect(calls[0].url).toBe(
          `https://stub.local/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
        );
        expect(calls[0].headers.get("authorization")).toBe(`Basic ${BASIC}`);
        expect(calls[0].form.From).toBe("Example");
      }),
    );
  });

  // A layer that fails to build would fail the harness's own setup, so each
  // test builds `layerConfig` in its own scope to read the exit.
  layer(FetchHttpClient.layer)((it) => {
    it.effect("fails at layer construction without an auth token", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          Layer.build(configuredBy({ TWILIO_ACCOUNT_SID: ACCOUNT_SID, TWILIO_AUTH_TOKEN: "" })),
        );
        expect(exit._tag).toBe("Failure");
      }),
    );
  });
});

describe("configFromEnv", () => {
  test("needs both the SID and the token", () => {
    expect(configFromEnv({ TWILIO_ACCOUNT_SID: ACCOUNT_SID })).toStrictEqual(Option.none());
    expect(configFromEnv({ TWILIO_ACCOUNT_SID: " ", TWILIO_AUTH_TOKEN: AUTH_TOKEN })).toStrictEqual(
      Option.none(),
    );
  });

  test("drops a blank optional binding", () => {
    const config = configFromEnv({
      TWILIO_ACCOUNT_SID: ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: AUTH_TOKEN,
      TWILIO_FROM: "  ",
      TWILIO_MESSAGING_SERVICE_SID: "MG123",
    });
    expect(Option.map(config, (value) => "from" in value)).toStrictEqual(Option.some(false));
    expect(Option.map(config, (value) => value.messagingServiceSid)).toStrictEqual(
      Option.some("MG123"),
    );
  });
});

/** The lines the current test's layer has logged. */
class LoggedLines extends Context.Service<LoggedLines, Array<string>>()(
  "effect-connect-twilio/tests/LoggedLines",
) {}

const capturedLogs = Layer.unwrap(
  Effect.sync(() => {
    const lines: Array<string> = [];
    const collecting = Logger.make((options) => {
      lines.push(String(options.message));
    });
    return Layer.merge(Layer.succeed(LoggedLines, lines), Logger.layer([collecting]));
  }),
);

layer(Layer.merge(resolveTransport({}), capturedLogs), { buildPerTest: true })(
  "resolveTransport without credentials",
  (it) => {
    it.effect("is the noop, which logs neither the recipient nor the code", () =>
      Effect.gen(function* () {
        const lines = yield* LoggedLines;
        const result = yield* sendMessage();
        expect(result.id).toStrictEqual(Option.none());
        const logged = lines.join(" ");
        expect(logged).toContain("effect-connect-twilio");
        expect(logged).not.toContain("+61412345678");
        expect(logged).not.toContain(CODE);
      }),
    );
  },
);
