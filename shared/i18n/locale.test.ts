import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  LOCALES,
  isLocale,
  localeHref,
  negotiateLocale,
  splitLocale,
} from "./locale";

describe("splitLocale", () => {
  it("reads an English path and hands back the canonical one", () => {
    expect(splitLocale("/en/inmuebles")).toEqual({ locale: "en", path: "/inmuebles" });
  });

  it("treats an unprefixed path as Spanish", () => {
    expect(splitLocale("/inmuebles")).toEqual({ locale: "es", path: "/inmuebles" });
  });

  it("reads the bare locale as the root", () => {
    expect(splitLocale("/en")).toEqual({ locale: "en", path: "/" });
    expect(splitLocale("/en/")).toEqual({ locale: "en", path: "/" });
  });

  /*
   * The one that matters. `startsWith("/en")` — the obvious implementation — turns this Spanish URL
   * into English and strips it to `/trevista`, which is a 404 on a path that used to work. Every
   * Spanish route beginning with those letters is in this case.
   */
  it("only matches a whole segment, never a prefix of one", () => {
    expect(splitLocale("/entrevista")).toEqual({ locale: "es", path: "/entrevista" });
    expect(splitLocale("/encargos")).toEqual({ locale: "es", path: "/encargos" });
    expect(splitLocale("/escritura")).toEqual({ locale: "es", path: "/escritura" });
  });

  it("keeps the rest of a deep path", () => {
    expect(splitLocale("/en/contratos/abc123")).toEqual({
      locale: "en",
      path: "/contratos/abc123",
    });
  });
});

describe("localeHref", () => {
  it("leaves a Spanish path exactly as it was", () => {
    expect(localeHref("es", "/inmuebles")).toBe("/inmuebles");
    expect(localeHref("es", "/")).toBe("/");
  });

  it("prefixes English", () => {
    expect(localeHref("en", "/inmuebles")).toBe("/en/inmuebles");
    expect(localeHref("en", "/")).toBe("/en");
  });

  it("keeps the query and the fragment, which is where the stage anchors live", () => {
    expect(localeHref("en", "/inmuebles?city=Manizales")).toBe("/en/inmuebles?city=Manizales");
    expect(localeHref("en", "/contratos/x#etapa-guarantee")).toBe(
      "/en/contratos/x#etapa-guarantee",
    );
  });

  /*
   * `LocaleLink` sits in front of every `<Link>` in the product, so it is handed hrefs that are not
   * internal paths at all. Rewriting one of those is how a `mailto:` becomes a dead internal route.
   */
  it("does not touch anything that is not an internal absolute path", () => {
    for (const href of [
      "mailto:hola@miarriendodirecto.com",
      "tel:+573001234567",
      "https://ecomm.sura.co/seguros/hogar/arriendo/cotizador",
      "//evil.example.com",
      "#etapa-visit",
    ]) {
      expect(localeHref("en", href)).toBe(href);
    }
  });

  /* Idempotent: a locale-aware link inside an already-localised tree must not double the prefix. */
  it("is idempotent", () => {
    expect(localeHref("en", "/en/inmuebles")).toBe("/en/inmuebles");
    expect(localeHref("es", "/en/inmuebles")).toBe("/inmuebles");
  });
});

describe("negotiateLocale", () => {
  it("falls back to Spanish with no header, an empty one, or a language we do not speak", () => {
    expect(negotiateLocale(null)).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale("")).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale("pt-BR,fr;q=0.8")).toBe(DEFAULT_LOCALE);
  });

  it("ignores the region", () => {
    expect(negotiateLocale("en-GB")).toBe("en");
    expect(negotiateLocale("es-419")).toBe("es");
  });

  it("obeys the q weights rather than the order", () => {
    expect(negotiateLocale("en;q=0.3,es;q=0.9")).toBe("es");
    expect(negotiateLocale("es;q=0.4,en;q=0.8")).toBe("en");
  });

  it("reads a plain browser header", () => {
    expect(negotiateLocale("en-US,en;q=0.9,es;q=0.8")).toBe("en");
  });

  /* `q=0` is the header's way of saying "not this one", not a weak preference for it. */
  it("treats q=0 as a refusal", () => {
    expect(negotiateLocale("en;q=0")).toBe(DEFAULT_LOCALE);
  });
});

describe("isLocale", () => {
  it("accepts what we speak and nothing else", () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true);
    for (const value of ["EN", "pt", "", "en-US", null, undefined, 7, {}]) {
      expect(isLocale(value)).toBe(false);
    }
  });
});
