import { describe, expect, it } from "vitest";

import { localeAlternates, localeSitemapRows } from "./seo";

describe("localeAlternates", () => {
  it("points the canonical at the language being rendered, not at Spanish", () => {
    expect(localeAlternates("en", "/inmuebles").canonical).toBe("/en/inmuebles");
    expect(localeAlternates("es", "/inmuebles").canonical).toBe("/inmuebles");
  });

  /*
   * The failure this guards against is silent and total: a cluster where a page lists only the other
   * language is discarded, and the English catalogue simply never gets indexed. Every version has to
   * name every version, itself included.
   */
  it("names every language from every language, including itself", () => {
    for (const locale of ["es", "en"] as const) {
      const { languages } = localeAlternates(locale, "/inmuebles/casa-en-palermo-manizales");

      expect(languages.es).toBe("/inmuebles/casa-en-palermo-manizales");
      expect(languages.en).toBe("/en/inmuebles/casa-en-palermo-manizales");
    }
  });

  it("falls back to Spanish for a language we do not speak", () => {
    expect(localeAlternates("en", "/inmuebles").languages["x-default"]).toBe("/inmuebles");
  });

  it("keeps the query, so a city facet stays canonical to itself", () => {
    const { canonical, languages } = localeAlternates("en", "/inmuebles?city=Manizales");

    expect(canonical).toBe("/en/inmuebles?city=Manizales");
    expect(languages.es).toBe("/inmuebles?city=Manizales");
  });
});

describe("localeSitemapRows", () => {
  it("submits one row per language, each carrying the whole cluster", () => {
    const rows = localeSitemapRows("/inmuebles", { priority: 1, changeFrequency: "daily" as const });

    expect(rows.map((row) => row.url)).toEqual(["/inmuebles", "/en/inmuebles"]);
    for (const row of rows) {
      expect(row.priority).toBe(1);
      expect(row.alternates.languages).toEqual({
        es: "/inmuebles",
        en: "/en/inmuebles",
        "x-default": "/inmuebles",
      });
    }
  });
});
