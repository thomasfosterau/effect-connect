/**
 * HTML for email bodies, escaped by construction: the `html` tagged template
 * escapes every interpolation that is not already {@link Html}, and the
 * helpers carry accessible defaults (presentation tables, link buttons,
 * required `alt` text, a document shell with `lang`, `dir` and `<title>`).
 *
 * @module EmailHtml
 * @since 0.4.0
 */

import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";

const TypeId = "~@thomasfosterau/effect-connect/EmailHtml/Html" as const;

/**
 * A fragment of HTML that is safe to embed as is: built by {@link html},
 * {@link unsafeRaw} or a helper of this module, never from a bare string.
 *
 * @since 0.4.0
 */
export interface Html {
  readonly [TypeId]: typeof TypeId;
  readonly value: string;
  toString(): string;
}

const HtmlProto = {
  [TypeId]: TypeId,
  toString(this: Html): string {
    return this.value;
  },
};

const makeHtml = (value: string): Html => {
  const self = Object.create(HtmlProto);
  self.value = value;
  return self;
};

/**
 * Whether a value is an {@link Html} fragment.
 *
 * @since 0.4.0
 */
export const isHtml = (value: Interpolation): value is Html => P.hasProperty(value, TypeId);

/**
 * What an `html` template accepts in a `${…}` slot. `Html` is embedded as is;
 * strings and numbers are escaped; booleans and
 * `Option.none()` render nothing (so `${cond && html`…`}` works); `Option.some`
 * and arrays render their contents.
 *
 * @since 0.4.0
 */
export type Interpolation =
  | InterpolationValue
  | Option.Option<InterpolationValue>
  | InterpolationArray;

/**
 * A single value an `html` slot accepts.
 *
 * @since 0.4.0
 */
export type InterpolationValue = Html | string | number | bigint | boolean;

/**
 * A (nested) array of interpolations, rendered in order.
 *
 * @since 0.4.0
 */
export interface InterpolationArray extends ReadonlyArray<Interpolation> {}

/**
 * Escape text for an HTML text node or a quoted attribute value.
 *
 * @since 0.4.0
 */
export const escape = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const isInterpolationArray = (value: Interpolation): value is InterpolationArray =>
  Arr.isArray(value);

const renderInterpolation = (value: Interpolation): string => {
  if (P.isBoolean(value)) return "";
  if (isHtml(value)) return value.value;
  if (Option.isOption(value))
    return Option.match(value, { onNone: () => "", onSome: renderInterpolation });
  if (isInterpolationArray(value)) return value.map(renderInterpolation).join("");
  return escape(String(value));
};

/**
 * Build {@link Html} from a template literal, escaping every interpolation
 * that is not already `Html`. Escaping covers text and *quoted* attribute
 * values; always quote attributes, and pass URLs through {@link url}.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import { EmailHtml } from "@thomasfosterau/effect-connect";
 *
 * const name = "<Ada & co>";
 * const greeting = EmailHtml.html`<p>Hello, ${name}!</p>`;
 * assert.strictEqual(greeting.value, "<p>Hello, &lt;Ada &amp; co&gt;!</p>");
 * ```
 *
 * @since 0.4.0
 */
export const html = (
  strings: TemplateStringsArray,
  ...values: ReadonlyArray<Interpolation>
): Html =>
  makeHtml(
    Arr.zipWith(
      strings,
      [...values.map(renderInterpolation), ""],
      (string, value) => string + value,
    ).join(""),
  );

/**
 * Embed a string as HTML without escaping it. The only way to do so, and
 * named to stand out in review: never pass it anything derived from input.
 *
 * @since 0.4.0
 */
export const unsafeRaw = (markup: string): Html => makeHtml(markup);

/**
 * Join fragments with an optional separator.
 *
 * @since 0.4.0
 */
export const join = (
  fragments: ReadonlyArray<Interpolation>,
  separator: Interpolation = "",
): Html => makeHtml(fragments.map(renderInterpolation).join(renderInterpolation(separator)));

