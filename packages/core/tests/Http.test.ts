import { describe, describeWrapped, expect, layer, test } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import {
  describeHttpError,
  describeHttpErrorWithoutUrl,
  executeWithSecretUrl,
  httpErrorStatus,
  isSuccessStatus,
  refuseRedirects,
  redactSecrets,
  rejectionMessage,
  UPSTREAM_BODY_LIMIT,
} from "../src/index.ts";

/** A stand-in for a platform failure (a `fetch` rejection, a stream error). */
class StubFailure extends Schema.TaggedError<StubFailure, { readonly brand: unique symbol }>()(
  "StubFailure",
  {
    message: Schema.String,
  },
) {}

const request = HttpClientRequest.get("https://api.example.test/send");
const responseOf = (body: ConstructorParameters<typeof Response>[0], status: number) =>
  HttpClientResponse.fromWeb(request, new Response(body, { status }));

/**
 * `FetchHttpClient` over a `fetch` that answers `answer(body)`, where
 * `body` is a stream that records every chunk read from it and every
 * cancel, so a test can tell an unread, cancelled body from a drained one.
 */
const redirecting = (answer: (body: ReadableStream<Uint8Array>) => Response) => {
  const requests: Array<RequestInit> = [];
  const reads: Array<string> = [];
  const cancels: Array<string> = [];
  const answering: typeof globalThis.fetch = async (_input, init) => {
    requests.push(init ?? {});
    return answer(
      new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            reads.push("chunk");
            controller.enqueue(new TextEncoder().encode("https://elsewhere.example.test/next"));
          },
          cancel() {
            cancels.push("cancelled");
          },
        },
        { highWaterMark: 0 },
      ),
    );
  };
  return {
    requests,
    reads,
    cancels,
    http: FetchHttpClient.layer.pipe(
      Layer.provide(Layer.succeed(FetchHttpClient.Fetch, answering)),
    ),
  };
};

/** The headers of the response a failure retains (a marker when it retains none). */
const retainedHeaders = (error: HttpClientError.HttpClientError) =>
  Match.value(error.reason).pipe(
    Match.tag("StatusCodeError", (reason) => ({ ...reason.response.headers })),
    Match.orElse((reason) => ({ unexpected: reason._tag })),
  );

/** What every refused redirect must look like, whatever the runtime answered. */
const expectRefused = (
  error: HttpClientError.HttpClientError,
  status: number,
  probe: ReturnType<typeof redirecting>,
) => {
  expect(error.reason._tag).toBe("StatusCodeError");
  expect(httpErrorStatus(error)).toStrictEqual(Option.some(status));
  // The status alone: no method, no request URL, nothing from `Location`.
  expect(describeHttpError(error)).toBe(`redirect refused (${String(status)})`);
  expect(describeHttpErrorWithoutUrl(error, [])).toBe(`redirect refused (${String(status)})`);
  // The response the error keeps has the status and no header: `Location` is
  // text the answering host chose, and a logged cause chain must not carry it.
  expect(retainedHeaders(error)).toStrictEqual({});
  // One request (the redirect is not followed), and its body is cancelled unread.
  expect(probe.requests).toHaveLength(1);
  expect(probe.requests[0]?.redirect).toBe("manual");
  expect(probe.reads).toHaveLength(0);
  expect(probe.cancels).toHaveLength(1);
};

