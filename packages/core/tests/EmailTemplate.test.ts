import { describe, expect, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { EmailHtml, EmailTemplate, EmailTemplateError, EmailText } from "../src/index.ts";

const { html } = EmailHtml;

const Greeting = EmailTemplate.make({
  data: Schema.Struct({ name: Schema.NonEmptyString }),
  messages: {
    en: { subject: "Hello", hello: (name: string) => `Hello, ${name}` },
    "en-AU": { subject: "G'day", hello: (name: string) => `G'day, ${name}` },
    ar: { subject: "مرحبا", hello: (name: string) => `مرحبا ${name}` },
  },
  subject: (_, { t }) => t.subject,
  preheader: ({ name }) => `For ${name}`,
  html: ({ name }, { t }) => html`<p>${t.hello(name)}</p>`,
});

describe("EmailTemplate.lookup", () => {
  it("falls back from a region to its language, case-insensitively", () => {
    expect(EmailTemplate.lookup(["en", "fr"], ["FR-ca"])).toStrictEqual(Option.some("fr"));
  });

  it("prefers an exact match and keeps the supported spelling", () => {
    expect(EmailTemplate.lookup(["en", "en-au"], ["en-AU"])).toStrictEqual(Option.some("en-au"));
  });

  it("walks the preference list in order and skips malformed tags", () => {
    expect(EmailTemplate.lookup(["en", "de"], ["not a tag", "it", "de-AT", "en"])).toStrictEqual(
      Option.some("de"),
    );
  });

  it("drops a trailing singleton while truncating", () => {
    expect(EmailTemplate.lookup(["en"], ["en-x-private"])).toStrictEqual(Option.some("en"));
  });

  it("is none when nothing matches", () => {
    expect(EmailTemplate.lookup(["en"], ["fr"])).toStrictEqual(Option.none());
  });
});

describe("EmailTemplate.locale", () => {
  it.each([
    ["ar", "rtl"],
    ["he-IL", "rtl"],
    ["fa", "rtl"],
    ["ur", "rtl"],
    ["az-Arab", "rtl"],
    ["az", "ltr"],
    ["en", "ltr"],
    ["ja", "ltr"],
  ] as const)("%s is %s", (tag, dir) => {
    expect(Option.map(EmailTemplate.locale(tag), (resolved) => resolved.dir)).toStrictEqual(
      Option.some(dir),
    );
  });

  it("is none for a malformed tag", () => {
    expect(EmailTemplate.locale("en_AU!")).toStrictEqual(Option.none());
  });
});

describe("EmailTemplate.render", () => {
  it.effect("renders subject, title, lang and dir for the negotiated locale", () =>
    Effect.gen(function* () {
      const content = yield* EmailTemplate.render(Greeting, { name: "Ada" }, { locale: "ar-EG" });
      expect(content.subject).toBe("مرحبا");
      expect(content.html).toContain('<html lang="ar" dir="rtl">');
      expect(content.html).toContain("<title>مرحبا</title>");
      expect(content.html).toMatch(/aria-label="مرحبا"\s+lang="ar"\s+dir="rtl"/);
      expect(content.text).toBe("مرحبا Ada");
    }),
  );

  it.effect("prefers the more specific locale, and falls back to the default", () =>
    Effect.gen(function* () {
      const au = yield* EmailTemplate.render(
        Greeting,
        { name: "Ada" },
        { locale: ["en-AU", "en"] },
      );
      expect(au.subject).toBe("G'day");
      const fallback = yield* EmailTemplate.render(Greeting, { name: "Ada" }, { locale: "ja" });
      expect(fallback.subject).toBe("Hello");
      expect(fallback.html).toContain('<html lang="en" dir="ltr">');
      const none = yield* EmailTemplate.render(Greeting, { name: "Ada" });
      expect(none.subject).toBe("Hello");
    }),
  );

  it.effect("keeps the preheader out of the derived text", () =>
    Effect.gen(function* () {
      const content = yield* EmailTemplate.render(Greeting, { name: "Ada" });
      expect(content.html).toContain("For Ada");
      expect(content.text).toBe("Hello, Ada");
    }),
  );

  it.effect("escapes data in the subject's title and in the body", () =>
    Effect.gen(function* () {
      const Plain = EmailTemplate.make({
        data: Schema.Struct({ name: Schema.String }),
        subject: ({ name }) => `Hi ${name}`,
        html: ({ name }) => html`<p>${name}</p>`,
      });
      const content = yield* EmailTemplate.render(Plain, { name: "<script>" });
      expect(content.subject).toBe("Hi <script>");
      expect(content.html).toContain("<title>Hi &lt;script&gt;</title>");
      expect(content.html).not.toContain("<script>");
      expect(content.text).toBe("<script>");
    }),
  );

  it.effect("renders in the requested locale when the template has no messages", () =>
    Effect.gen(function* () {
      const Plain = EmailTemplate.make({
        data: Schema.Struct({ amount: Schema.Finite }),
        subject: () => "Receipt",
        html: ({ amount }, { locale }) =>
          html`<p>
            ${new Intl.NumberFormat(locale.tag, { style: "currency", currency: "EUR" }).format(amount)}
          </p>`,
      });
      const content = yield* EmailTemplate.render(Plain, { amount: 1234.5 }, { locale: "de-DE" });
      expect(content.html).toContain('<html lang="de-DE" dir="ltr">');
      expect(content.text).toBe("1.234,50 €");
    }),
  );

  it.effect("uses a hand-written text body instead of deriving one", () =>
    Effect.gen(function* () {
      const Written = EmailTemplate.make({
        data: Schema.Struct({ url: Schema.String }),
        subject: () => "Reset",
        html: ({ url }) => EmailHtml.button({ href: url, label: "Reset your password" }),
        text: ({ url }) => EmailText.text`
          Reset your password:
          ${url}
        `,
      });
      const content = yield* EmailTemplate.render(Written, { url: "https://example.com/r" });
      expect(content.text).toBe("Reset your password:\nhttps://example.com/r");
    }),
  );

  it.effect("decodes the data, so a transforming schema works", () =>
    Effect.gen(function* () {
      const Count = EmailTemplate.make({
        data: Schema.Struct({ count: Schema.FiniteFromString }),
        subject: ({ count }) => `${count + 1} items`,
        html: () => html``,
      });
      const content = yield* EmailTemplate.render(Count, { count: "2" });
      expect(content.subject).toBe("3 items");
    }),
  );

  it.effect("fails EmailTemplateError with one line per issue for invalid data", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(EmailTemplate.render(Greeting, { name: "" }));
      expect(error).toBeInstanceOf(EmailTemplateError);
      expect(error.issues.length).toBeGreaterThan(0);
    }),
  );

  it.effect("fails EmailTemplateError when the default locale is not among the messages", () =>
    Effect.gen(function* () {
      const Broken = EmailTemplate.make({
        data: Schema.Struct({}),
        messages: { fr: {} },
        defaultLocale: "en",
        subject: () => "",
        html: () => html``,
      });
      const error = yield* Effect.flip(EmailTemplate.render(Broken, {}, { locale: "de" }));
      expect(error._tag).toBe("EmailTemplateError");
    }),
  );

  it.effect("runs a body that needs a service", () => {
    class Brand extends Context.Service<Brand, { readonly name: string }>()("test/Brand") {}
    const Branded = EmailTemplate.make({
      data: Schema.Struct({}),
      subject: () => "News",
      html: () => Effect.map(Brand, (brand) => html`<p>${brand.name}</p>`),
    });
    return EmailTemplate.render(Branded, {}).pipe(
      Effect.map((content) => expect(content.text).toBe("Example Co")),
      Effect.provideService(Brand, { name: "Example Co" }),
    );
  });
});

