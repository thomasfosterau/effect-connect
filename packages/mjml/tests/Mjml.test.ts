import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { EmailHtml, EmailTemplate, EmailText } from "@thomasfosterau/effect-connect";
import { accessibleDefaults, template } from "../src/index.ts";

const { html } = EmailHtml;

const Greeting = template({
  data: Schema.Struct({ name: Schema.NonEmptyString, url: Schema.String }),
  messages: {
    en: { subject: "Welcome", start: "Get started" },
    he: { subject: "ברוכים הבאים", start: "התחילו" },
  },
  subject: (_, { t }) => t.subject,
  mjml: ({ name, url }, { t }) =>
    html` <mjml>
      <mj-body>
        <mj-section>
          <mj-column>
            <mj-text>${t.subject}, ${name}</mj-text>
            <mj-button href="${EmailHtml.url(url)}">${t.start}</mj-button>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>`,
});

const body = (content: EmailHtml.Html) =>
  template({ data: Schema.Struct({}), subject: () => "Subject", mjml: () => content });

describe("template", () => {
  it.effect("fills in lang, dir and the title, and escapes the data", () =>
    Effect.gen(function* () {
      const content = yield* EmailTemplate.render(
        Greeting,
        { name: "<b>Dana</b>", url: "https://example.com/start" },
        { locale: "he-IL" },
      );
      expect(content.subject).toBe("ברוכים הבאים");
      expect(content.html).toMatch(/<html lang="he" dir="rtl"/);
      expect(content.html).toContain("<title>ברוכים הבאים</title>");
      expect(content.html).toContain("&lt;b&gt;Dana&lt;/b&gt;");
      expect(content.html).not.toContain("<b>Dana</b>");
      expect(content.text).toBe("ברוכים הבאים, <b>Dana</b>\n\nהתחילו (https://example.com/start)");
    }),
  );

  it.effect("replaces an unsafe button URL", () =>
    Effect.gen(function* () {
      const content = yield* EmailTemplate.render(Greeting, {
        name: "Ada",
        url: "javascript:alert(1)",
      });
      expect(content.html).not.toContain("javascript:");
      expect(content.html).toContain(EmailHtml.UNSAFE_URL);
    }),
  );

  it.effect("keeps the lang, dir and title the markup sets", () =>
    Effect.gen(function* () {
      const Own = body(
        html` <mjml lang="en-GB" dir="ltr">
          <mj-head><mj-title>Own title</mj-title></mj-head>
          <mj-body
            ><mj-section
              ><mj-column><mj-text>Hi</mj-text></mj-column></mj-section
            ></mj-body
          >
        </mjml>`,
      );
      const content = yield* EmailTemplate.render(Own, {}, { locale: "ar" });
      expect(content.html).toMatch(/<html lang="en-GB" dir="ltr"/);
      expect(content.html).toContain("<title>Own title</title>");
      expect(content.html).not.toContain("<title>Subject</title>");
    }),
  );

  it.effect("fails EmailTemplateError listing each validation error", () =>
    Effect.gen(function* () {
      const Invalid = body(
        html`<mjml
          ><mj-body><mj-text>Loose</mj-text><mj-bogus /></mj-body
        ></mjml>`,
      );
      const error = yield* Effect.flip(EmailTemplate.render(Invalid, {}));
      expect(error.message).toBe("The MJML is not valid");
      expect(error.issues).toHaveLength(2);
      expect(error.issues.join("\n")).toContain("mj-bogus");
    }),
  );

  it.effect("compiles invalid markup under soft validation", () =>
    Effect.gen(function* () {
      const Soft = template({
        data: Schema.Struct({}),
        subject: () => "S",
        mjml: () =>
          html`<mjml
            ><mj-body><mj-bogus /></mj-body
          ></mjml>`,
        validation: "soft",
      });
      const content = yield* EmailTemplate.render(Soft, {});
      expect(content.html).toContain("<title>S</title>");
    }),
  );

  it.effect("fails EmailTemplateError for markup that is not MJML", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(EmailTemplate.render(body(html`not mjml`), {}));
      expect(error.message).toBe("The MJML could not be compiled");
    }),
  );

  it.effect("takes the text written alongside", () =>
    Effect.gen(function* () {
      const Written = template({
        data: Schema.Struct({}),
        subject: () => "S",
        mjml: () => html`<mjml><mj-body></mj-body></mjml>`,
        text: () => EmailText.text`Written`,
      });
      expect((yield* EmailTemplate.render(Written, {})).text).toBe("Written");
    }),
  );
});

describe("accessibleDefaults", () => {
  it("adds the title to an existing head, escaping the subject", () => {
    expect(
      accessibleDefaults(
        "<mjml><mj-head><mj-preview>p</mj-preview></mj-head></mjml>",
        { tag: "en", dir: "ltr" },
        "a < b",
      ),
    ).toBe(
      '<mjml lang="en" dir="ltr"><mj-head><mj-title>a &lt; b</mj-title><mj-preview>p</mj-preview></mj-head></mjml>',
    );
  });
});

describe("fonts", () => {
  it.effect("links the web fonts it is given that the markup uses", () =>
    Effect.gen(function* () {
      const Fonts = template({
        data: Schema.Struct({}),
        subject: () => "S",
        fonts: { Inter: "https://fonts.example/inter.css" },
        mjml: () => EmailHtml.html`
          <mjml><mj-body><mj-section><mj-column>
            <mj-text font-family="Inter, sans-serif">Hi</mj-text>
          </mj-column></mj-section></mj-body></mjml>`,
      });
      expect((yield* EmailTemplate.render(Fonts, {})).html).toContain(
        "https://fonts.example/inter.css",
      );
    }),
  );
});