/**
 * What an unsafe URL is replaced with: inert in every client, and easy to
 * spot in a rendered message.
 *
 * @since 0.4.0
 */
export const UNSAFE_URL = "about:invalid#unsafe-url";

const linkSchemes: ReadonlyArray<string> = ["http", "https", "mailto", "tel", "sms"];
const imageSchemes: ReadonlyArray<string> = ["http", "https", "cid"];
const dataImage = /^data:image\/(?:png|gif|jpeg|webp);base64,[a-z0-9+/=\s]*$/i;

const scheme = (value: string): Option.Option<string> =>
  Option.fromNullishOr(/^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase());

// Browsers strip ASCII control characters and whitespace before reading a
// scheme, so `java\tscript:` is still `javascript:`.
const normalise = (value: string): string => value.replace(/[\p{Cc}\s]/gu, "");

const checkUrl = (
  value: string,
  allowed: ReadonlyArray<string>,
  kind: "link" | "image",
): string => {
  const normalised = normalise(value);
  return Option.match(scheme(normalised), {
    onNone: () => value,
    onSome: (s) =>
      Arr.contains(allowed, s) || (kind === "image" && s === "data" && dataImage.test(normalised))
        ? value
        : UNSAFE_URL,
  });
};

/**
 * A URL for an `href`, escaped, with any scheme but `http`, `https`,
 * `mailto`, `tel` and `sms` (notably `javascript:`) replaced by
 * {@link UNSAFE_URL}. Relative URLs pass through.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import { EmailHtml } from "@thomasfosterau/effect-connect";
 *
 * assert.strictEqual(EmailHtml.url("https://example.com/?a=1&b=2").value, "https://example.com/?a=1&amp;b=2");
 * assert.strictEqual(EmailHtml.url("javascript:alert(1)").value, EmailHtml.UNSAFE_URL);
 * ```
 *
 * @since 0.4.0
 */
export const url = (value: string): Html => makeHtml(escape(checkUrl(value, linkSchemes, "link")));

/**
 * A URL for an image `src`: `http`, `https`, `cid` and base64 `data:image/…`
 * (PNG, GIF, JPEG, WebP), anything else replaced by {@link UNSAFE_URL}.
 *
 * @since 0.4.0
 */
export const imageUrl = (value: string): Html =>
  makeHtml(escape(checkUrl(value, imageSchemes, "image")));

/**
 * The text direction of a document or element.
 *
 * @since 0.4.0
 */
export type Direction = "ltr" | "rtl";

/**
 * Options for {@link document}.
 *
 * - `lang` — the BCP 47 tag of the content's language.
 * - `title` — the `<title>`, which should equal the subject.
 * - `preheader` — the preview text inbox lists show after the subject;
 *   hidden from view and from assistive technology in the body.
 * - `colorScheme` — the `color-scheme` the styles support; default `"light dark"`.
 * - `head` — extra `<head>` content, such as a `<style>` block.
 *
 * @since 0.4.0
 */
export interface DocumentOptions {
  readonly lang: string;
  readonly dir?: Direction;
  readonly title: string;
  readonly preheader?: string;
  readonly colorScheme?: "light" | "dark" | "light dark";
  readonly head?: Html;
  readonly body: Html;
}

/**
 * The inbox preview text: a hidden block at the start of the body, also
 * hidden from assistive technology, which reads the subject and body instead.
 *
 * @since 0.4.0
 */
export const preheader = (preview: string): Html =>
  html`<div
    style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;"
    aria-hidden="true"
  >
    ${preview}
  </div>`;

/**
 * Wrap a body in a complete, accessible email document: `<html lang dir>`,
 * `<title>`, the charset and viewport metas, `color-scheme`, a hidden
 * preheader, and a `role="article"` wrapper labelled with the title that
 * repeats `lang` and `dir` for clients that strip `<html>`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import { EmailHtml } from "@thomasfosterau/effect-connect";
 *
 * const doc = EmailHtml.document({
 *   lang: "ar",
 *   dir: "rtl",
 *   title: "مرحبا",
 *   body: EmailHtml.html`<p>مرحبا</p>`,
 * });
 * assert.ok(doc.value.includes('<html lang="ar" dir="rtl">'));
 * assert.ok(doc.value.includes("<title>مرحبا</title>"));
 * ```
 *
 * @since 0.4.0
 */
