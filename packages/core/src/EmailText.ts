/**
 * Plain-text email bodies: a `text` tagged template for writing one by hand,
 * and `fromHtml` for deriving one from rendered HTML, keeping what a reader
 * of the text part needs (structure, list markers, link targets, image alt
 * text) and dropping what they don't (styles, hidden preheaders, markup).
 *
 * @module EmailText
 * @since 0.4.0
 */

import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import { UNSAFE_URL, type Interpolation, type InterpolationArray } from "./EmailHtml.ts";

const isInterpolationArray = (value: Interpolation): value is InterpolationArray =>
  Arr.isArray(value);

const renderValue = (value: Interpolation): string => {
  if (P.isBoolean(value)) return "";
  if (Option.isOption(value)) return Option.match(value, { onNone: () => "", onSome: renderValue });
  if (isInterpolationArray(value)) return value.map(renderValue).join("");
  return String(value);
};

/** The smallest indentation of the lines the template's own text starts. */
const literalIndent = (strings: TemplateStringsArray): number => {
  let min = Number.POSITIVE_INFINITY;
  strings.forEach((string, i) => {
    const lines = string.split("\n");
    lines.slice(1).forEach((line, j) => {
      const isLast = j === lines.length - 2;
      const followedByValue = isLast && i < strings.length - 1;
      if (line.trim() === "" && !followedByValue) return;
      min = Math.min(min, line.length - line.replace(/^[ \t]*/, "").length);
    });
  });
  return Number.isFinite(min) ? min : 0;
};

/**
 * Write a plain-text body as an indented template literal: the common
 * indentation of the template's lines and its leading and trailing blank
 * lines are removed, so it can sit inside code. Nothing is escaped (plain
 * text has nothing to escape); booleans and
 * `Option.none()` render nothing.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import { EmailText } from "@thomasfosterau/effect-connect";
 *
 * const name = "Ada";
 * const body = EmailText.text`
 *   Hello, ${name}!
 *
 *   Welcome aboard.
 * `;
 * assert.strictEqual(body, "Hello, Ada!\n\nWelcome aboard.");
 * ```
 *
 * @since 0.4.0
 */
export const text = (
  strings: TemplateStringsArray,
  ...values: ReadonlyArray<Interpolation>
): string => {
  const indent = literalIndent(strings);
  const joined = Arr.zipWith(
    strings,
    [...values.map(renderValue), ""],
    (string, value) => string + value,
  )
    .join("")
    .replace(/\r\n?/g, "\n");
  const strip = new RegExp(`^[ \\t]{0,${indent}}`, "gm");
  return joined
    .replace(strip, "")
    .replace(/^(?:[ \t]*\n)+/, "")
    .replace(/(?:\n[ \t]*)+$/, "")
    .trimEnd();
};

// --- HTML to text ----------------------------------------------------------

const named: ReadonlyMap<string, string> = new Map(
  Object.entries({
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    copy: "©",
    reg: "®",
    trade: "™",
    mdash: "—",
    ndash: "–",
    hellip: "…",
    lsquo: "‘",
    rsquo: "’",
    ldquo: "“",
    rdquo: "”",
    laquo: "«",
    raquo: "»",
    bull: "•",
    middot: "·",
    euro: "€",
    pound: "£",
    yen: "¥",
    cent: "¢",
    deg: "°",
    times: "×",
    zwnj: "",
    zwj: "",
    shy: "",
  }),
);

const decodeEntities = (value: string): string =>
  value
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
      if (body[0] === "#") {
        const code =
          body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
      }
      return named.get(body.toLowerCase()) ?? match;
    })
    // Invisible characters preheader padding relies on.
    .replace(/\u00ad|\u034f|[\u200b-\u200d]|\u2060|\ufeff/g, "");

const tokens =
  /<!--[\s\S]*?-->|<![^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
const attributePattern = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const parseAttributes = (source: string): ReadonlyMap<string, string> => {
  const attributes = new Map<string, string>();
  for (const match of source.matchAll(attributePattern)) {
    attributes.set(
      (match[1] ?? "").toLowerCase(),
      decodeEntities(match[2] ?? match[3] ?? match[4] ?? ""),
    );
  }
  return attributes;
};

const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);
const droppedElements = new Set([
  "head",
  "title",
  "style",
  "script",
  "template",
  "noscript",
  "svg",
]);
const paragraphs = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "table",
  "pre",
  "dl",
]);
const blocks = new Set([
  "div",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "aside",
  "nav",
  "tr",
  "li",
  "dt",
  "dd",
  "center",
  "address",
  "figure",
  "figcaption",
  "hr",
]);