describe("refuseRedirects", () => {
  const inits: Array<RequestInit> = [];
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    inits.push(init ?? {});
    return new Response("{}");
  };
  const http = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
  );
  const execute = Effect.flatMap(HttpClient.HttpClient, (client) => client.execute(request));

  layer(http)((it) => {
    it.effect("pins redirect: manual over the consumer's own RequestInit", () =>
      Effect.gen(function* () {
        const response = yield* refuseRedirects(execute).pipe(
          Effect.provideService(FetchHttpClient.RequestInit, {
            credentials: "omit",
            redirect: "follow",
          }),
        );
        expect(response.status).toBe(200);
        // Never `error`: Cloudflare Workers rejects that value on every request.
        expect(inits.at(-1)?.redirect).toBe("manual");
        expect(inits.at(-1)?.credentials).toBe("omit");
      }),
    );

    it.effect("pins it when the consumer provides no RequestInit", () =>
      Effect.gen(function* () {
        yield* refuseRedirects(execute);
        expect(inits.at(-1)?.redirect).toBe("manual");
      }),
    );
  });

  [301, 302, 303, 307, 308].forEach((status) => {
    const probe = redirecting(
      (body) =>
        new Response(body, {
          status,
          headers: { location: "https://elsewhere.example.test/next" },
        }),
    );
    layer(probe.http)((it) => {
      it.effect(`refuses a ${String(status)} after one request, without reading it`, () =>
        Effect.gen(function* () {
          expectRefused(yield* Effect.flip(refuseRedirects(execute)), status, probe);
        }),
      );
    });
  });

  // A browser-like runtime answers `redirect: "manual"` with an opaque
  // redirect: status 0 and no readable headers. `Response` cannot be
  // constructed with status 0, so the two fields are redefined on a real one.
  const opaque = redirecting((body) =>
    Object.defineProperties(new Response(body), {
      status: { value: 0 },
      type: { value: "opaqueredirect" },
    }),
  );
  layer(opaque.http)((it) => {
    it.effect("refuses an opaque redirect after one request, without reading it", () =>
      Effect.gen(function* () {
        expectRefused(yield* Effect.flip(refuseRedirects(execute)), 0, opaque);
      }),
    );
  });
});

describeWrapped("refuseRedirects over a non-fetch client", (it) => {
  it.effect("refuses a 3xx response that has no Web body to cancel", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(refuseRedirects(Effect.succeed(responseOf(null, 302))));
      expect(describeHttpError(error)).toBe("redirect refused (302)");
    }),
  );

  it.effect("answers anything that is not a redirect, a 4xx included", () =>
    Effect.gen(function* () {
      const response = yield* refuseRedirects(Effect.succeed(responseOf("nope", 404)));
      expect(response.status).toBe(404);
    }),
  );
});

describe("isSuccessStatus", () => {
  test("is true for 2xx only", () => {
    expect([199, 200, 204, 299, 300, 404].map(isSuccessStatus)).toEqual([
      false,
      true,
      true,
      true,
      false,
      false,
    ]);
  });
});

describe("httpErrorStatus / describeHttpError", () => {
  test("reads the status of a StatusCodeError", () => {
    const error = new HttpClientError.HttpClientError({
      reason: new HttpClientError.StatusCodeError({ request, response: responseOf(null, 503) }),
    });
    expect(httpErrorStatus(error)).toStrictEqual(Option.some(503));
  });

  test("is none for a transport failure, described by the transport's own message", () => {
    const error = new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({
        request,
        cause: new StubFailure({ message: "network down" }),
      }),
    });
    expect(httpErrorStatus(error)).toStrictEqual(Option.none());
    expect(describeHttpError(error)).toBe("network down");
  });
});

describe("redactSecrets / describeHttpErrorWithoutUrl", () => {
  const secretRequest = HttpClientRequest.post("https://hooks.example.test/services/T1/B2/s3cr3t");

  test("replaces every occurrence of each non-empty secret", () => {
    expect(redactSecrets("a s3cr3t b s3cr3t", ["s3cr3t", ""])).toBe("a [redacted] b [redacted]");
    expect(redactSecrets("untouched", [])).toBe("untouched");
  });

  test("never carries the request URL, which Effect's own message does", () => {
    const error = new HttpClientError.HttpClientError({
      reason: new HttpClientError.StatusCodeError({
        request: secretRequest,
        response: HttpClientResponse.fromWeb(secretRequest, new Response(null, { status: 500 })),
      }),
    });
    expect(error.message).toContain("s3cr3t");
    expect(describeHttpError(error)).toContain("s3cr3t");
    expect(describeHttpErrorWithoutUrl(error, ["s3cr3t"])).toBe("StatusCodeError");
  });

  test("keeps a transport's own message, redacting the secrets in it", () => {
    const error = new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({
        request: secretRequest,
        cause: new StubFailure({ message: "connect failed for /services/T1/B2/s3cr3t" }),
      }),
    });
    expect(describeHttpErrorWithoutUrl(error, ["/services/T1/B2/s3cr3t"])).toBe(
      "connect failed for [redacted]",
    );
  });

  test("names the failure's kind for a transport failure without an Error cause", () => {
    const error = new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({ request: secretRequest, cause: "opaque" }),
    });
    expect(describeHttpErrorWithoutUrl(error, ["s3cr3t"])).toBe("TransportError");
  });
});

