/**
 * React Email as an `EmailTemplate` renderer: the body is a React Email
 * component, rendered with `@react-email/render`, and the result is the same
 * template the core renders, sends and localises.
 *
 * @module ReactEmail
 * @since 0.1.0
 */

import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import type * as Schema from "effect/Schema";
import { render, toPlainText } from "@react-email/render";
import type { ReactNode } from "react";
import {
  EmailHtml,
  EmailTemplate,
  EmailTemplateError,
  EmailText,
} from "@thomasfosterau/effect-connect";

/**
 * What the component, subject and text functions receive besides the data:
 * the negotiated `locale` (pass `locale.tag` and `locale.dir` to `<Html>`),
 * and `t`, the template's messages for that locale.
 *
 * @since 0.1.0
 */
export interface Context<M> {
  readonly locale: EmailTemplate.Locale;
  readonly t: M;
}

/**
 * How the plain-text body is produced: `"derive"` (the core's
 * `EmailText.fromHtml`), `"react-email"` (React Email's own converter), or
 * a function that writes it alongside the component.
 *
 * @since 0.1.0
 */
export type TextOption<A, M> =
  | "derive"
  | "react-email"
  | ((data: A, context: Context<M>) => string);

/**
 * Options for {@link template}.
 *
 * - `data` — the schema the template's data decodes against.
 * - `messages` — the template's strings per locale (BCP 47 keys), the
 *   locales it supports; `t` is the negotiated locale's entry.
 * - `defaultLocale` — the locale used when none requested matches; default
 *   the first `messages` key, else `"en"`.
 * - `subject` — the subject line, which also becomes the `<title>` when the
 *   component sets none.
 * - `component` — the email, as a React Email element (`<Html>` at its root).
 * - `text` — {@link TextOption}; default `"derive"`.
 *
 * @since 0.1.0
 */
export interface TemplateOptions<S extends Schema.Top, M> {
  readonly data: S;
  readonly messages?: { readonly [locale: string]: M };
  readonly defaultLocale?: string;
  readonly subject: (data: S["Type"], context: Context<M>) => string;
  readonly component: (data: S["Type"], context: Context<M>) => ReactNode;
  readonly text?: TextOption<S["Type"], M>;
}

/**
 * The `t` of a template built without `messages`.
 *
 * @since 0.1.0
 */
export type NoMessages = { readonly [key: string]: never };

const noMessages: NoMessages = {};

const failure = (message: string, cause: unknown) =>
  new EmailTemplateError({
    message,
    issues: [P.isError(cause) ? cause.message : String(cause)],
  });

const htmlTag = /<html\b([^>]*)>/i;

/**
 * The rendered document with the accessible defaults the component left
 * out: `lang` and `dir` on `<html>` from the negotiated locale, and a
 * `<title>` equal to the subject.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import { accessibleDefaults } from "@thomasfosterau/effect-connect-react-email";
 *
 * const html = accessibleDefaults(
 *   "<!DOCTYPE html><html><head></head><body>مرحبا</body></html>",
 *   { tag: "ar", dir: "rtl" },
 *   "مرحبا",
 * );
 * assert.ok(html.includes('<html lang="ar" dir="rtl">'));
 * assert.ok(html.includes("<title>مرحبا</title>"));
 * ```
 *
 * @since 0.1.0
 */
export const accessibleDefaults = (
  html: string,
  locale: EmailTemplate.Locale,
  subject: string,
): string => {
  const withLang = html.replace(htmlTag, (_, attributes: string) => {
    const lang = /\slang\s*=/i.test(attributes) ? "" : ` lang="${EmailHtml.escape(locale.tag)}"`;
    const dir = /\sdir\s*=/i.test(attributes) ? "" : ` dir="${locale.dir}"`;
    return `<html${attributes}${lang}${dir}>`;
  });
  if (/<title\b/i.test(withLang)) return withLang;
  const title = `<title>${EmailHtml.escape(subject)}</title>`;
  return /<head\b[^>]*>/i.test(withLang)
    ? withLang.replace(/<head\b[^>]*>/i, (head) => `${head}${title}`)
    : withLang.replace(htmlTag, (open) => `${open}<head>${title}</head>`);
};

/**
 * Build an `EmailTemplate` whose body is a React Email component. Render
 * it with the core's `EmailTemplate.render` / `toMessage`, like any other.
 * A component that throws fails `EmailTemplateError`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import * as Effect from "effect/Effect";
 * import * as Schema from "effect/Schema";
 * import { createElement } from "react";
 * import { EmailTemplate } from "@thomasfosterau/effect-connect";
 * import { template } from "@thomasfosterau/effect-connect-react-email";
 *
 * const Welcome = template({
 *   data: Schema.Struct({ name: Schema.String }),
 *   messages: { en: { hello: "Hello" }, fr: { hello: "Bonjour" } },
 *   subject: (_, { t }) => t.hello,
 *   component: ({ name }, { t, locale }) =>
 *     createElement(
 *       "html",
 *       { lang: locale.tag, dir: locale.dir },
 *       createElement("body", null, createElement("p", null, `${t.hello}, ${name}`)),
 *     ),
 * });
 *
 * const content = await Effect.runPromise(
 *   EmailTemplate.render(Welcome, { name: "Ada" }, { locale: "fr-CA" }),
 * );
 * assert.strictEqual(content.text, "Bonjour, Ada");
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
            Effect.mapError(() => failure("The email template has no usable locale", locale.tag)),
          ),
        };
        const subject = yield* Effect.try({
          try: () => options.subject(data, context),
          catch: (cause) => failure("The email template's subject could not be rendered", cause),
        });
        const rendered = yield* Effect.tryPromise({
          try: () => render(options.component(data, context)),
          catch: (cause) => failure("The React Email component could not be rendered", cause),
        });
        const html = accessibleDefaults(rendered, locale, subject);
        const text =
          options.text === undefined || options.text === "derive"
            ? EmailText.fromHtml(html)
            : options.text === "react-email"
              ? toPlainText(html)
              : options.text(data, context);
        return { subject, html, text };
      }),
  });
}
