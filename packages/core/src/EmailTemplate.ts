/**
 * Typed, localised email templates: Schema-typed data in, a subject, an
 * accessible HTML document and a matching plain-text body out, ready to
 * become an `EmailMessage`. Renderers (the built-in `EmailHtml`, or an
 * adapter package) all produce the same {@link EmailTemplate} shape.
 *
 * @module EmailTemplate
 * @since 0.4.0
 */

import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";
import type { EmailMessage, EmailProviderTemplate } from "./Email.ts";
import { document, html, preheader, type Direction, type Html } from "./EmailHtml.ts";
import { fromHtml } from "./EmailText.ts";
import { EmailTemplateError } from "./Errors.ts";
import { issueLines } from "./internal/issues.ts";

// --- Locales ---------------------------------------------------------------

/**
 * The locale a message renders in: a canonical BCP 47 `tag` and its text
 * direction.
 *
 * @since 0.4.0
 */
export interface Locale {
  readonly tag: string;
  readonly dir: Direction;
}

// The scripts written right to left. Read from the likely script of the
// tag (`ar` → `Arab`), the same on every runtime with ICU.
const rtlScripts: ReadonlyArray<string> = [
  "Adlm",
  "Arab",
  "Hebr",
  "Mand",
  "Mend",
  "Nkoo",
  "Rohg",
  "Samr",
  "Syrc",
  "Thaa",
  "Yezi",
];

const textDirection = (tag: string): Direction =>
  Option.match(Option.fromNullishOr(new Intl.Locale(tag).maximize().script), {
    onNone: () => "ltr",
    onSome: (script) => (Arr.contains(rtlScripts, script) ? "rtl" : "ltr"),
  });

const canonical = (tag: string): Option.Option<string> =>
  Option.flatMap(Option.liftThrowable(Intl.getCanonicalLocales)(tag), Arr.head);

/**
 * Resolve a BCP 47 tag into a {@link Locale}, canonicalising it (`en-au` →
 * `en-AU`) and working out its direction. `none` for a tag that is not
 * well-formed.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import * as Option from "effect/Option";
 * import { EmailTemplate } from "@thomasfosterau/effect-connect";
 *
 * assert.deepStrictEqual(EmailTemplate.locale("he"), Option.some({ tag: "he", dir: "rtl" }));
 * assert.deepStrictEqual(EmailTemplate.locale("en-au"), Option.some({ tag: "en-AU", dir: "ltr" }));
 * ```
 *
 * @since 0.4.0
 */
export const locale = (tag: string): Option.Option<Locale> =>
  Option.map(canonical(tag), (canonicalTag) => ({
    tag: canonicalTag,
    dir: textDirection(canonicalTag),
  }));

/** One subtag shorter, skipping a singleton (`x`, `u`, …) left at the end. */
const truncate = (subtags: ReadonlyArray<string>): ReadonlyArray<string> => {
  const shorter = Arr.dropRight(subtags, 1);
  return Option.exists(Arr.last(shorter), (last) => last.length === 1)
    ? Arr.dropRight(shorter, 1)
    : shorter;
};

/** `fr-Latn-CA` → `fr-latn-ca`, `fr-latn`, `fr`. */
const candidates = (tag: string): ReadonlyArray<string> =>
  Arr.unfold(tag.toLowerCase().split("-"), (subtags: ReadonlyArray<string>) =>
    Arr.isReadonlyArrayNonEmpty(subtags)
      ? Option.some([subtags.join("-"), truncate(subtags)] as const)
      : Option.none(),
  );

/**
 * Pick the best of `supported` for the `requested` locales (most preferred
 * first), by BCP 47 lookup: `fr-CA` matches `fr-CA`, then `fr`. Malformed
 * requested tags are skipped. `none` when nothing matches.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import * as Option from "effect/Option";
 * import { EmailTemplate } from "@thomasfosterau/effect-connect";
 *
 * assert.deepStrictEqual(EmailTemplate.lookup(["en", "fr"], ["fr-CA", "en"]), Option.some("fr"));
 * assert.deepStrictEqual(EmailTemplate.lookup(["en", "fr"], ["de"]), Option.none());
 * ```
 *
 * @since 0.4.0
 */
export const lookup = (
  supported: ReadonlyArray<string>,
  requested: ReadonlyArray<string>,
): Option.Option<string> => {
  const keyed = supported.map(
    (tag) => [Option.getOrElse(canonical(tag), () => tag).toLowerCase(), tag] as const,
  );
  return Arr.findFirst(
    Arr.flatMap(Arr.getSomes(requested.map(canonical)), candidates),
    (candidate) =>
      Option.map(
        Arr.findFirst(keyed, ([key]) => key === candidate),
        ([, tag]) => tag,
      ),
  );
};

