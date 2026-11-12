/**
 * The Resend provider's suite: the transport properties the preferenceflow
 * application's `apps/auth/tests/email.test.ts` pins (fixed endpoint, bearer
 * credential, refused redirects (`redirect: "manual"`), truncated error bodies, an unreadable
 * error body still failing with the status), the no-op transport's logging
 * discipline and the env resolver — ported onto the v4 core, with the
 * network stubbed at `FetchHttpClient.Fetch`. No test here reaches Resend.
 */

import { describe, expect, layer, test } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import {
  EmailSendError,
  EmailService,
  UPSTREAM_BODY_LIMIT,
  type EmailMessage,
} from "@thomasfosterau/effect-connect";
import {
  apiKeyFromEnv,
  formatAddress,
  layer as resendLayer,
  layerConfig,
  noop,
  resolveTransport,
  toResendPayload,
  type ResendEnv,
} from "../src/index.ts";

const VERIFY_URL = "https://example.test/api/auth/verify-email?token=secret-token-value";

const message = (
  to = "reader@example.test",
  subject = "Verify your email address",
): EmailMessage => ({
  from: { email: "noreply@example.test", name: "Example" },
  to: [{ email: to }],
  subject,
  text: `Confirm: ${VERIFY_URL}`,
  html: `<a href="${VERIFY_URL}">Confirm</a>`,
});

interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit;
  readonly headers: Headers;
  /** The JSON the client sent, decoded; `none` when it sent no body. */
  readonly body: Option.Option<Schema.Json>;
}

const decodeJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Json));
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Json));
/** Encodes a payload whose absent members are `undefined` — what JSON encoding drops. */
const encodePayload = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const textOf = (raw: RequestInit["body"]): Option.Option<string> =>
  P.isString(raw)
    ? Option.some(raw)
    : raw instanceof Uint8Array
      ? Option.some(new TextDecoder().decode(raw))
      : Option.none();
const Subjects = Schema.Array(Schema.Struct({ subject: Schema.String }));

/** The requests the stub `fetch` behind the current test's layer has seen. */
class StubCalls extends Context.Service<StubCalls, Array<CapturedRequest>>()(
  "effect-connect-resend/tests/StubCalls",
) {}

/**
 * A stub `fetch` that records every call in {@link StubCalls} and replies
 * with `respond`. The recorded body is the JSON the client sent, decoded.
 * Each build of the layer starts a fresh record.
 */