export const document = (options: DocumentOptions): Html => {
  const dir = options.dir ?? "ltr";
  const colorScheme = options.colorScheme ?? "light dark";
  return html`<!doctype html>
    <html lang="${options.lang}" dir="${dir}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta name="color-scheme" content="${colorScheme}" />
        <meta name="supported-color-schemes" content="${colorScheme}" />
        <title>${options.title}</title>
        ${Option.fromNullishOr(options.head)}
      </head>
      <body style="margin:0;padding:0;word-spacing:normal;">
        ${Option.map(Option.fromNullishOr(options.preheader), preheader)}
        <div
          role="article"
          aria-roledescription="email"
          aria-label="${options.title}"
          lang="${options.lang}"
          dir="${dir}"
        >
          ${options.body}
        </div>
      </body>
    </html> `;
};

/**
 * A layout table: `role="presentation"`, so screen readers read its cells as
 * flowing content rather than announcing rows and columns. Each item of
 * `rows` is one row of cells. Use real `<table>` markup (without this) only
 * for tabular data.
 *
 * @since 0.4.0
 */
export const layout = (
  rows: ReadonlyArray<ReadonlyArray<Interpolation>>,
  options: {
    readonly width?: string;
    readonly style?: string;
    readonly align?: "left" | "center" | "right";
  } = {},
): Html =>
  html`<table
    role="presentation"
    border="0"
    cellpadding="0"
    cellspacing="0"
    width="${options.width ?? "100%"}"
    ${
      options.align === undefined ? "" : html` align="${options.align}"`
    }${options.style === undefined ? "" : html` style="${options.style}"`}
  >
    ${rows.map(
      (row) =>
        html`<tr>
          ${row.map((cell) => html`<td>${cell}</td>`)}
        </tr>`,
    )}
  </table>`;

/**
 * A call-to-action "button": a styled link, because a `<button>` does nothing
 * in email and a link is announced as one. `label` should make sense out of
 * context ("Reset your password", not "Click here").
 *
 * @since 0.4.0
 */
export const button = (options: {
  readonly href: string;
  readonly label: string;
  readonly style?: string;
}): Html =>
  html`<a
    href="${url(options.href)}"
    style="${
      options.style ??
      "display:inline-block;padding:12px 24px;border-radius:4px;background:#1a56db;color:#ffffff;font-weight:600;text-decoration:none;"
    }"
    >${options.label}</a
  >`;

/**
 * A link. `label` should make sense out of context.
 *
 * @since 0.4.0
 */
export const link = (options: { readonly href: string; readonly label: Interpolation }): Html =>
  html`<a href="${url(options.href)}">${options.label}</a>`;

/**
 * An image. `alt` is required: describe what the image conveys, or pass `""`
 * for a decorative image, which screen readers then skip.
 *
 * @since 0.4.0
 */
export const image = (options: {
  readonly src: string;
  readonly alt: string;
  readonly width?: number;
  readonly height?: number;
}): Html =>
  html`<img
    src="${imageUrl(options.src)}"
    alt="${options.alt}"
    ${
      options.width === undefined ? "" : html` width="${options.width}"`
    }${options.height === undefined ? "" : html` height="${options.height}"`}
    style="border:0;display:block;max-width:100%;height:auto;"
  />`;

/**
 * A heading. Use one level-1 heading per message, and don't skip levels:
 * screen reader users navigate by them.
 *
 * @since 0.4.0
 */
export const heading = (level: 1 | 2 | 3 | 4 | 5 | 6, content: Interpolation): Html =>
  html`<h${level}>${content}</h${level}>`;