// --- Templates -------------------------------------------------------------

/**
 * A rendered email: the parts of an `EmailMessage` a template produces.
 *
 * @since 0.4.0
 */
export interface EmailContent {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

const TypeId = "~@thomasfosterau/effect-connect/EmailTemplate" as const;

/**
 * A template: its data schema, the locales it supports (empty for any), the
 * locale it falls back to, and a renderer over decoded data. Build one with
 * {@link make}, {@link localised} or an adapter package; render it with
 * {@link render} or {@link toMessage}.
 *
 * @since 0.4.0
 */
export interface EmailTemplate<S extends Schema.Top, E = never, R = never> {
  readonly [TypeId]: typeof TypeId;
  readonly data: S;
  readonly locales: ReadonlyArray<string>;
  readonly defaultLocale: string;
  readonly renderWith: (
    data: S["Type"],
    locale: Locale,
  ) => Effect.Effect<EmailContent, E | EmailTemplateError, R>;
}

/**
 * Options for {@link fromRenderer}. `locales` defaults to none (any locale);
 * `defaultLocale` to the first of `locales`, else `"en"`.
 *
 * @since 0.4.0
 */
export interface RendererOptions<S extends Schema.Top, E, R> {
  readonly data: S;
  readonly locales?: ReadonlyArray<string>;
  readonly defaultLocale?: string;
  readonly render: (
    data: S["Type"],
    locale: Locale,
  ) => Effect.Effect<EmailContent, E | EmailTemplateError, R>;
}

/**
 * Build an {@link EmailTemplate} from a renderer: the building block for
 * adapter packages. Applications usually use {@link make}.
 *
 * @since 0.4.0
 */
export const fromRenderer = <S extends Schema.Top, E = never, R = never>(
  options: RendererOptions<S, E, R>,
): EmailTemplate<S, E, R> => {
  const locales = options.locales ?? [];
  return {
    [TypeId]: TypeId,
    data: options.data,
    locales,
    defaultLocale: options.defaultLocale ?? Option.getOrElse(Arr.head(locales), () => "en"),
    renderWith: options.render,
  };
};

/**
 * What every render function of a template built with {@link make} receives
 * besides its data: the negotiated `locale` (use its `tag` for `Intl`
 * formatting), and `t`, the template's messages for that locale.
 *
 * @since 0.4.0
 */
export interface RenderContext<M> {
  readonly locale: Locale;
  readonly t: M;
}

/**
 * How a template built with {@link make} produces its plain-text body:
 * `"derive"` converts the rendered HTML with `EmailText.fromHtml`; a function
 * writes it alongside the HTML (usually with `EmailText.text`), which reads
 * better when the HTML leans on layout.
 *
 * @since 0.4.0
 */
export type TextOption<A, M> = "derive" | ((data: A, context: RenderContext<M>) => string);

/**
 * Options for {@link make}.
 *
 * - `data` — the schema the template's data decodes against.
 * - `messages` — the template's strings per locale (BCP 47 keys), such as
 *   an effect-l10n catalog's compiled messages. The keys are the locales
 *   the template supports, and `t` is the negotiated locale's entry.
 *   Without `messages` the template renders in whichever locale is asked
 *   for, and `t` is empty ({@link NoMessages}).
 * - `defaultLocale` — the locale used when none requested matches; default
 *   the first `messages` key, else `"en"`.
 * - `subject` / `preheader` — the subject line (also the document's
 *   `<title>`) and the inbox preview text.
 * - `html` — the body, inside the {@link document} shell; may be an Effect.
 * - `text` — {@link TextOption}; default `"derive"`.
 * - `shell` — `head` and `colorScheme`, passed to the shell.
 *
 * @since 0.4.0
 */
export interface MakeOptions<S extends Schema.Top, M, E, R> {
  readonly data: S;
  readonly messages?: { readonly [locale: string]: M };
  readonly defaultLocale?: string;
  readonly subject: (data: S["Type"], context: RenderContext<M>) => string;
  readonly preheader?: (data: S["Type"], context: RenderContext<M>) => string;
  readonly html: (data: S["Type"], context: RenderContext<M>) => Html | Effect.Effect<Html, E, R>;
  readonly text?: TextOption<S["Type"], M>;
  readonly shell?: {
    readonly head?: Html;
    readonly colorScheme?: "light" | "dark" | "light dark";
  };
}

/**
 * The `t` of a template built without `messages`.
 *
 * @since 0.4.0
 */
export type NoMessages = { readonly [key: string]: never };

const noMessages: NoMessages = {};

const missingLocale = (tag: string, locales: ReadonlyArray<string>) =>
  new EmailTemplateError({
    message: "The email template has no usable locale",
    issues: [
      `"${tag}" is not well-formed or not among the template's locales (${locales.join(", ")})`,
    ],
  });

/**
 * Build a template with the built-in renderer: `EmailHtml` for the body,
 * wrapped in the accessible {@link document} shell with `lang`, `dir` and a
 * `<title>` equal to the subject, and a text body written or derived.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import * as Effect from "effect/Effect";
 * import * as Schema from "effect/Schema";
 * import { EmailHtml, EmailTemplate } from "@thomasfosterau/effect-connect";
 *
 * const Welcome = EmailTemplate.make({
 *   data: Schema.Struct({ name: Schema.String }),
 *   messages: {
 *     en: { subject: "Welcome", hello: (name: string) => `Hello, ${name}!` },
 *     fr: { subject: "Bienvenue", hello: (name: string) => `Bonjour, ${name} !` },
 *   },
 *   subject: (_, { t }) => t.subject,
 *   html: ({ name }, { t }) => EmailHtml.html`<p>${t.hello(name)}</p>`,
 * });
 *
 * const content = Effect.runSync(
 *   EmailTemplate.render(Welcome, { name: "Ada" }, { locale: "fr-CA" }),
 * );
 * assert.strictEqual(content.subject, "Bienvenue");
 * assert.strictEqual(content.text, "Bonjour, Ada !");
 * assert.ok(content.html.includes('<html lang="fr" dir="ltr">'));
 * ```
 *
 * @since 0.4.0
 */
export function make<S extends Schema.Top, M, E = never, R = never>(
  options: MakeOptions<S, M, E, R> & { readonly messages: { readonly [locale: string]: M } },
): EmailTemplate<S, E, R>;
export function make<S extends Schema.Top, E = never, R = never>(
  options: MakeOptions<S, NoMessages, E, R> & { readonly messages?: never },
): EmailTemplate<S, E, R>;
export function make<S extends Schema.Top, M, E, R>(
  options: MakeOptions<S, M | NoMessages, E, R>,
): EmailTemplate<S, E, R> {
  const messages = Option.fromNullishOr(options.messages);
  const locales = Option.match(messages, { onNone: () => [], onSome: R.keys });
  return fromRenderer({
    data: options.data,
    locales,
    defaultLocale: options.defaultLocale ?? Option.getOrElse(Arr.head(locales), () => "en"),
    render: (data, target) =>
      Effect.gen(function* () {
        const t = yield* Option.match(messages, {
          onNone: () => Effect.succeed(noMessages),
          onSome: (byLocale) =>
            Effect.fromOption(R.get(byLocale, target.tag)).pipe(
              Effect.mapError(() => missingLocale(target.tag, locales)),
            ),
        });
        const context: RenderContext<M | NoMessages> = { locale: target, t };
        const subject = options.subject(data, context);
        const rendered = options.html(data, context);
        const body: Html = Effect.isEffect(rendered) ? yield* rendered : rendered;
        const hidden = Option.map(Option.fromNullishOr(options.preheader), (preview) =>
          preheader(preview(data, context)),
        );
        const text =
          options.text === undefined || options.text === "derive"
            ? fromHtml(body.value)
            : options.text(data, context);
        const shell = document({
          ...options.shell,
          lang: target.tag,
          dir: target.dir,
          title: subject,
          body: html`${hidden}${body}`,
        });
        return { subject, html: shell.value, text };
      }),
  });
}

/**
 * One template per locale behind one template: rendering negotiates the
 * locale against the keys and renders that locale's template, with the
 * data schema of the `defaultLocale` one.
 *
 * @since 0.4.0
 */
export const localised = <K extends string, S extends Schema.Top, E, R>(
  templates: { readonly [locale in K]: EmailTemplate<S, E, R> },
  options: { readonly defaultLocale: NoInfer<K> },
): EmailTemplate<S, E, R> => {
  const locales = R.keys(templates);
  return fromRenderer({
    data: templates[options.defaultLocale].data,
    locales,
    defaultLocale: options.defaultLocale,
    render: (data, target) =>
      Effect.fromOption(Arr.findFirst(R.toEntries(templates), ([key]) => key === target.tag)).pipe(
        Effect.mapError(() => missingLocale(target.tag, locales)),
        Effect.flatMap(([, template]) => template.renderWith(data, target)),
      ),
  });
};

/**
 * Options for {@link render}: `locale` is the requested locale, or a
 * preference list (most preferred first, as from `Accept-Language`).
 *
 * @since 0.4.0
 */
export interface RenderOptions {
  readonly locale?: string | ReadonlyArray<string>;
}

/** What locale negotiation reads of a template. */
interface Negotiable {
  readonly locales: ReadonlyArray<string>;
  readonly defaultLocale: string;
}

const negotiate = (
  template: Negotiable,
  requested: ReadonlyArray<string>,
): Effect.Effect<Locale, EmailTemplateError> => {
  const chosen = Arr.match(template.locales, {
    // Any locale: the first well-formed one asked for, else the default.
    onEmpty: () =>
      Option.orElse(
        Arr.findFirst(Arr.map(requested, locale), Option.isSome).pipe(Option.flatten),
        () => locale(template.defaultLocale),
      ),
    // The template's own keys, so a renderer can index by `tag`.
    onNonEmpty: (locales) =>
      Option.orElse(lookup(locales, requested), () =>
        lookup(locales, [template.defaultLocale]),
      ).pipe(
        Option.flatMap((key) =>
          Option.map(locale(key), (resolved) => ({ tag: key, dir: resolved.dir })),
        ),
      ),
  });
  return Effect.fromOption(chosen).pipe(
    Effect.mapError(() => missingLocale(template.defaultLocale, template.locales)),
  );
};

const decodeData = <S extends Schema.Top>(
  schema: S,
  data: S["Encoded"],
): Effect.Effect<S["Type"], EmailTemplateError, S["DecodingServices"]> =>
  Schema.decodeUnknownEffect(schema, { errors: "all" })(data).pipe(
    Effect.mapError(
      (error) =>
        new EmailTemplateError({
          message: "The email template's data is invalid",
          issues: issueLines(error),
        }),
    ),
  );

/**
 * Render a template: decode `data` against its schema, negotiate the locale
 * and run the renderer. Fails {@link EmailTemplateError} when the data does
 * not decode (one line per issue) or the template has no usable locale.
 *
 * @since 0.4.0
 */
export const render = <S extends Schema.Top, E, R>(
  template: EmailTemplate<S, E, R>,
  data: S["Encoded"],
  options: RenderOptions = {},
): Effect.Effect<EmailContent, E | EmailTemplateError, R | S["DecodingServices"]> =>
  Effect.gen(function* () {
    const decoded = yield* decodeData(template.data, data);
    const resolved = yield* negotiate(template, Arr.ensure(options.locale ?? []));
    return yield* template.renderWith(decoded, resolved);
  });

// --- Provider-side templates ------------------------------------------------

const ProviderTypeId = "~@thomasfosterau/effect-connect/EmailTemplate/Provider" as const;

/**
 * A template stored and rendered at the provider: {@link toMessage} turns its
 * data into an `EmailMessage` whose `template` references it, so switching a
 * message between local and provider rendering changes the template, not the
 * call site. Build one with {@link provider}.
 *
 * @since 0.4.0
 */
export interface ProviderTemplate<S extends Schema.Top> {
  readonly [ProviderTypeId]: typeof ProviderTypeId;
  readonly data: S;
  readonly locales: ReadonlyArray<string>;
  readonly defaultLocale: string;
  readonly referenceWith: (
    data: S["Type"],
    locale: Locale,
  ) => { readonly subject: string; readonly template: EmailProviderTemplate };
}

/**
 * Options for {@link provider}.
 *
 * - `data` — the schema the template's data decodes against.
 * - `id` — the provider's template id or alias: one, or one per locale
 *   (`{ en: "welcome-en", fr: "welcome-fr" }`), whose keys are then the
 *   locales the template supports.
 * - `defaultLocale` — the locale used when none requested matches; default
 *   the first `id` key, else `"en"`.
 * - `subject` — the subject, which overrides the provider template's default.
 * - `variables` — the values for the provider template's variables.
 *
 * @since 0.4.0
 */
export interface ProviderOptions<S extends Schema.Top> {
  readonly data: S;
  readonly id: string | { readonly [locale: string]: string };
  readonly defaultLocale?: string;
  readonly subject: (data: S["Type"], context: { readonly locale: Locale }) => string;
  readonly variables?: (
    data: S["Type"],
    context: { readonly locale: Locale },
  ) => { readonly [name: string]: string | number };
}

/**
 * Reference a template the provider renders (a Resend or SendGrid
 * template), with typed data and per-locale ids.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import * as Effect from "effect/Effect";
 * import * as Schema from "effect/Schema";
 * import { EmailTemplate } from "@thomasfosterau/effect-connect";
 *
 * const Welcome = EmailTemplate.provider({
 *   data: Schema.Struct({ name: Schema.String }),
 *   id: { en: "welcome-en", fr: "welcome-fr" },
 *   subject: (_, { locale }) => (locale.tag === "fr" ? "Bienvenue" : "Welcome"),
 *   variables: ({ name }) => ({ NAME: name }),
 * });
 *
 * const message = Effect.runSync(
 *   EmailTemplate.toMessage(Welcome, { name: "Ada" }, {
 *     from: { email: "noreply@example.com" },
 *     to: [{ email: "ada@example.com" }],
 *     locale: "fr-CA",
 *   }),
 * );
 * assert.deepStrictEqual(message.template, { id: "welcome-fr", variables: { NAME: "Ada" } });
 * assert.strictEqual(message.subject, "Bienvenue");
 * ```
 *
 * @since 0.4.0
 */
export const provider = <S extends Schema.Top>(
  options: ProviderOptions<S>,
): ProviderTemplate<S> => {
  const ids = P.isString(options.id) ? Option.none() : Option.some(options.id);
  const locales = Option.match(ids, { onNone: () => [], onSome: R.keys });
  const idFor = (tag: string): string =>
    Option.match(ids, {
      onNone: () => (P.isString(options.id) ? options.id : ""),
      onSome: (byLocale) => Option.getOrElse(R.get(byLocale, tag), () => ""),
    });
  return {
    [ProviderTypeId]: ProviderTypeId,
    data: options.data,
    locales,
    defaultLocale: options.defaultLocale ?? Option.getOrElse(Arr.head(locales), () => "en"),
    referenceWith: (data, target) => {
      const context = { locale: target };
      const id = idFor(target.tag);
      return {
        subject: options.subject(data, context),
        template: Option.match(Option.fromNullishOr(options.variables), {
          onNone: () => ({ id }),
          onSome: (variables) => ({ id, variables: variables(data, context) }),
        }),
      };
    },
  };
};

const isProviderTemplate = <S extends Schema.Top, E, R>(
  template: EmailTemplate<S, E, R> | ProviderTemplate<S>,
): template is ProviderTemplate<S> => P.hasProperty(template, ProviderTypeId);

/**
 * Everything of an `EmailMessage` but what a template renders, plus the
 * requested locale.
 *
 * @since 0.4.0
 */
export type Envelope = Omit<EmailMessage, "subject" | "text" | "html" | "template"> & RenderOptions;

/**
 * Render a template into an `EmailMessage` addressed by `envelope`, ready
 * for `EmailService.send`. A {@link ProviderTemplate} becomes a message that
 * references it, with no `text` or `html`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import * as Effect from "effect/Effect";
 * import * as Schema from "effect/Schema";
 * import { Email, EmailHtml, EmailService, EmailTemplate } from "@thomasfosterau/effect-connect";
 *
 * const Reset = EmailTemplate.make({
 *   data: Schema.Struct({ url: Schema.String }),
 *   subject: () => "Reset your password",
 *   html: ({ url }) =>
 *     EmailHtml.html`<p>${EmailHtml.button({ href: url, label: "Reset your password" })}</p>`,
 * });
 *
 * const sent: Array<Email.EmailMessage> = [];
 * Effect.runSync(
 *   EmailTemplate.toMessage(
 *     Reset,
 *     { url: "https://example.com/reset" },
 *     { from: { email: "noreply@example.com" }, to: [{ email: "reader@example.com" }] },
 *   ).pipe(
 *     Effect.flatMap(EmailService.send),
 *     Effect.provide(EmailService.EmailService.layerRecording(sent)),
 *   ),
 * );
 * assert.strictEqual(sent[0]?.text, "Reset your password (https://example.com/reset)");
 * ```
 *
 * @since 0.4.0
 */
export const toMessage = <S extends Schema.Top, E = never, R = never>(
  template: EmailTemplate<S, E, R> | ProviderTemplate<S>,
  data: S["Encoded"],
  envelope: Envelope,
): Effect.Effect<EmailMessage, E | EmailTemplateError, R | S["DecodingServices"]> => {
  const { locale: requested, ...address } = envelope;
  const locales = Arr.ensure(requested ?? []);
  if (isProviderTemplate(template)) {
    return Effect.gen(function* () {
      const decoded = yield* decodeData(template.data, data);
      const resolved = yield* negotiate(template, locales);
      return { ...address, ...template.referenceWith(decoded, resolved) };
    });
  }
  return Effect.map(render(template, data, { locale: locales }), (content): EmailMessage => ({
    ...address,
    ...content,
  }));
};
