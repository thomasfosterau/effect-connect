import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";
import { EmailHtml } from "../src/index.ts";

const { html } = EmailHtml;

/** Markup with the whitespace between tags and inside them collapsed. */
const compact = (markup: EmailHtml.Html): string =>
  markup.value.replace(/>\s+</g, "><").replace(/\s+/g, " ").replace(/\s+>/g, ">");

describe("EmailHtml.html", () => {
  it("escapes text and quoted-attribute contexts", () => {
    const hostile = `"><script>alert('x')</script>&`;
    expect(html`<p title="${hostile}">${hostile}</p>`.value).toBe(
      '<p title="&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;">&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;</p>',
    );
  });

  it("embeds nested Html once, without double escaping", () => {
    const inner = html`<b>${"a & b"}</b>`;
    expect(html`<p>${inner}</p>`.value).toBe("<p><b>a &amp; b</b></p>");
  });

  it("escapes a string that looks like markup", () => {
    expect(html`${"<b>bold</b>"}`.value).toBe("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("renders arrays, options and booleans", () => {
    const items = ["<1>", "2"].map((item) => html`<li>${item}</li>`);
    expect(
      compact(
        html`<ul>
          ${items}
        </ul>`,
      ),
    ).toBe("<ul><li>&lt;1&gt;</li><li>2</li></ul>");
    expect(html`${Option.some("<x>")}${Option.none()}${false}${true}`.value).toBe("&lt;x&gt;");
    expect(html`${0}`.value).toBe("0");
  });

  it("passes unsafeRaw through untouched", () => {
    expect(html`${EmailHtml.unsafeRaw("<hr>")}`.value).toBe("<hr>");
  });
});

describe("EmailHtml.url", () => {
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "\u0001javascript:alert(1)",
    "vbscript:msgbox",
    "data:text/html,<script>alert(1)</script>",
  ])("replaces %j", (value) => {
    expect(EmailHtml.url(value).value).toBe(EmailHtml.UNSAFE_URL);
  });

  it.each([
    "https://example.com/a?b=1",
    "mailto:a@example.com",
    "tel:+61400000000",
    "/relative",
    "#top",
  ])("keeps %j", (value) => {
    expect(EmailHtml.url(value).value).toBe(value);
  });

  it("allows base64 raster data images in src only", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(EmailHtml.imageUrl(png).value).toBe(png);
    expect(EmailHtml.url(png).value).toBe(EmailHtml.UNSAFE_URL);
    expect(EmailHtml.imageUrl("data:image/svg+xml;base64,PHN2Zz4=").value).toBe(
      EmailHtml.UNSAFE_URL,
    );
  });
});

describe("EmailHtml helpers", () => {
  it("builds layout tables as presentation", () => {
    expect(compact(EmailHtml.layout([["a", "b"]]))).toBe(
      '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td>a</td><td>b</td></tr></table>',
    );
  });

  it("builds buttons as links with a sanitised href", () => {
    const button = compact(EmailHtml.button({ href: "javascript:void(0)", label: "Go <now>" }));
    expect(button).toMatch(
      /^<a href="about:invalid#unsafe-url" style="[^"]*">Go &lt;now&gt;<\/a>$/,
    );
  });

  it("keeps an empty alt for decorative images", () => {
    expect(EmailHtml.image({ src: "https://example.com/x.png", alt: "" }).value).toContain(
      'alt=""',
    );
  });

  it("escapes heading content", () => {
    expect(EmailHtml.heading(2, "<x>").value).toBe("<h2>&lt;x&gt;</h2>");
  });
});

describe("EmailHtml.document", () => {
  const doc = compact(
    EmailHtml.document({
      lang: "fr",
      title: "Bienvenue & salut",
      preheader: "Aperçu",
      body: html`<p>Corps</p>`,
    }),
  );

  it("sets lang, dir and a title equal to the subject", () => {
    expect(doc).toMatch(/^<!doctype html><html lang="fr" dir="ltr">/);
    expect(doc).toContain("<title>Bienvenue &amp; salut</title>");
    expect(doc).toContain('<meta charset="utf-8" />');
  });

  it("labels the article wrapper and repeats lang and dir on it", () => {
    expect(doc).toMatch(
      /<div role="article" aria-roledescription="email" aria-label="Bienvenue &amp; salut" lang="fr" dir="ltr">/,
    );
  });

  it("hides the preheader from view and from assistive technology", () => {
    expect(doc).toMatch(/<div style="display:none;[^"]*" aria-hidden="true"> Aperçu <\/div>/);
  });
});