const stubFetch = (respond: (request: CapturedRequest) => Response | Promise<Response>) =>
  Layer.unwrap(
    Effect.sync(() => {
      const calls: Array<CapturedRequest> = [];
      const fetch: typeof globalThis.fetch = async (input, init) => {
        const headers = new Headers(init?.headers);
        const raw = init?.body;
        const captured: CapturedRequest = {
          url: input instanceof Request ? input.url : String(input),
          init: init ?? {},
          headers,
          body: Option.map(textOf(raw), decodeJson),
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

/** `FetchHttpClient` over {@link stubFetch}. */
const stubHttp = (respond: (request: CapturedRequest) => Response | Promise<Response>) =>
  FetchHttpClient.layer.pipe(Layer.provideMerge(stubFetch(respond)));

const json = (body: Schema.Json, status = 200): Response =>
  new Response(encodeJson(body), { status, headers: { "content-type": "application/json" } });
const accepted = () => json({ id: "email_1" });

const API_KEY = "test-api-key";

/** A stand-in for a platform failure (a fetch rejecting, a stream erroring). */
class StubFailure extends Schema.TaggedError<StubFailure, { readonly brand: unique symbol }>()(
  "StubFailure",
  { message: Schema.String },
) {}

/** The Resend provider over a stub `fetch` answering `respond`. */
const resendOver = (
  respond: (request: CapturedRequest) => Response | Promise<Response>,
  config: Parameters<typeof resendLayer>[0] = { apiKey: Redacted.make(API_KEY) },
) => resendLayer(config).pipe(Layer.provideMerge(stubHttp(respond)));

const sendMessage = Effect.flatMap(EmailService, (email) => email.send(message()));

describe("EmailService.send", () => {
  layer(resendOver(accepted), { buildPerTest: true })((it) => {
    it.effect("POSTs the message to Resend's fixed endpoint with a bearer credential", () =>
      Effect.gen(function* () {
        const calls = yield* StubCalls;
        const result = yield* sendMessage;

        expect(result.id).toStrictEqual(Option.some("email_1"));
        expect(calls).toHaveLength(1);
        const [request] = calls;
        // A compile-time-constant host: nothing derived from input may steer it.
        expect(request.url).toBe("https://api.resend.com/emails");
        expect(request.init.method).toBe("POST");
        expect(request.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
        expect(request.headers.get("content-type")).toContain("application/json");
        expect(request.body).toEqual(
          Option.some({
            from: "Example <noreply@example.test>",
            to: ["reader@example.test"],
            subject: "Verify your email address",
            text: `Confirm: ${VERIFY_URL}`,
            html: `<a href="${VERIFY_URL}">Confirm</a>`,
          }),
        );
      }),
    );

    it.effect(
      "refuses to follow redirects, so a 3xx can never carry the bearer token elsewhere",
      () =>
        Effect.gen(function* () {
          const calls = yield* StubCalls;
          yield* sendMessage;
          expect(calls[0].init.redirect).toBe("manual");
        }),
    );

    it.effect("layers the redirect refusal over the consumer's own RequestInit defaults", () =>
      Effect.gen(function* () {
        const calls = yield* StubCalls;
        yield* sendMessage.pipe(
          Effect.provideService(FetchHttpClient.RequestInit, { credentials: "omit" }),
        );
        expect(calls[0].init.redirect).toBe("manual");
        expect(calls[0].init.credentials).toBe("omit");
      }),
    );
  });

  layer(
    resendOver(
      () =>
        new Response("moved", {
          status: 302,
          headers: { location: "https://elsewhere.example.test/emails" },
        }),
    ),
  )((it) => {
    it.effect("fails a redirect after one request, naming only its status", () =>
      Effect.gen(function* () {
        const calls = yield* StubCalls;
        const error = yield* Effect.flip(sendMessage);

        expect(error).toBeInstanceOf(EmailSendError);
        expect(error.status).toStrictEqual(Option.some(302));
        expect(error.message).toBe("Resend was unreachable: redirect refused (302)");
        expect(error.message).not.toContain("elsewhere.example.test");
        expect(error.message).not.toContain(API_KEY);
        expect(calls).toHaveLength(1);
      }),
    );
  });

  layer(resendOver(() => new Response("x".repeat(5_000), { status: 422 })))((it) => {
    it.effect("fails with EmailSendError on a non-2xx, truncating the upstream body", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(sendMessage);

        expect(error).toBeInstanceOf(EmailSendError);
        expect(error.provider).toBe("resend");
        expect(error.status).toStrictEqual(Option.some(422));
        expect(error.message).toMatch(/422/);
        // Bounded: a vendor error body can echo request context back, so it
        // must never be embedded raw and unbounded in an error message.
        expect(error.message.length).toBeLessThan(UPSTREAM_BODY_LIMIT + 100);
        expect(error.message).not.toContain(API_KEY);
      }),
    );
  });

  layer(
    resendOver(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new StubFailure({ message: "stream already consumed" }));
            },
          }),
          { status: 500 },
        ),
    ),
  )((it) => {
    it.effect("still fails with the status when the error body cannot be read", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(sendMessage);
        expect(error.status).toStrictEqual(Option.some(500));
        expect(error.message).toMatch(/500/);
      }),
    );
  });

  layer(resendOver(() => Promise.reject(new StubFailure({ message: "network down" }))))((it) => {
    it.effect("fails with EmailSendError and no status when Resend is unreachable", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(sendMessage);
        expect(error).toBeInstanceOf(EmailSendError);
        expect(error.status).toStrictEqual(Option.none());
        expect(error.message).toContain("unreachable");
      }),
    );
  });

  layer(resendOver(() => json({ ok: true })))((it) => {
    it.effect("fails when a 2xx body is not the shape Resend documents", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(sendMessage);
        expect(error.status).toStrictEqual(Option.some(200));
        expect(error.message).toContain("unexpected body");
      }),
    );
  });

  layer(
    resendOver(accepted, { apiKey: Redacted.make(API_KEY), baseUrl: "https://stub.local/api" }),
  )((it) => {
    it.effect("honours a baseUrl override for a stub server", () =>
      Effect.gen(function* () {
        const calls = yield* StubCalls;
        yield* sendMessage;
        expect(calls[0].url).toBe("https://stub.local/api/emails");
      }),
    );
  });
});

