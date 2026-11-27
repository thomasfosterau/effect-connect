/**
 * MJML as an `EmailTemplate` renderer: the body is MJML markup, written with
 * the core's escaping `html` tag and compiled with `mjml-browser`, which
 * needs no file system and so runs on Workers and in browsers as well as on
 * Node.
 *
 * @module Mjml
 * @since 0.1.0
 */

import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import type * as Schema from "effect/Schema";
import mjml2html from "mjml-browser";
import * as EmailHtml from "@thomasfosterau/effect-connect/EmailHtml";
import * as EmailTemplate from "@thomasfosterau/effect-connect/EmailTemplate";
import * as EmailText from "@thomasfosterau/effect-connect/EmailText";
import { EmailTemplateError } from "@thomasfosterau/effect-connect/Errors";

/**
 * What the markup, subject and text functions receive besides the data: the
 * negotiated `locale`, and `t`, the template's messages for that locale.
 *
 * @since 0.1.0
 */
export interface Context<M> {
  readonly locale: EmailTemplate.Locale;
  readonly t: M;
}

/**
 * How the plain-text body is produced: `"derive"` (the core's
 * `EmailText.fromHtml` over the compiled HTML), or a function that writes it
 * alongside the markup.
 *
 * @since 0.1.0
 */
export type TextOption<A, M> = "derive" | ((data: A, context: Context<M>) => string);

/**
 * Options for {@link template}.
 *
 * - `data` — the schema the template's data decodes against.
 * - `messages` — the template's strings per locale (BCP 47 keys), the
 *   locales it supports; `t` is the negotiated locale's entry.
 * - `defaultLocale` — the locale used when none requested matches; default
 *   the first `messages` key, else `"en"`.
 * - `subject` — the subject line, which also becomes the `<mj-title>` when
 *   the markup sets none.
 * - `mjml` — the email, as MJML (`<mjml>` at its root) built with
 *   `EmailHtml.html`, which escapes every interpolation.
 * - `text` — {@link TextOption}; default `"derive"`.
 * - `validation` — `"strict"` (default) fails on any MJML validation error;
 *   `"soft"` logs them as warnings and sends what MJML compiled.
 * - `fonts` — web fonts by name, MJML's `fonts` option.
 *
 * @since 0.1.0
 */
export interface TemplateOptions<S extends Schema.Top, M> {
  readonly data: S;
  readonly messages?: { readonly [locale: string]: M };
  readonly defaultLocale?: string;
  readonly subject: (data: S["Type"], context: Context<M>) => string;
  readonly mjml: (data: S["Type"], context: Context<M>) => EmailHtml.Html;
  readonly text?: TextOption<S["Type"], M>;
  readonly validation?: "strict" | "soft";
  readonly fonts?: { readonly [name: string]: string };
}

/**
 * The `t` of a template built without `messages`.
 *
 * @since 0.1.0
 */
export type NoMessages = { readonly [key: string]: never };

const noMessages: NoMessages = {};

const failure = (message: string, issues: ReadonlyArray<string>) =>
  new EmailTemplateError({ message, issues });

const describe = (cause: unknown) => (P.isError(cause) ? cause.message : String(cause));

const rootTag = /<mjml\b([^>]*)>/i;
const headTag = /<mj-head\b[^>]*>/i;

/**
 * The MJML source with the accessible defaults it left out: `lang` and `dir`
 * on `<mjml>` from the negotiated locale, which MJML carries onto `<html>`,
 * and an `<mj-title>` equal to the subject.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import { Mjml } from "@thomasfosterau/effect-connect-mjml";
 *
 * const source = Mjml.accessibleDefaults(
 *   "<mjml><mj-body></mj-body></mjml>",
 *   { tag: "ar", dir: "rtl" },
 *   "مرحبا",
 * );
 * assert.strictEqual(
 *   source,
 *   '<mjml lang="ar" dir="rtl"><mj-head><mj-title>مرحبا</mj-title></mj-head><mj-body></mj-body></mjml>',
 * );
 * ```
 *
 * @since 0.1.0
 */
export const accessibleDefaults = (
  source: string,
  locale: EmailTemplate.Locale,
  subject: string,
): string => {
  const withLang = source.replace(rootTag, (_, attributes: string) => {
    const lang = /\slang\s*=/i.test(attributes) ? "" : ` lang="${EmailHtml.escape(locale.tag)}"`;
    const dir = /\sdir\s*=/i.test(attributes) ? "" : ` dir="${locale.dir}"`;
    return `<mjml${attributes}${lang}${dir}>`;
  });
  if (/<mj-title\b/i.test(withLang)) return withLang;
  const title = `<mj-title>${EmailHtml.escape(subject)}</mj-title>`;
  return headTag.test(withLang)
    ? withLang.replace(headTag, (head) => `${head}${title}`)
    : withLang.replace(rootTag, (open) => `${open}<mj-head>${title}</mj-head>`);
};

