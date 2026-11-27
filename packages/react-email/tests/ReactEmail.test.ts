import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { createElement } from "react";
import * as EmailTemplate from "@thomasfosterau/effect-connect/EmailTemplate";
import * as EmailText from "@thomasfosterau/effect-connect/EmailText";
import { accessibleDefaults, template } from "../src/ReactEmail.ts";

const email = (...children: Parameters<typeof createElement>[2][]) =>
  createElement("html", null, createElement("body", null, ...children));

const Greeting = template({
  data: Schema.Struct({ name: Schema.NonEmptyString, url: Schema.String }),
  messages: {
    en: { subject: "Welcome", start: "Get started" },
    he: { subject: "ברוכים הבאים", start: "התחילו" },
  },
  subject: (_, { t }) => t.subject,
  component: ({ name, url }, { t }) =>
    email(
      createElement("h1", null, `${t.subject}, ${name}`),
      createElement("a", { href: url }, t.start),
    ),
});

describe("template", () => {
  it.effect("fills in lang, dir and the title from the negotiated locale", () =>
    Effect.gen(function* () {
      const content = yield* EmailTemplate.render(
        Greeting,
        { name: "<Dana>", url: "https://example.com/start" },
        { locale: "he-IL" },
      );
      expect(content.subject).toBe("ברוכים הבאים");
      expect(content.html).toMatch(/<html[^>]* lang="he" dir="rtl">/);
      expect(content.html).toContain("<title>ברוכים הבאים</title>");
      expect(content.html).toContain("&lt;Dana&gt;");
      expect(content.text).toBe("ברוכים הבאים, <Dana>\n\nהתחילו (https://example.com/start)");
    }),
  );

  it.effect("keeps the lang, dir and title the component sets", () =>
    Effect.gen(function* () {
      const Own = template({
        data: Schema.Struct({}),
        subject: () => "Subject",
        component: () =>
          createElement(
            "html",
            { lang: "en-GB", dir: "ltr" },
            createElement("head", null, createElement("title", null, "Own title")),
            createElement("body", null, "Hi"),
          ),
      });
      const content = yield* EmailTemplate.render(Own, {}, { locale: "ar" });
      expect(content.html).toMatch(/<html lang="en-GB" dir="ltr">/);
      expect(content.html).toContain("<title>Own title</title>");
      expect(content.html).not.toContain("<title>Subject</title>");
    }),
  );

  it.effect("renders the text with React Email's converter or by hand", () =>
    Effect.gen(function* () {
      const base = {
        data: Schema.Struct({}),
        subject: () => "S",
        component: () => email(createElement("p", null, "Body")),
      } as const;
      const viaReactEmail = yield* EmailTemplate.render(
        template({ ...base, text: "react-email" }),
        {},
      );
      expect(viaReactEmail.text).toContain("Body");
      const written = yield* EmailTemplate.render(
        template({ ...base, text: () => EmailText.text`Written` }),
        {},
      );
      expect(written.text).toBe("Written");
    }),
  );

  it.effect("fails EmailTemplateError when the component throws", () =>
    Effect.gen(function* () {
      const Broken = template({
        data: Schema.Struct({}),
        subject: () => "S",
        component: () => createElement("p", null, decodeURIComponent("%")),
      });
      const error = yield* Effect.flip(EmailTemplate.render(Broken, {}));
      expect(error._tag).toBe("EmailTemplateError");
      expect(error.message).toBe("The React Email component could not be rendered");
      expect(error.issues).toHaveLength(1);
    }),
  );

  it.effect("becomes a message through the core's toMessage", () =>
    Effect.gen(function* () {
      const message = yield* EmailTemplate.toMessage(
        Greeting,
        { name: "Ada", url: "https://example.com" },
        { from: { email: "noreply@example.com" }, to: [{ email: "ada@example.com" }] },
      );
      expect(message.subject).toBe("Welcome");
      expect(message.html).toContain('lang="en"');
    }),
  );
});

describe("accessibleDefaults", () => {
  it("adds a head with the title when the document has none, escaping the subject", () => {
    expect(
      accessibleDefaults("<html><body></body></html>", { tag: "en", dir: "ltr" }, "a < b"),
    ).toBe('<html lang="en" dir="ltr"><head><title>a &lt; b</title></head><body></body></html>');
  });
});