describe("executeWithSecretUrl", () => {
  const url = "https://hooks.example.test/services/T1/B2/s3cr3t";
  const inits: Array<RequestInit> = [];
  /** `FetchHttpClient` over a `fetch` that records its `RequestInit` and answers `respond()`. */
  const answering = (respond: () => Promise<Response>) => {
    const fetch: typeof globalThis.fetch = async (_input, init) => {
      inits.push(init ?? {});
      return respond();
    };
    return FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)));
  };
  const execute = Effect.flatMap(HttpClient.HttpClient, (http) =>
    executeWithSecretUrl(http, HttpClientRequest.post(url), {
      label: "Vendor",
      secrets: [url, "/services/T1/B2/s3cr3t"],
      onFailure: (message, status) => ({ message, status }),
    }),
  );

  layer(answering(async () => new Response("ok")))((it) => {
    it.effect("answers a 2xx response, with redirects refused", () =>
      Effect.gen(function* () {
        const response = yield* execute;
        expect(response.status).toBe(200);
        expect(inits.at(-1)?.redirect).toBe("manual");
      }),
    );
  });

  layer(
    answering(
      async () => new Response(`moved to ${url}`, { status: 307, headers: { location: url } }),
    ),
  )((it) => {
    it.effect("fails a redirect with its status alone: no body, no Location, no URL", () =>
      Effect.gen(function* () {
        expect(yield* Effect.flip(execute)).toStrictEqual({
          message: "Vendor was unreachable: redirect refused (307)",
          status: Option.some(307),
        });
      }),
    );
  });

  layer(answering(async () => new Response(`bad ${url}`, { status: 403 })))((it) => {
    it.effect("fails a non-2xx with the status and the redacted, truncated body", () =>
      Effect.gen(function* () {
        expect(yield* Effect.flip(execute)).toStrictEqual({
          message: "Vendor rejected the request: 403 bad [redacted]",
          status: Option.some(403),
        });
      }),
    );
  });

  // The secret starts inside the bound and runs past it: truncating first
  // would keep its leading part, which no longer matches a whole secret.
  const straddling = `${"x".repeat(UPSTREAM_BODY_LIMIT - 10)}${url}`;
  layer(answering(async () => new Response(straddling, { status: 400 })))((it) => {
    it.effect("redacts a secret that straddles the truncation bound", () =>
      Effect.gen(function* () {
        const { message } = yield* Effect.flip(execute);
        expect(message).toBe(
          `Vendor rejected the request: 400 ${`${"x".repeat(UPSTREAM_BODY_LIMIT - 10)}[redacted]`.slice(0, UPSTREAM_BODY_LIMIT)}`,
        );
        expect(message).not.toContain("https://hooks");
      }),
    );
  });

  layer(answering(() => Promise.reject(new StubFailure({ message: `could not reach ${url}` }))))(
    (it) => {
      it.effect("fails a transport failure with no status and no URL", () =>
        Effect.gen(function* () {
          expect(yield* Effect.flip(execute)).toStrictEqual({
            message: "Vendor was unreachable: could not reach [redacted]",
            status: Option.none(),
          });
        }),
      );
    },
  );
});

/** A body of `chunks` chunks of `size` bytes each, recording each pull and each cancel. */
const tracked = (chunks: number, size: number, onCancel: () => Promise<void> | void = () => {}) => {
  const log = { pulls: 0, cancels: 0 };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        log.pulls += 1;
        if (log.pulls > chunks) controller.close();
        else controller.enqueue(new TextEncoder().encode("y".repeat(size)));
      },
      cancel() {
        log.cancels += 1;
        return onCancel();
      },
    },
    { highWaterMark: 0 },
  );
  return { log, stream };
};

