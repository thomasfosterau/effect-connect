import { describe, expect, layer, test } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import {
  EmailService,
  send,
  sendBatch,
  truncateUpstreamBody,
  UPSTREAM_BODY_LIMIT,
  type EmailMessage,
} from "../src/index.ts";

const message = (to: string): EmailMessage => ({
  from: { email: "sender@example.com" },
  to: [{ email: to }],
  subject: "s",
  text: "t",
});

describe("EmailService.layerRecording", () => {
  const sent: Array<EmailMessage> = [];

  layer(EmailService.layerRecording(sent))((it) => {
    it.effect("records every send and numbers the ids from 1", () =>
      Effect.gen(function* () {
        const first = yield* send(message("a@example.com"));
        const rest = yield* sendBatch([message("b@example.com"), message("c@example.com")]);
        const results = [first, ...rest];
        expect(sent.map((m) => m.to[0].email)).toEqual([
          "a@example.com",
          "b@example.com",
          "c@example.com",
        ]);
        expect(results.map((r) => r.id)).toStrictEqual([
          Option.some("recorded-1"),
          Option.some("recorded-2"),
          Option.some("recorded-3"),
        ]);
      }),
    );

    // Two more recorders, side by side: the harness provides one
    // `EmailService` per block, so the test builds these itself, in its scope.
    it.effect("is a fresh recorder per layer build, sharing nothing between arrays", () =>
      Effect.gen(function* () {
        const one: Array<EmailMessage> = [];
        const two: Array<EmailMessage> = [];
        const first = yield* Layer.build(EmailService.layerRecording(one));
        const second = yield* Layer.build(EmailService.layerRecording(two));
        yield* Context.get(first, EmailService).send(message("a@example.com"));
        yield* Context.get(second, EmailService).send(message("b@example.com"));
        expect(one).toHaveLength(1);
        expect(two).toHaveLength(1);
      }),
    );
  });
});

describe("truncateUpstreamBody", () => {
  test("bounds a vendor body to the limit", () => {
    expect(truncateUpstreamBody("x".repeat(5_000))).toHaveLength(UPSTREAM_BODY_LIMIT);
  });

  test("leaves a short body alone", () => {
    expect(truncateUpstreamBody("short")).toBe("short");
  });
});