const welcome = (subject: string) =>
  EmailTemplate.make({
    data: Schema.Struct({ name: Schema.String }),
    subject: () => subject,
    html: ({ name }) => html`<p>${subject}, ${name}</p>`,
  });

describe("EmailTemplate.localised", () => {
  const Welcome = EmailTemplate.localised(
    { en: welcome("Welcome"), "pt-BR": welcome("Bem-vindo") },
    { defaultLocale: "en" },
  );

  it.effect("renders the matching locale's template with that locale's lang", () =>
    Effect.gen(function* () {
      const content = yield* EmailTemplate.render(Welcome, { name: "Ana" }, { locale: "pt-BR" });
      expect(content.text).toBe("Bem-vindo, Ana");
      expect(content.html).toContain('<html lang="pt-BR" dir="ltr">');
      const fallback = yield* EmailTemplate.render(Welcome, { name: "Ana" }, { locale: "pt-PT" });
      expect(fallback.subject).toBe("Welcome");
    }),
  );
});

describe("EmailTemplate.toMessage", () => {
  it.effect("addresses the rendered content and leaves the locale out", () =>
    Effect.gen(function* () {
      const message = yield* EmailTemplate.toMessage(
        Greeting,
        { name: "Ada" },
        {
          from: { email: "noreply@example.com" },
          to: [{ email: "ada@example.com" }],
          tags: ["welcome"],
          locale: "en-AU",
        },
      );
      expect(message.subject).toBe("G'day");
      expect(message.tags).toStrictEqual(["welcome"]);
      expect(message.text).toBe("G'day, Ada");
      expect("locale" in message).toBe(false);
    }),
  );
});

describe("EmailTemplate.provider", () => {
  const envelope = {
    from: { email: "noreply@example.com" },
    to: [{ email: "ada@example.com" }],
  } as const;

  const Welcome = EmailTemplate.provider({
    data: Schema.Struct({ name: Schema.NonEmptyString }),
    id: { en: "welcome-en", "pt-BR": "welcome-pt" },
    subject: (_, { locale }) => `Welcome (${locale.tag})`,
    variables: ({ name }) => ({ NAME: name }),
  });

  it.effect("references the negotiated locale's provider template, with no body", () =>
    Effect.gen(function* () {
      const message = yield* EmailTemplate.toMessage(
        Welcome,
        { name: "Ana" },
        { ...envelope, locale: "pt-BR" },
      );
      expect(message.template).toStrictEqual({ id: "welcome-pt", variables: { NAME: "Ana" } });
      expect(message.subject).toBe("Welcome (pt-BR)");
      expect(message.html).toBeUndefined();
      expect(message.text).toBeUndefined();
      const fallback = yield* EmailTemplate.toMessage(
        Welcome,
        { name: "Ana" },
        { ...envelope, locale: "de" },
      );
      expect(fallback.template?.id).toBe("welcome-en");
    }),
  );

  it.effect("uses one id for every locale, and omits variables it was not given", () =>
    Effect.gen(function* () {
      const Plain = EmailTemplate.provider({
        data: Schema.Struct({}),
        id: "receipt",
        subject: () => "Receipt",
      });
      const message = yield* EmailTemplate.toMessage(Plain, {}, { ...envelope, locale: "ja" });
      expect(message.template).toStrictEqual({ id: "receipt" });
    }),
  );

  it.effect("fails EmailTemplateError for invalid data", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(EmailTemplate.toMessage(Welcome, { name: "" }, envelope));
      expect(error._tag).toBe("EmailTemplateError");
    }),
  );
});