describe("EmailService.sendBatch", () => {
  layer(resendOver(() => json({ data: [{ id: "email_1" }, { id: "email_2" }] })))((it) => {
    it.effect(
      "POSTs every message to /emails/batch in one request and maps the ids back in order",
      () =>
        Effect.gen(function* () {
          const calls = yield* StubCalls;
          const results = yield* Effect.flatMap(EmailService, (email) =>
            email.sendBatch([message("a@example.test", "one"), message("b@example.test", "two")]),
          );
          expect(results.map((result) => result.id)).toStrictEqual([
            Option.some("email_1"),
            Option.some("email_2"),
          ]);
          expect(calls).toHaveLength(1);
          expect(calls[0].url).toBe("https://api.resend.com/emails/batch");
          const sent = yield* Schema.decodeUnknownEffect(Subjects)(
            Option.getOrUndefined(calls[0].body),
          );
          expect(sent.map((entry) => entry.subject)).toEqual(["one", "two"]);
        }),
    );
  });

  layer(resendOver(() => json({ data: [] })))((it) => {
    it.effect("makes no request for an empty batch", () =>
      Effect.gen(function* () {
        const calls = yield* StubCalls;
        const results = yield* Effect.flatMap(EmailService, (email) => email.sendBatch([]));
        expect(results).toEqual([]);
        expect(calls).toHaveLength(0);
      }),
    );
  });
});

describe("toResendPayload", () => {
  test("formats recipients as `Name <address>` and maps the whole envelope", () => {
    expect(
      toResendPayload({
        from: { email: "noreply@example.test", name: "Example" },
        to: [{ email: "a@example.test", name: "A" }, { email: "b@example.test" }],
        cc: [{ email: "c@example.test" }],
        bcc: [{ email: "d@example.test", name: "D" }],
        replyTo: { email: "reply@example.test" },
        subject: "s",
        text: "t",
        html: "<p>h</p>",
        headers: { "X-Entity-Ref-ID": "abc" },
        attachments: [{ filename: "a.txt", content: "YQ==", contentType: "text/plain" }],
        tags: ["welcome"],
      }),
    ).toEqual({
      from: "Example <noreply@example.test>",
      to: ["A <a@example.test>", "b@example.test"],
      cc: ["c@example.test"],
      bcc: ["D <d@example.test>"],
      reply_to: ["reply@example.test"],
      subject: "s",
      text: "t",
      html: "<p>h</p>",
      headers: { "X-Entity-Ref-ID": "abc" },
      attachments: [{ filename: "a.txt", content: "YQ==", content_type: "text/plain" }],
      tags: [{ name: "welcome", value: "welcome" }],
    });
  });

  test("drops absent fields from the JSON it sends", () => {
    const payload = toResendPayload({
      from: { email: "noreply@example.test" },
      to: [{ email: "a@example.test" }],
      subject: "s",
      text: "t",
    });
    expect(decodeJson(encodePayload(payload))).toEqual({
      from: "noreply@example.test",
      to: ["a@example.test"],
      subject: "s",
      text: "t",
    });
  });

  test("formatAddress uses the bare address when there is no display name", () => {
    expect(formatAddress({ email: "a@example.test" })).toBe("a@example.test");
    expect(formatAddress({ email: "a@example.test", name: "A B" })).toBe("A B <a@example.test>");
  });
});

/** The lines the current test's layer has logged. */
class LoggedLines extends Context.Service<LoggedLines, Array<string>>()(
  "effect-connect-resend/tests/LoggedLines",
) {}

/** A logger that collects every log line in {@link LoggedLines}, fresh per build. */
const capturedLogs = Layer.unwrap(
  Effect.sync(() => {
    const lines: Array<string> = [];
    const collecting = Logger.make((options) => {
      lines.push(String(options.message));
    });
    return Layer.merge(Layer.succeed(LoggedLines, lines), Logger.layer([collecting]));
  }),
);

layer(Layer.merge(noop, capturedLogs), { buildPerTest: true })("noop", (it) => {
  it.effect("succeeds without an id, so an un-provisioned stage still signs users up", () =>
    Effect.gen(function* () {
      const result = yield* sendMessage;
      expect(result.id).toStrictEqual(Option.none());
    }),
  );

  it.effect("logs neither the verification URL (the token) nor the recipient (PII)", () =>
    Effect.gen(function* () {
      const lines = yield* LoggedLines;
      yield* sendMessage;
      const logged = lines.join(" ");
      // Enough to diagnose "mail is being dropped for want of a credential"…
      expect(logged).toContain("RESEND_API_KEY");
      expect(logged).toContain("Verify your email address");
      // …without accumulating every stage signup's address in Worker logs, or
      // ever writing the token-bearing URL.
      expect(logged).not.toContain("reader@example.test");
      expect(logged).not.toContain(VERIFY_URL);
      expect(logged).not.toContain("secret-token-value");
    }),
  );

  it.effect("drops a batch one message at a time, answering one result per message", () =>
    Effect.gen(function* () {
      const lines = yield* LoggedLines;
      const results = yield* Effect.flatMap(EmailService, (email) =>
        email.sendBatch([message("a@example.test", "one"), message("b@example.test", "two")]),
      );
      expect(results).toHaveLength(2);
      expect(lines).toHaveLength(2);
    }),
  );
});

