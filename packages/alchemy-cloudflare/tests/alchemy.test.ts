/**
 * The binding builders against each provider's own env contract: every
 * builder's output, and the `Deployed` view of it a Worker receives (secrets
 * as plain strings), must be assignable to the provider's `…Env` type and be
 * read back as a live configuration by its resolver. Each record must be a
 * `Cloudflare.Worker` `env` the provider accepts (`WorkerBindingProps`), and
 * the env alchemy itself infers for a Worker bound with it
 * (`Cloudflare.InferEnv`) must be that same `Deployed` view.
 */

import { describe, expect, it } from "@effect/vitest";
import type * as Cloudflare from "@alchemy.run/cloudflare";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { Resend } from "@thomasfosterau/effect-connect-resend";
import { Twilio } from "@thomasfosterau/effect-connect-twilio";
import {
  type Deployed,
  type WorkerBindings,
} from "@thomasfosterau/effect-connect-alchemy-cloudflare/Bindings";
import {
  resendBindings,
  resendBindingsConfig,
  type ResendBindings,
} from "@thomasfosterau/effect-connect-alchemy-cloudflare/Resend";
import {
  twilioBindings,
  twilioBindingsConfig,
  type TwilioBindings,
} from "@thomasfosterau/effect-connect-alchemy-cloudflare/Twilio";

// What a Worker reads back: Alchemy deploys a `Redacted` as a secret binding,
// which arrives as a plain string, and a string as a plain one; every other
// value is left out. The runtime view is a plain string record; the
// compile-time `Checks` below pin `Deployed<B>` against each provider's env.
// The bindings record, parsed: each value is a `Redacted` (a secret binding)
// or a string (a plain one).
const BindingsRecord = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Redacted(Schema.String)]),
);
const deploy = (bindings: ResendBindings | TwilioBindings): Record<string, string> =>
  R.map(Schema.decodeUnknownSync(BindingsRecord)(bindings), (value) =>
    Redacted.isRedacted(value) ? Redacted.value(value) : value,
  );

const fromEnv = (env: Record<string, string>) => ConfigProvider.fromEnv({ env });

// Compile-time: each record, as bound and as deployed, is the provider's env.
type Extends<A, B> = [A] extends [B] ? true : false;
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

// The `env` alchemy infers for a Cloudflare Worker whose `env` prop is the
// bindings record `B`.
type WorkerEnv<B> = Cloudflare.InferEnv<Cloudflare.Worker<B>>;
export type Checks = [
  Assert<Extends<ResendBindings, Resend.ResendEnv>>,
  Assert<Extends<Deployed<ResendBindings>, Resend.ResendEnv>>,
  Assert<Extends<TwilioBindings, Twilio.TwilioEnv>>,
  Assert<Extends<Deployed<TwilioBindings>, Twilio.TwilioEnv>>,
  Assert<
    Equals<
      Deployed<TwilioBindings>,
      {
        readonly TWILIO_ACCOUNT_SID: string;
        readonly TWILIO_AUTH_TOKEN: string;
        readonly TWILIO_FROM?: string;
        readonly TWILIO_MESSAGING_SERVICE_SID?: string;
      }
    >
  >,
  // An optional binding deploys as an optional string, not `?: never`,
  // and a secret as a plain one.
  Assert<
    Equals<
      Deployed<{ readonly KEY: Redacted.Redacted; readonly FROM?: string }>,
      { readonly KEY: string; readonly FROM?: string }
    >
  >,
];

// Compile-time, against alchemy's own model of a deploy: the env a Worker
// bound with each record receives is the provider's env, and is exactly the
// package's `Deployed` view of that record (so neither model drifts, and an
// `any` from either side fails `Equals`).
export type InferEnvChecks = [
  Assert<Extends<WorkerEnv<ResendBindings>, Resend.ResendEnv>>,
  Assert<Equals<WorkerEnv<ResendBindings>, Deployed<ResendBindings>>>,
  // Every record is a binding record the provider accepts as a Worker's `env`.
  Assert<Extends<ResendBindings, WorkerBindings<ResendBindings>>>,
  Assert<
    Extends<
      { readonly [K in keyof ResendBindings]: ResendBindings[K] },
      Cloudflare.WorkerBindingProps
    >
  >,
  Assert<Extends<WorkerEnv<TwilioBindings>, Twilio.TwilioEnv>>,
  Assert<Equals<WorkerEnv<TwilioBindings>, Deployed<TwilioBindings>>>,
  Assert<Extends<TwilioBindings, WorkerBindings<TwilioBindings>>>,
  Assert<
    Extends<
      { readonly [K in keyof TwilioBindings]: TwilioBindings[K] },
      Cloudflare.WorkerBindingProps
    >
  >,
];

// A record holding something that is not a Worker binding is no
// `WorkerBindings`, so `Deployed` rejects it.
type NonBinding = { readonly KEY: () => void };
export type RejectsNonBinding = Assert<
  Equals<Extends<NonBinding, WorkerBindings<NonBinding>>, false>