const isHidden = (attributes: ReadonlyMap<string, string>): boolean => {
  const style = (attributes.get("style") ?? "").replace(/\s+/g, "").toLowerCase();
  return (
    attributes.has("hidden") ||
    attributes.get("aria-hidden") === "true" ||
    style.includes("display:none") ||
    style.includes("mso-hide:all")
  );
};

const bareTarget = (href: string): string => href.replace(/^(?:mailto|tel|sms):/i, "");

interface ListState {
  readonly ordered: boolean;
  next: number;
}

interface LinkState {
  readonly href: string;
  readonly start: number;
}

/** The text written so far, and what the next chunk of text needs first. */
interface Writer {
  out: string;
  breaks: number;
  lineStart: boolean;
  marker: string;
  preDepth: number;
  cellsInRow: number;
  readonly lists: Array<ListState>;
  readonly links: Array<LinkState>;
}

/** The open elements, and the depth of the dropped one being skipped (or -1). */
interface Cursor {
  readonly stack: Array<string>;
  skipUntil: number;
}

const trimTrailing = (value: string): string => value.replace(/[ \t]+$/, "");

const block = (w: Writer, n: number) => {
  if (w.out !== "") w.breaks = Math.max(w.breaks, n);
};

const flushBreaks = (w: Writer) => {
  if (w.breaks === 0) return;
  w.out = trimTrailing(w.out) + "\n".repeat(w.breaks);
  w.breaks = 0;
  w.lineStart = true;
};

const linePrefix = (w: Writer): string => {
  const indent = "  ".repeat(Math.max(0, w.lists.length - 1));
  if (w.marker !== "") return indent + w.marker;
  return w.lists.length > 0 ? `${indent}  ` : indent;
};

/** The chunk to append at the start of a line, writing the line's prefix. */
const startLine = (w: Writer, chunk: string): string => {
  const value = w.preDepth > 0 ? chunk : chunk.replace(/^ +/, "");
  if (value === "") return "";
  w.out += linePrefix(w);
  w.marker = "";
  w.lineStart = false;
  return value;
};

const write = (w: Writer, chunk: string) => {
  if (chunk === "") return;
  flushBreaks(w);
  if (w.lineStart) {
    const value = startLine(w, chunk);
    w.out += value;
    return;
  }
  w.out += w.out.endsWith(" ") && chunk.startsWith(" ") ? chunk.slice(1) : chunk;
};

const lineBreak = (w: Writer) => {
  if (w.out === "") return;
  w.out = trimTrailing(w.out) + "\n".repeat(w.breaks + 1);
  w.breaks = 0;
  w.lineStart = true;
};

const writeText = (w: Writer, raw: string) => {
  const decoded = decodeEntities(raw);
  if (w.preDepth === 0) {
    write(w, decoded.replace(/[\s\u00a0]+/g, " "));
    return;
  }
  decoded.split("\n").forEach((line, i) => {
    if (i > 0) lineBreak(w);
    write(w, line);
  });
};

const openList = (ordered: boolean) => (w: Writer, attributes: ReadonlyMap<string, string>) => {
  block(w, w.lists.length === 0 ? 2 : 1);
  w.lists.push({ ordered, next: Number(attributes.get("start") ?? "1") || 1 });
};

const closeList = (w: Writer) => {
  w.lists.pop();
  block(w, w.lists.length === 0 ? 2 : 1);
};

const listMarker = (list: Option.Option<ListState>): string =>
  Option.match(
    Option.filter(list, (state) => state.ordered),
    {
      onNone: () => "- ",
      onSome: (state) => `${state.next++}. `,
    },
  );

const openCell = (w: Writer) => {
  if (w.cellsInRow > 0 && !w.lineStart) write(w, " ");
  w.cellsInRow++;
};

const closeLink = (w: Writer) => {
  const link = w.links.pop();
  if (link === undefined) return;
  const { href } = link;
  if (href === "" || href.startsWith("#") || href === UNSAFE_URL) return;
  const label = w.out.slice(link.start).trim();
  const target = bareTarget(href);
  if (label === href || label === target) return;
  write(w, label === "" ? target : ` (${target})`);
};

