import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";
import { EmailHtml, EmailText } from "../src/index.ts";

const { fromHtml, text } = EmailText;

describe("EmailText.text", () => {
  it("removes the common indentation and the surrounding blank lines", () => {
    const body = text`
      Hello, ${"Ada"}!

        Indented line.
      Last line.
    `;
    expect(body).toBe("Hello, Ada!\n\n  Indented line.\nLast line.");
  });

  it("escapes nothing and renders options and booleans", () => {
    expect(text`${"<b>&</b>"}${Option.none()}${false}${Option.some(1)}`).toBe("<b>&</b>1");
  });

  it("normalises CRLF line endings", () => {
    expect(text`a\r\nb`).toBe("a\nb");
  });
});

describe("EmailText.fromHtml", () => {
  it("separates headings and paragraphs with blank lines and keeps line breaks", () => {
    expect(fromHtml("<h1>Title</h1><p>One<br>two</p><p>Three</p>")).toBe(
      "Title\n\nOne\ntwo\n\nThree",
    );
  });

  it("collapses source whitespace, as a browser would", () => {
    expect(fromHtml("<p>\n    Hello,\n    world\n  </p>")).toBe("Hello, world");
  });

  it("marks list items, numbering ordered lists from start, and indents nesting", () => {
    expect(
      fromHtml(
        '<ul><li>A<ul><li>A1</li></ul></li><li>B</li></ul><ol start="3"><li>C</li><li>D</li></ol>',
      ),
    ).toBe("- A\n  - A1\n- B\n\n3. C\n4. D");
  });

  it("writes links as label (url), or the url alone when it is the label", () => {
    expect(fromHtml('<a href="https://example.com/x">Open</a>')).toBe(
      "Open (https://example.com/x)",
    );
    expect(fromHtml('<a href="https://example.com">https://example.com</a>')).toBe(
      "https://example.com",
    );
    expect(fromHtml('<a href="mailto:a@example.com">a@example.com</a>')).toBe("a@example.com");
    expect(fromHtml('<a href="mailto:a@example.com">Email us</a>')).toBe(
      "Email us (a@example.com)",
    );
    expect(fromHtml('<a href="#top">Top</a>')).toBe("Top");
  });

  it("writes an image-only link as its url and drops neutralised urls", () => {
    expect(fromHtml('<a href="https://example.com"><img src="x.png" alt=""></a>')).toBe(
      "https://example.com",
    );
    expect(fromHtml(EmailHtml.link({ href: "javascript:x", label: "Bad" }).value)).toBe("Bad");
  });

  it("reads images as their alt text", () => {
    expect(fromHtml('<p>Logo: <img src="logo.png" alt="Example Co"> done</p>')).toBe(
      "Logo: Example Co done",
    );
  });

  it("flattens tables row by row", () => {
    expect(
      fromHtml("<table><tr><td>Item</td><td>$5</td></tr><tr><td>Tax</td><td>$1</td></tr></table>"),
    ).toBe("Item $5\nTax $1");
  });

  it("drops the head, styles, scripts, comments and hidden content", () => {
    const markup = `<html><head><title>T</title><style>p{color:red}</style></head><body>
      <!-- note -->
      <div style="display: none">Preview</div>
      <span aria-hidden="true">x</span><p hidden>gone</p>
      <script>alert(1)</script>
      <div style="display:none"><div>nested <b>hidden</b></div></div>
      <p>Visible</p></body></html>`;
    expect(fromHtml(markup)).toBe("Visible");
  });

  it("drops the preheader of a whole document", () => {
    const doc = EmailHtml.document({
      lang: "en",
      title: "Subject",
      preheader: "Preview text",
      body: EmailHtml.html`<p>Body</p>`,
    });
    expect(fromHtml(doc.value)).toBe("Body");
  });

  it("decodes named and numeric entities and removes invisible padding", () => {
    expect(
      fromHtml("<p>a &amp; b &lt;c&gt; &#8212; &#x2019; &hellip;&zwnj;&#8203;&nbsp;z &bogus;</p>"),
    ).toBe("a & b <c> — ’ … z &bogus;");
  });

  it("keeps preformatted whitespace", () => {
    expect(fromHtml("<pre>a\n  b</pre>")).toBe("a\n  b");
  });

  it("survives unclosed and stray closing tags", () => {
    expect(fromHtml("<p>One</div><p>Two")).toBe("One\n\nTwo");
  });
});