describeWrapped("rejectionMessage", (it) => {
  it.effect("names the status and a truncated body", () =>
    Effect.gen(function* () {
      const message = yield* rejectionMessage(
        responseOf("x".repeat(5_000), 422),
        "Vendor rejected the send",
      );
      expect(message).toBe(`Vendor rejected the send: 422 ${"x".repeat(UPSTREAM_BODY_LIMIT)}`);
    }),
  );

  it.effect("redacts each secret from the whole body before truncating it", () =>
    Effect.gen(function* () {
      const body = `${"x".repeat(UPSTREAM_BODY_LIMIT - 3)}s3cr3t`;
      expect(yield* rejectionMessage(responseOf(body, 401), "Vendor", ["s3cr3t"])).toBe(
        `Vendor: 401 ${`${"x".repeat(UPSTREAM_BODY_LIMIT - 3)}[redacted]`.slice(0, UPSTREAM_BODY_LIMIT)}`,
      );
    }),
  );

  it.effect("names just the status for an empty body", () =>
    Effect.gen(function* () {
      expect(yield* rejectionMessage(responseOf(null, 500), "Vendor")).toBe("Vendor: 500");
    }),
  );

  it.effect("reads a long body only as far as the bound, then cancels it once", () => {
    const { log, stream } = tracked(Number.POSITIVE_INFINITY, 100);
    return Effect.gen(function* () {
      const message = yield* rejectionMessage(responseOf(stream, 500), "Vendor");
      expect(message).toBe(`Vendor: 500 ${"y".repeat(UPSTREAM_BODY_LIMIT)}`);
      expect(log.pulls).toBeLessThanOrEqual((UPSTREAM_BODY_LIMIT * 4) / 100);
      expect(log.cancels).toBe(1);
    });
  });

  it.effect("reads a short body to its end without cancelling it", () => {
    const { log, stream } = tracked(2, 10);
    return Effect.gen(function* () {
      expect(yield* rejectionMessage(responseOf(stream, 500), "Vendor")).toBe(
        `Vendor: 500 ${"y".repeat(20)}`,
      );
      expect(log.cancels).toBe(0);
    });
  });

  it.effect("keeps the message when the cancel rejects", () => {
    const { log, stream } = tracked(Number.POSITIVE_INFINITY, 100, () =>
      Promise.reject(new StubFailure({ message: "cancel failed" })),
    );
    return Effect.gen(function* () {
      expect(yield* rejectionMessage(responseOf(stream, 500), "Vendor")).toBe(
        `Vendor: 500 ${"y".repeat(UPSTREAM_BODY_LIMIT)}`,
      );
      expect(log.cancels).toBe(1);
    });
  });

  it.effect("drops a multi-byte character cut by the read bound instead of mangling it", () =>
    Effect.gen(function* () {
      // 4-byte characters, offset by one byte so the bound falls mid-character.
      const body = `a${"😀".repeat(UPSTREAM_BODY_LIMIT)}`;
      const message = yield* rejectionMessage(responseOf(body, 500), "Vendor");
      expect(message).not.toContain("\uFFFD");
      expect(message.startsWith("Vendor: 500 a😀")).toBe(true);
    }),
  );

  it.effect("reads a secret that starts inside the bound whole, so it is redacted", () =>
    Effect.gen(function* () {
      const secret = "s".repeat(UPSTREAM_BODY_LIMIT * 4);
      const body = `${"x".repeat(UPSTREAM_BODY_LIMIT - 1)}${secret}${"z".repeat(10_000)}`;
      const message = yield* rejectionMessage(responseOf(body, 401), "Vendor", [secret]);
      expect(message).toBe(`Vendor: 401 ${"x".repeat(UPSTREAM_BODY_LIMIT - 1)}[`);
    }),
  );

  it.effect("names just the status when the body cannot be read", () => {
    const broken = new ReadableStream({
      start(controller) {
        controller.error(new StubFailure({ message: "stream already consumed" }));
      },
    });
    return Effect.gen(function* () {
      expect(yield* rejectionMessage(responseOf(broken, 500), "Vendor")).toBe("Vendor: 500");
    });
  });
});