describe("apiKeyFromEnv", () => {
  test("is none for an absent, null, empty or blank binding", () => {
    expect(apiKeyFromEnv({})).toStrictEqual(Option.none());
    expect(apiKeyFromEnv({ RESEND_API_KEY: undefined })).toStrictEqual(Option.none());
    expect(apiKeyFromEnv({ RESEND_API_KEY: null })).toStrictEqual(Option.none());
    expect(apiKeyFromEnv({ RESEND_API_KEY: "" })).toStrictEqual(Option.none());
    expect(apiKeyFromEnv({ RESEND_API_KEY: "   " })).toStrictEqual(Option.none());
  });

  test("accepts a plain string or an already-redacted key", () => {
    expect(Option.map(apiKeyFromEnv({ RESEND_API_KEY: "re_a" }), Redacted.value)).toStrictEqual(
      Option.some("re_a"),
    );
    expect(
      Option.map(apiKeyFromEnv({ RESEND_API_KEY: Redacted.make("re_b") }), Redacted.value),
    ).toStrictEqual(Option.some("re_b"));
  });
});

const env = (key: Option.Option<string>): ResendEnv => ({
  RESEND_API_KEY: Option.getOrUndefined(key),
});

describe("resolveTransport", () => {
  test("returns the no-op transport when no credential is configured", () => {
    expect(resolveTransport(env(Option.none()))).toBe(noop);
  });

  test("treats an empty string as no credential", () => {
    // A stage could bind `""` by hand. A blank check is what makes that the
    // same case as "unset"; a `!== undefined` test would build a real
    // transport around an empty bearer token.
    expect(resolveTransport(env(Option.some("")))).toBe(noop);
  });

  test("returns a live transport once a credential is present", () => {
    expect(resolveTransport(env(Option.some("re_test_key")))).not.toBe(noop);
  });

  // The stub is the fiber's `Fetch`, which wins over the live transport's
  // default (`globalThis.fetch`).
  layer(Layer.merge(resolveTransport(env(Option.some("re_live_key"))), stubFetch(accepted)))(
    (it) => {
      it.effect("hands the live transport the configured key, over the platform fetch", () =>
        Effect.gen(function* () {
          const calls = yield* StubCalls;
          yield* sendMessage;
          expect(calls).toHaveLength(1);
          expect(calls[0].headers.get("authorization")).toBe("Bearer re_live_key");
          expect(calls[0].init.redirect).toBe("manual");
        }),
      );
    },
  );
});

/** `layerConfig` reading its config from `provider`. */
const configuredBy = (provider: ConfigProvider.ConfigProvider) =>
  layerConfig.pipe(Layer.provide(ConfigProvider.layer(provider)));

describe("layerConfig", () => {
  layer(
    configuredBy(
      ConfigProvider.fromUnknown({
        RESEND_API_KEY: "re_from_config",
        RESEND_BASE_URL: "https://stub.local",
      }),
    ).pipe(Layer.provideMerge(stubHttp(accepted))),
  )((it) => {
    it.effect("reads RESEND_API_KEY and RESEND_BASE_URL through effect/Config", () =>
      Effect.gen(function* () {
        const calls = yield* StubCalls;
        yield* sendMessage;
        expect(calls[0].url).toBe("https://stub.local/emails");
        expect(calls[0].headers.get("authorization")).toBe("Bearer re_from_config");
      }),
    );
  });

  // rc.118: `ConfigProvider.fromEnv` treats an empty variable as missing.
  layer(
    configuredBy(
      ConfigProvider.fromEnv({ env: { RESEND_API_KEY: "re_from_env", RESEND_BASE_URL: "" } }),
    ).pipe(Layer.provideMerge(stubHttp(accepted))),
  )((it) => {
    it.effect("falls back to the default base URL when RESEND_BASE_URL is empty", () =>
      Effect.gen(function* () {
        const calls = yield* StubCalls;
        yield* sendMessage;
        expect(calls[0].url).toBe("https://api.resend.com/emails");
      }),
    );
  });

  // A layer that fails to build would fail the harness's own setup, so the
  // harness provides the `HttpClient` alone and each test builds `layerConfig`
  // over it, in the test's scope, to read the exit.
  layer(FetchHttpClient.layer)((it) => {
    it.effect("fails at layer construction when RESEND_API_KEY is empty", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          Layer.build(configuredBy(ConfigProvider.fromEnv({ env: { RESEND_API_KEY: "" } }))),
        );
        expect(exit._tag).toBe("Failure");
      }),
    );

    it.effect("fails at layer construction when RESEND_API_KEY is missing", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(Layer.build(configuredBy(ConfigProvider.fromUnknown({}))));
        expect(exit._tag).toBe("Failure");
      }),
    );
  });
});