const compile = (
  source: string,
  options: Pick<TemplateOptions<Schema.Top, never>, "validation" | "fonts">,
) =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        // MJML's own default fonts apply when `fonts` is undefined.
        mjml2html(source, {
          validationLevel: "soft",
          fonts: options.fonts === undefined ? undefined : { ...options.fonts },
        }),
      catch: (cause) => failure("The MJML could not be compiled", [describe(cause)]),
    });
    const issues = Arr.map(result.errors, (error) => error.formattedMessage);
    if (Arr.isReadonlyArrayNonEmpty(issues)) {
      if (options.validation === "soft") {
        yield* Effect.logWarning("The MJML compiled with validation errors", issues);
      } else {
        return yield* failure("The MJML is not valid", issues);
      }
    }
    return result.html;
  });

/**
 * Build an `EmailTemplate` whose body is MJML. Render it with the core's
 * `EmailTemplate.render` / `toMessage`, like any other. Markup that does not
 * compile or validate, or a function that throws, fails `EmailTemplateError`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import * as Effect from "effect/Effect";
 * import * as Schema from "effect/Schema";
 * import { EmailHtml, EmailTemplate } from "@thomasfosterau/effect-connect";
 * import { Mjml } from "@thomasfosterau/effect-connect-mjml";
 *
 * const Welcome = Mjml.template({
 *   data: Schema.Struct({ name: Schema.String }),
 *   messages: { en: { hello: "Hello" }, fr: { hello: "Bonjour" } },
 *   subject: (_, { t }) => t.hello,
 *   mjml: ({ name }, { t }) => EmailHtml.html`
 *     <mjml>
 *       <mj-body>
 *         <mj-section><mj-column><mj-text>${t.hello}, ${name}</mj-text></mj-column></mj-section>
 *       </mj-body>
 *     </mjml>`,
 * });
 *
 * const content = await Effect.runPromise(
 *   EmailTemplate.render(Welcome, { name: "<Ada>" }, { locale: "fr-CA" }),
 * );
 * assert.strictEqual(content.text, "Bonjour, <Ada>");
 * assert.ok(content.html.includes('<html lang="fr" dir="ltr"'));
 * assert.ok(content.html.includes("<title>Bonjour</title>"));
 * ```
 *
 * @since 0.1.0
 */
export function template<S extends Schema.Top, M>(
  options: TemplateOptions<S, M> & { readonly messages: { readonly [locale: string]: M } },
): EmailTemplate.EmailTemplate<S, EmailTemplateError>;
export function template<S extends Schema.Top>(
  options: TemplateOptions<S, NoMessages> & { readonly messages?: never },
): EmailTemplate.EmailTemplate<S, EmailTemplateError>;
export function template<S extends Schema.Top, M>(
  options: TemplateOptions<S, M | NoMessages>,
): EmailTemplate.EmailTemplate<S, EmailTemplateError> {
  const messages = Option.fromNullishOr(options.messages);
  const locales = Option.match(messages, { onNone: () => [], onSome: R.keys });
  return EmailTemplate.fromRenderer({
    data: options.data,
    locales,
    defaultLocale: options.defaultLocale ?? Option.getOrElse(Arr.head(locales), () => "en"),
    render: (data, locale) =>
      Effect.gen(function* () {
        const t = Option.match(messages, {
          onNone: () => Option.some(noMessages),
          onSome: (byLocale) => R.get(byLocale, locale.tag),
        });
        const context: Context<M | NoMessages> = {
          locale,
          t: yield* Effect.fromOption(t).pipe(
            Effect.mapError(() => failure("The email template has no usable locale", [locale.tag])),
          ),
        };
        const { subject, source } = yield* Effect.try({
          try: () => ({
            subject: options.subject(data, context),
            source: options.mjml(data, context),
          }),
          catch: (cause) => failure("The email template could not be rendered", [describe(cause)]),
        });
        const html = yield* compile(accessibleDefaults(source.value, locale, subject), options);
        const text =
          options.text === undefined || options.text === "derive"
            ? EmailText.fromHtml(html)
            : options.text(data, context);
        return { subject, html, text };
      }),
  });
}
