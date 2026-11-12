/**
 * Unit coverage for `./Transport` — the Worker-edge helpers every provider's
 * `configFromEnv`, `resolveTransport(env)` and `noop` are built from. The
 * providers' own suites pin each of those end to end.
 */

import { describe, expect, layer, test } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import {
  boundSecret,
  boundString,
  droppingSender,
  selectTransport,
  SmsService,
  type SmsMessage,
} from "../src/index.ts";

describe("boundString", () => {
  test("is some for a non-blank value, none for absent, null, empty or blank", () => {
    expect(boundString("x")).toStrictEqual(Option.some("x"));
    expect([undefined, null, "", "   "].map(boundString)).toStrictEqual(
      Array.from({ length: 4 }, () => Option.none()),
    );
  });
});

describe("boundSecret", () => {
  test("wraps a plain string and keeps an already-redacted one", () => {
    expect(Option.map(boundSecret("a"), Redacted.value)).toStrictEqual(Option.some("a"));
    const redacted = Redacted.make("b");
    expect(boundSecret(redacted)).toStrictEqual(Option.some(redacted));
  });

  test("is none for absent, null, empty or blank, plain or redacted", () => {
    const values = [undefined, null, "", "  ", Redacted.make(""), Redacted.make(" ")];
    expect(values.map(boundSecret)).toStrictEqual(values.map(() => Option.none()));
  });
});

// A live "provider" that makes one request with the HttpClient it is given.
const live = (host: string) =>
  Layer.effect(
    SmsService,
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient;
      const send = (_message: SmsMessage) =>
        http
          .execute(HttpClientRequest.get(`${host}/send`))
          .pipe(Effect.as({ id: Option.some("live") }), Effect.orDie);
      return {
        send,
        sendBatch: (messages) => Effect.forEach(messages, send, { concurrency: 1 }),
      };
    }),
  );

describe("selectTransport", () => {
  const fallback = SmsService.layerRecording([]);

  const urls: Array<string> = [];
  const fetch: typeof globalThis.fetch = async (input) => {
    urls.push(input instanceof Request ? input.url : String(input));
    return new Response("{}");
  };

  test("is the fallback, untouched, when the config is none", () => {
    expect(selectTransport(Option.none(), () => fallback, fallback)).toBe(fallback);
  });

  layer(selectTransport(Option.some("https://stub.test"), live, fallback))((it) => {
    it.effect("builds the live layer from the config, over the platform fetch", () =>
      // The fiber's `Fetch` wins over the layer's default (`globalThis.fetch`).
      Effect.gen(function* () {
        const result = yield* Effect.flatMap(SmsService, (sms) =>
          sms.send({ to: "+61400000000", body: "b" }),
        );
        expect(result.id).toStrictEqual(Option.some("live"));
        expect(urls).toEqual(["https://stub.test/send"]);
      }).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch)),
    );
  });
});

describe("droppingSender", () => {
  const lines: Array<string> = [];
  const logger = Logger.make(({ message }) => {
    lines.push(String(message));
  });

  layer(Logger.layer([logger]))((it) => {
    it.effect("succeeds with no id and logs the provider's line, once per message", () =>
      Effect.gen(function* () {
        const sender = droppingSender<SmsMessage>((message) => `dropping ${message.to.length}`);
        const results = yield* sender.sendBatch([
          { to: "+61400000001", body: "one" },
          { to: "+61400000002", body: "two" },
        ]);
        expect(results.map((result) => result.id)).toStrictEqual([Option.none(), Option.none()]);
        expect(lines).toEqual(["dropping 12", "dropping 12"]);
      }),
    );
  });
});
