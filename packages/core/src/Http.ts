/**
 * The transport rules every provider applies to its vendor's HTTP API, in
 * one place: refuse redirects, bound a vendor error body, describe a failed
 * request in one loggable line, and keep a credential that is part of the
 * request URL (an incoming webhook) out of every message. Providers build their requests with
 * Effect's `HttpClient` (`effect/http`) and pass them through these helpers;
 * nothing here names a vendor.
 *
 * @module Http
 * @since 0.1.0
 */

import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import type * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import { truncateUpstreamBody, UPSTREAM_BODY_LIMIT } from "./Errors.ts";

/**
 * Whether a response is a redirect that {@link refuseRedirects} refuses: any
 * 3xx status, or the opaque redirect a browser-like runtime answers under
 * `redirect: "manual"` (status `0`, `type: "opaqueredirect"`).
 */
const isRedirect = (response: HttpClientResponse.HttpClientResponse): boolean =>
  (response.status >= 300 && response.status < 400) ||
  response.status === 0 ||
  Option.exists(HttpClientResponse.toWeb(response), (web) => web.type === "opaqueredirect");

/**
 * Release a refused response without reading it: cancel the underlying body
 * when there is one (a `fetch` response), ignoring a cancel that fails.
 */
const discardBody = (response: HttpClientResponse.HttpClientResponse): Effect.Effect<void> =>
  Option.match(
    Option.flatMapNullishOr(HttpClientResponse.toWeb(response), (web) => web.body),
    {
      onNone: () => Effect.void,
      onSome: (body) =>
        Effect.ignore(
          Effect.tryPromise({ try: () => body.cancel(), catch: () => "BodyCancelFailed" as const }),
        ),
    },
  );

/** Whether a value an effect answered is an `HttpClientResponse`. */
const isResponse = (value: unknown): value is HttpClientResponse.HttpClientResponse =>
  P.hasProperty(value, HttpClientResponse.TypeId);

/**
 * The response a refusal carries: the same status and request, and nothing
 * else. A redirect's `Location` (and any other header) is text the answering
 * host chose, so it must not ride along in an error's cause chain into a log.
 * An opaque redirect (status `0`) exposes no headers to begin with, and a
 * `Response` cannot be constructed with that status, so it is kept as it is.
 */
const withoutHeaders = (
  response: HttpClientResponse.HttpClientResponse,
): HttpClientResponse.HttpClientResponse =>
  response.status === 0
    ? response
    : HttpClientResponse.fromWeb(response.request, new Response(null, { status: response.status }));