type OpenHandler = (w: Writer, attributes: ReadonlyMap<string, string>) => void;

const onOpen: ReadonlyMap<string, OpenHandler> = new Map<string, OpenHandler>([
  ["br", lineBreak],
  ["ul", openList(false)],
  ["ol", openList(true)],
  [
    "li",
    (w) => {
      w.marker = listMarker(Arr.last(w.lists));
    },
  ],
  [
    "pre",
    (w) => {
      w.preDepth++;
    },
  ],
  [
    "tr",
    (w) => {
      w.cellsInRow = 0;
    },
  ],
  ["td", openCell],
  ["th", openCell],
  [
    "a",
    (w, attributes) => {
      w.links.push({ href: attributes.get("href")?.trim() ?? "", start: w.out.length });
    },
  ],
  [
    "img",
    (w, attributes) => {
      const alt = attributes.get("alt")?.trim() ?? "";
      if (alt !== "") write(w, ` ${alt} `);
    },
  ],
]);

const onClose: ReadonlyMap<string, (w: Writer) => void> = new Map<string, (w: Writer) => void>([
  ["a", closeLink],
  ["ul", closeList],
  ["ol", closeList],
  [
    "pre",
    (w) => {
      w.preDepth = Math.max(0, w.preDepth - 1);
    },
  ],
]);

/** The blank lines (2) or line break (1) an element is set apart by. */
const spacing = (name: string): number => {
  if (paragraphs.has(name)) return 2;
  return blocks.has(name) ? 1 : 0;
};

const openTag = (w: Writer, cursor: Cursor, name: string, source: string) => {
  const isVoid = voidElements.has(name);
  if (cursor.skipUntil >= 0) {
    if (!isVoid) cursor.stack.push(name);
    return;
  }
  const attributes = parseAttributes(source);
  const dropped = droppedElements.has(name) || isHidden(attributes);
  if (dropped && !isVoid) cursor.skipUntil = cursor.stack.length;
  if (!isVoid) cursor.stack.push(name);
  if (dropped) return;
  block(w, spacing(name));
  onOpen.get(name)?.(w, attributes);
};

const closeTag = (w: Writer, cursor: Cursor, name: string) => {
  const at = cursor.stack.lastIndexOf(name);
  if (at < 0) return;
  const closing = cursor.stack.splice(at).toReversed();
  if (cursor.skipUntil >= 0) {
    if (at <= cursor.skipUntil) cursor.skipUntil = -1;
    return;
  }
  closing.forEach((element) => {
    onClose.get(element)?.(w);
    block(w, spacing(element));
  });
};

/**
 * Derive a plain-text body from rendered email HTML.
 *
 * Headings and paragraphs are separated by blank lines; list items get `- `
 * or `1. ` markers, indented by nesting; links read `label (url)`, or just
 * the URL when the label is the URL; images read as their `alt` text;
 * table cells are separated by spaces and rows by lines. `<head>`, styles,
 * scripts and hidden content (`hidden`, `aria-hidden="true"`,
 * `display:none`, such as the preheader) are dropped, and entities decoded.
 *
 * It is a small converter for well-formed email markup, not a general HTML
 * parser.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import { EmailText } from "@thomasfosterau/effect-connect";
 *
 * const text = EmailText.fromHtml(
 *   '<h1>Welcome</h1><p>Start <a href="https://example.com">here</a>.</p><ul><li>One</li><li>Two</li></ul>',
 * );
 * assert.strictEqual(text, "Welcome\n\nStart here (https://example.com).\n\n- One\n- Two");
 * ```
 *
 * @since 0.4.0
 */
export const fromHtml = (markup: string): string => {
  const w: Writer = {
    out: "",
    breaks: 0,
    lineStart: true,
    marker: "",
    preDepth: 0,
    cellsInRow: 0,
    lists: [],
    links: [],
  };
  const cursor: Cursor = { stack: [], skipUntil: -1 };
  let last = 0;
  for (const match of markup.matchAll(tokens)) {
    if (cursor.skipUntil < 0) writeText(w, markup.slice(last, match.index));
    last = match.index + match[0].length;
    const name = match[2]?.toLowerCase();
    if (name === undefined) continue;
    if (match[1] === "/") closeTag(w, cursor, name);
    else openTag(w, cursor, name, match[3] ?? "");
  }
  if (cursor.skipUntil < 0) writeText(w, markup.slice(last));
  return w.out
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
