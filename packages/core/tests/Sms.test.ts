/**
 * Unit coverage for `./Sms`, `./SmsService` and the SMS errors — the SMS
 * message model, its boundary decoder, the contract's accessors and the
 * recording double.
 */

import { describe, describeWrapped, expect, layer, test } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  decodeSmsMessage,
  PhoneNumber,
  sendSms,
  sendSmsBatch,
  SmsMessage,
  SmsSender,
  SmsSendError,
  SmsSendResult,
  SmsService,
  SmsValidationError,
} from "../src/index.ts";

const decodePhone = Schema.decodeUnknownSync(PhoneNumber);
const decodeSender = Schema.decodeUnknownSync(SmsSender);
const decodeMessage = Schema.decodeUnknownSync(SmsMessage);

describe("PhoneNumber", () => {
  test("accepts an E.164 number", () => {
    expect(decodePhone("+61412345678")).toBe("+61412345678");
    expect(decodePhone("+14155550100")).toBe("+14155550100");
  });

  test("rejects a national-format, punctuated, leading-zero or over-long number", () => {
    expect(() => decodePhone("0412345678")).toThrow(Schema.SchemaError);
    expect(() => decodePhone("+61 412 345 678")).toThrow(Schema.SchemaError);
    expect(() => decodePhone("+0412345678")).toThrow(Schema.SchemaError);
    expect(() => decodePhone(`+1${"2".repeat(15)}`)).toThrow(Schema.SchemaError);
  });
});

describe("SmsSender", () => {
  test("accepts an E.164 number, a short code and an alphanumeric sender ID", () => {
    expect(decodeSender("+61412345678")).toBe("+61412345678");
    expect(decodeSender("12345")).toBe("12345");
    expect(decodeSender("Example Co")).toBe("Example Co");
  });

  test("rejects an alphanumeric sender over 11 characters or with punctuation", () => {
    expect(() => decodeSender("Example Company")).toThrow(Schema.SchemaError);
    expect(() => decodeSender("Example!")).toThrow(Schema.SchemaError);
    expect(() => decodeSender("")).toThrow(Schema.SchemaError);
  });
});

describe("SmsMessage", () => {
  test("leaves the from key absent when it was absent", () => {
    expect(decodeMessage({ to: "+61412345678", body: "hi" })).toEqual({
      to: "+61412345678",
      body: "hi",
    });
  });

  test("rejects an empty body", () => {
    expect(() => decodeMessage({ to: "+61412345678", body: "" })).toThrow(Schema.SchemaError);
  });
});

describeWrapped("decodeSmsMessage", (it) => {
  it.effect("succeeds with the typed message", () =>
    Effect.gen(function* () {
      const message = yield* decodeSmsMessage({
        to: "+61412345678",
        from: "Example",
        body: "Your code is 123456",
      });
      expect(message.from).toBe("Example");
    }),
  );

  it.effect("fails with an SmsValidationError listing each issue", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decodeSmsMessage({ to: "0412 345 678", body: 1 }));
      expect(error).toBeInstanceOf(SmsValidationError);
      expect(error._tag).toBe("SmsValidationError");
      // `errors: "all"`: both the recipient and the body are reported.
      expect(error.issues.join("\n")).toContain("to");
      expect(error.issues.join("\n")).toContain("body");
    }),
  );
});

describe("SmsSendResult", () => {
  test("encodes `none` as an absent key, so a result is plain JSON", () => {
    expect(Schema.encodeSync(SmsSendResult)({ id: Option.none() })).toEqual({});
    expect(Schema.decodeUnknownSync(SmsSendResult)({ id: "SM1" }).id).toStrictEqual(
      Option.some("SM1"),
    );
  });
});

describe("SmsService.layerRecording", () => {
  const sent: Array<SmsMessage> = [];

  layer(SmsService.layerRecording(sent))((it) => {
    it.effect("records every send and numbers the ids from 1", () =>
      Effect.gen(function* () {
        const first = yield* sendSms({ to: "+61400000001", body: "one" });
        const rest = yield* sendSmsBatch([
          { to: "+61400000002", body: "two" },
          { to: "+61400000003", body: "three" },
        ]);
        const results = [first, ...rest];
        expect(sent.map((m) => m.body)).toEqual(["one", "two", "three"]);
        expect(results.map((r) => r.id)).toStrictEqual([
          Option.some("recorded-1"),
          Option.some("recorded-2"),
          Option.some("recorded-3"),
        ]);
      }),
    );
  });
});

describeWrapped("SmsSendError", (it) => {
  it.effect("is yieldable and tagged", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        Effect.gen(function* () {
          return yield* new SmsSendError({
            provider: "test",
            message: "rejected",
            status: Option.some(400),
          });
        }),
      );
      expect(error._tag).toBe("SmsSendError");
      expect(error.status).toStrictEqual(Option.some(400));
    }),
  );
});