/** Cancel a refused response's body, then fail with its status alone. */
const refuse = (
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<never, HttpClientError.HttpClientError> =>
  Effect.andThen(
    discardBody(response),
    Effect.fail(
      new HttpClientError.HttpClientError({
        reason: new HttpClientError.StatusCodeError({
          request: response.request,
          response: withoutHeaders(response),
          description: REDIRECT_REFUSED,
        }),
      }),
    ),
  );

/**
 * Run a request with redirects refused: `redirect: "manual"` is pinned on the
 * underlying `fetch`, and a redirect answer fails instead of being followed.
 *
 * Workers' default (`follow`) replays a request at the redirect target with
 * its headers, `Authorization` included, so a 3xx from a hijacked vendor host
 * would hand it the credential. `"error"` is not an option: Workers rejects
 * it on every request.
 *
 * A 3xx (or a browser's opaque redirect, status `0`) fails with an
 * `HttpClientError` whose reason is a `StatusCodeError` described as
 * `redirect refused`. Its body is cancelled unread, and the response the
 * error keeps has the status and no headers, so `Location` never reaches a
 * log. Only `redirect` is overridden in the consumer's
 * `FetchHttpClient.RequestInit`; a non-fetch `HttpClient` is refused the same
 * way.
 *
 * @since 0.1.0
 */
export const refuseRedirects = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | HttpClientError.HttpClientError, R> =>
  Effect.flatMap(Effect.serviceOption(FetchHttpClient.RequestInit), (existing) =>
    effect.pipe(
      Effect.provideService(FetchHttpClient.RequestInit, {
        ...Option.getOrElse(existing, () => ({})),
        redirect: "manual",
      }),
      Effect.tap((answer) =>
        isResponse(answer) && isRedirect(answer) ? refuse(answer) : Effect.void,
      ),
    ),
  );

/** How {@link refuseRedirects} describes the response it refuses. */
const REDIRECT_REFUSED = "redirect refused";

/**
 * Whether an HTTP status is a 2xx.
 *
 * @since 0.1.0
 */
export const isSuccessStatus = (status: number): boolean => status >= 200 && status < 300;

/**
 * The vendor's status when it answered at all (a `StatusCodeError`), else
 * `none` — the `status` a send error carries.
 *
 * @since 0.1.0
 */
export const httpErrorStatus = (error: HttpClientError.HttpClientError): Option.Option<number> =>
  error.reason._tag === "StatusCodeError"
    ? Option.some(error.reason.response.status)
    : Option.none();

/**
 * A failed request in one line: the transport's own message when there is
 * one (a `fetch` rejection names the network failure), else Effect's.
 *
 * @since 0.1.0
 */
export const describeHttpError = (error: HttpClientError.HttpClientError): string =>
  Match.value(error.reason).pipe(
    Match.tag("TransportError", (reason) =>
      P.isError(reason.cause) ? reason.cause.message : error.message,
    ),
    Match.tag("StatusCodeError", (reason) =>
      P.isUndefined(reason.description) ? error.message : describeStatus(reason),
    ),
    Match.orElse(() => error.message),
  );

/** A described `StatusCodeError` as `<description> (<status>)`: no method, no URL. */
const describeStatus = (reason: HttpClientError.StatusCodeError): string =>
  `${reason.description ?? reason._tag} (${String(reason.response.status)})`;

/**
 * `text` with every occurrence of each non-empty `secret` replaced by
 * `[redacted]` — the last line of defence for a provider whose credential is
 * part of the request URL (an incoming webhook), applied to any message it
 * composes from text it does not control.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import { redactSecrets } from "@thomasfosterau/effect-connect";
 *
 * assert.strictEqual(
 *   redactSecrets("POST https://hooks.example.test/s3cr3t failed", ["s3cr3t", ""]),
 *   "POST https://hooks.example.test/[redacted] failed",
 * );
 * ```
 *
 * @since 0.1.0
 */
export const redactSecrets = (text: string, secrets: ReadonlyArray<string>): string =>
  secrets
    .filter(Str.isNonEmpty)
    .reduce((acc, secret) => acc.split(secret).join("[redacted]"), text);

/**
 * A failed request in one line that **never names the request**: the
 * transport's own message when there is one (a `fetch` rejection names the
 * network failure), else the failure's kind (`TransportError`,
 * `InvalidUrlError`, …), with each of `secrets` redacted
 * ({@link redactSecrets}) either way.
 *
 * {@link describeHttpError} falls back on Effect's own `HttpClientError`
 * message, which carries the request's method and URL. A provider whose URL
 * is the credential (an incoming webhook: the token is a path segment) uses
 * this instead, passing the secret parts of the URL as `secrets`.
 *
 * @since 0.1.0
 */
export const describeHttpErrorWithoutUrl = (
  error: HttpClientError.HttpClientError,
  secrets: ReadonlyArray<string>,
): string =>
  redactSecrets(
    Match.value(error.reason).pipe(
      Match.tag("TransportError", (reason) =>
        P.isError(reason.cause) ? reason.cause.message : reason._tag,
      ),
      Match.tag("StatusCodeError", (reason) =>
        P.isUndefined(reason.description) ? reason._tag : describeStatus(reason),
      ),
      Match.orElse((reason) => reason._tag),
    ),
    secrets,
  );

/**
 * How many bytes of an error body {@link rejectionMessage} reads: enough for
 * `UPSTREAM_BODY_LIMIT` characters plus the longest secret (a secret that
 * starts inside the bound must be read whole to be redacted), at the 4 bytes
 * a UTF-8 character can take.
 */
const bodyReadBound = (secrets: ReadonlyArray<string>): number =>
  (UPSTREAM_BODY_LIMIT + Math.max(0, ...secrets.map((secret) => secret.length))) * 4;

/** The body could not be read; the message keeps just the status. */
class BodyUnreadable extends Schema.TaggedError<
  BodyUnreadable,
  { readonly brand: unique symbol }
>()("BodyUnreadable", {}) {}

/**
 * Read at most `bound` bytes of a `fetch` body, decoding them as UTF-8 (a
 * character cut at the bound is dropped, not mangled), then cancel the rest
 * if any is left, ignoring a cancel that fails.
 */
const readStreamPrefix = (
  body: ReadableStream<Uint8Array>,
  bound: number,
): Effect.Effect<string, BodyUnreadable> =>
  Effect.acquireUseRelease(
    Effect.try({
      try: () => ({ reader: body.getReader(), done: false }),
      catch: () => new BodyUnreadable(),
    }),
    (state) => {
      const decoder = new TextDecoder();
      const step = (text: string, bytes: number): Effect.Effect<string, BodyUnreadable> =>
        Effect.flatMap(
          Effect.tryPromise({ try: () => state.reader.read(), catch: () => new BodyUnreadable() }),
          (chunk) => {
            if (chunk.done) {
              state.done = true;
              return Effect.succeed(text + decoder.decode());
            }
            const room = bound - bytes;
            return chunk.value.byteLength >= room
              ? Effect.succeed(
                  text + decoder.decode(chunk.value.subarray(0, room), { stream: true }),
                )
              : step(
                  text + decoder.decode(chunk.value, { stream: true }),
                  bytes + chunk.value.byteLength,
                );
          },
        );
      return step("", 0);
    },
    (state) =>
      state.done
        ? Effect.sync(() => state.reader.releaseLock())
        : Effect.ignore(
            Effect.tryPromise({
              try: () => state.reader.cancel(),
              catch: () => new BodyUnreadable(),
            }),
          ),
  );

/**
 * At most `bound` bytes of a response's body, as text. A `fetch` response is
 * read from its stream and the rest cancelled, so a huge or endless error
 * body is never buffered; any other `HttpClient`'s body is read whole. A
 * response with no body reads as `""`.
 */
const readBodyPrefix = (
  response: HttpClientResponse.HttpClientResponse,
  bound: number,
): Effect.Effect<string, BodyUnreadable | HttpClientError.HttpClientError> =>
  Option.match(HttpClientResponse.toWeb(response), {
    onNone: () => response.text,
    onSome: (web) => (P.isNull(web.body) ? Effect.succeed("") : readStreamPrefix(web.body, bound)),
  });

/**
 * The message for a vendor's non-2xx answer: `<prefix>: <status>`, then the
 * response body with each of `secrets` redacted ({@link redactSecrets}) and
 * **truncated** to `UPSTREAM_BODY_LIMIT` characters. A vendor error response
 * can echo request context back, so the body is bounded before it can reach
 * a log line. Only a bounded prefix of a `fetch` body is read, and the rest
 * is cancelled, so a huge or endless body is never buffered. The prefix is
 * long enough to hold any secret that starts inside the bound, and redaction
 * runs before truncating: a secret cut in two would no longer match. A body
 * that cannot be read leaves just the status. Never fails.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import * as Effect from "effect/Effect";
 * import * as HttpClientRequest from "effect/http/HttpClientRequest";
 * import * as HttpClientResponse from "effect/http/HttpClientResponse";
 * import { rejectionMessage } from "@thomasfosterau/effect-connect";
 *
 * const response = HttpClientResponse.fromWeb(
 *   HttpClientRequest.get("https://api.example.test/send"),
 *   new Response("x".repeat(1_000), { status: 422 }),
 * );
 * const message = await Effect.runPromise(rejectionMessage(response, "Example rejected the send"));
 *
 * assert.ok(message.startsWith("Example rejected the send: 422 xxx"));
 * assert.strictEqual(message.length, "Example rejected the send: 422 ".length + 200);
 * ```
 *
 * @since 0.1.0
 */
export const rejectionMessage = (
  response: HttpClientResponse.HttpClientResponse,
  prefix: string,
  secrets: ReadonlyArray<string> = [],
): Effect.Effect<string> =>
  readBodyPrefix(response, bodyReadBound(secrets)).pipe(
    Effect.map((body) => truncateUpstreamBody(redactSecrets(body, secrets))),
    Effect.orElseSucceed(() => ""),
    Effect.map((detail) =>
      Str.isEmpty(detail)
        ? `${prefix}: ${response.status}`
        : `${prefix}: ${response.status} ${detail}`,
    ),
  );

/**
 * What {@link executeWithSecretUrl} needs to name a failure.
 *
 * @since 0.1.0
 */
export interface SecretUrlRequestOptions<E> {
  /** The vendor's name, as each message starts: `<label> was unreachable: …`, `<label> rejected the request: …`. */
  readonly label: string;
  /** The parts of the request URL that are the credential, longest first (the whole URL, then its path, then a bare token); each is redacted from every message. */
  readonly secrets: ReadonlyArray<string>;
  /** The provider's error, from a message safe to log and the vendor's status (`none` for a transport failure). */
  readonly onFailure: (message: string, status: Option.Option<number>) => E;
}

/**
 * Execute a request whose URL carries the credential (an incoming webhook,
 * where the token is a path segment), answering the response on a 2xx with
 * its body unread: the caller must read or cancel it, since under workerd an
 * unread body holds the request's I/O open. A
 * redirect is refused ({@link refuseRedirects}); a transport failure fails
 * with {@link describeHttpErrorWithoutUrl}'s line and `none`; a non-2xx
 * fails with {@link rejectionMessage}'s status and body, redacted before it
 * is truncated, and the status. Neither message ever names the
 * request URL, and `onFailure` is never handed the `HttpClientError`, whose
 * request carries it.
 *
 * @since 0.1.0
 */
export const executeWithSecretUrl = <E>(
  http: HttpClient.HttpClient,
  request: HttpClientRequest.HttpClientRequest,
  options: SecretUrlRequestOptions<E>,
): Effect.Effect<HttpClientResponse.HttpClientResponse, E> =>
  http.execute(request).pipe(
    refuseRedirects,
    Effect.mapError((error) =>
      options.onFailure(
        `${options.label} was unreachable: ${describeHttpErrorWithoutUrl(error, options.secrets)}`,
        httpErrorStatus(error),
      ),
    ),
    Effect.filterOrElse(
      (response) => isSuccessStatus(response.status),
      (response) =>
        Effect.flatMap(
          rejectionMessage(response, `${options.label} rejected the request`, options.secrets),
          (message) => Effect.fail(options.onFailure(message, Option.some(response.status))),
        ),
    ),
  );