>;

describe("resendBindings", () => {
  it("binds the key under RESEND_API_KEY, which the resolver reads once deployed", () => {
    const bindings = resendBindings({ apiKey: Redacted.make("re_123") });
    expect(R.keys(bindings)).toEqual(["RESEND_API_KEY"]);
    const env = deploy(bindings);
    expect(env).toEqual({ RESEND_API_KEY: "re_123" });
    expect(Option.map(Resend.apiKeyFromEnv(env), Redacted.value)).toEqual(Option.some("re_123"));
  });

  it.effect("reads the key on the deploy machine, and fails without it", () =>
    Effect.gen(function* () {
      const bindings = yield* resendBindingsConfig.parse(fromEnv({ RESEND_API_KEY: "re_123" }));
      expect(deploy(bindings)).toStrictEqual({ RESEND_API_KEY: "re_123" });
      expect((yield* Effect.exit(resendBindingsConfig.parse(fromEnv({}))))._tag).toBe("Failure");
    }),
  );
});

// The configuration the Twilio resolver reads from a deployed env, its token
// unwrapped so it compares structurally.
const resolved = (env: Record<string, string>) =>
  Option.map(Twilio.configFromEnv(env), ({ authToken, ...rest }) => ({
    ...rest,
    authToken: Redacted.value(authToken),
  }));

const parseTwilio = (env: Record<string, string>) =>
  Effect.exit(twilioBindingsConfig.parse(fromEnv(env)));

describe("twilioBindings", () => {
  const authToken = Redacted.make("token");

  it("binds every value under its TWILIO_ key, which the resolver reads once deployed", () => {
    const bindings = twilioBindings({
      accountSid: "AC123",
      authToken,
      from: "+61400000000",
      messagingServiceSid: "MG123",
    });
    expect(Redacted.isRedacted(bindings.TWILIO_AUTH_TOKEN)).toBe(true);
    const env = deploy(bindings);
    expect(env).toStrictEqual({
      TWILIO_ACCOUNT_SID: "AC123",
      TWILIO_AUTH_TOKEN: "token",
      TWILIO_FROM: "+61400000000",
      TWILIO_MESSAGING_SERVICE_SID: "MG123",
    });
    expect(resolved(env)).toStrictEqual(
      Option.some({
        accountSid: "AC123",
        authToken: "token",
        from: "+61400000000",
        messagingServiceSid: "MG123",
      }),
    );
  });

  it("leaves an unset or blank optional value out of the record", () => {
    const bound = { TWILIO_ACCOUNT_SID: "AC123", TWILIO_AUTH_TOKEN: authToken };
    expect(twilioBindings({ accountSid: "AC123", authToken })).toStrictEqual(bound);
    const blank = twilioBindings({
      accountSid: "AC123",
      authToken,
      from: "",
      messagingServiceSid: "  ",
    });
    expect(blank).toStrictEqual(bound);
    expect(resolved(deploy(blank))).toStrictEqual(
      Option.some({ accountSid: "AC123", authToken: "token" }),
    );
  });

  it.effect("reads the values on the deploy machine, leaving unset or blank optionals out", () =>
    Effect.gen(function* () {
      const full = yield* twilioBindingsConfig.parse(
        fromEnv({
          TWILIO_ACCOUNT_SID: "AC123",
          TWILIO_AUTH_TOKEN: "token",
          TWILIO_FROM: "+61400000000",
          TWILIO_MESSAGING_SERVICE_SID: "MG123",
        }),
      );
      expect(deploy(full)).toStrictEqual({
        TWILIO_ACCOUNT_SID: "AC123",
        TWILIO_AUTH_TOKEN: "token",
        TWILIO_FROM: "+61400000000",
        TWILIO_MESSAGING_SERVICE_SID: "MG123",
      });
      const bare = yield* twilioBindingsConfig.parse(
        fromEnv({ TWILIO_ACCOUNT_SID: "AC123", TWILIO_AUTH_TOKEN: "token", TWILIO_FROM: " " }),
      );
      expect(deploy(bare)).toStrictEqual({
        TWILIO_ACCOUNT_SID: "AC123",
        TWILIO_AUTH_TOKEN: "token",
      });
    }),
  );

  it.effect("fails on the deploy machine without the SID or the token", () =>
    Effect.gen(function* () {
      expect((yield* parseTwilio({ TWILIO_AUTH_TOKEN: "token" }))._tag).toBe("Failure");
      expect((yield* parseTwilio({ TWILIO_ACCOUNT_SID: "AC123" }))._tag).toBe("Failure");
      expect(
        (yield* parseTwilio({ TWILIO_ACCOUNT_SID: "AC123", TWILIO_AUTH_TOKEN: "" }))._tag,
      ).toBe("Failure");
    }),
  );
});
