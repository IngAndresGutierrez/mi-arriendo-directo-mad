import { describe, expect, it } from "vitest";

import { LOCALES } from "@/shared/i18n/locale";

import { propertyLabels } from "./labels";

/** Every leaf of a nested object, with the path that reached it. */
function leaves(value: unknown, path = ""): readonly (readonly [string, unknown])[] {
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      leaves(child, path ? `${path}.${key}` : key),
    );
  }

  return [[path, value]];
}

describe("propertyLabels", () => {
  /**
   * **The assertion this file exists for.**
   *
   * `PropertyLabels` is handed to `CatalogFilters` and `CatalogToolbar`, which are Client
   * Components — so every value in it has to survive the RSC boundary. A function does not: React
   * answers *"Functions cannot be passed directly to Client Components"* and the page 500s.
   *
   * That has now happened twice in this codebase. Once with the language switcher, which was given
   * the `language` dictionary slice holding `switchTo(name)`; and once here, one commit after the
   * rule had been written down, when these components were handed `Dictionary["property"]` — which
   * carries `found`, `bedroomsFact`, `seoTitle` and half a dozen more. **`pnpm build` compiled both
   * happily.** It is only visible when a page actually renders, which is why the guard has to be a
   * test rather than a convention: this is the shape of the mistake, and it is an easy one to make
   * again the next time somebody adds a parameterised label.
   *
   * Weakening it is easy to spot: add any function to what `propertyLabels` returns and this goes
   * red immediately.
   */
  it("returns no functions anywhere: all of it crosses to a Client Component", () => {
    for (const locale of LOCALES) {
      for (const [path, value] of leaves(propertyLabels(locale))) {
        expect(typeof value, `${locale}.${path} is a ${typeof value}`).toBe("string");
      }
    }
  });

  it("has a non-empty word for every value of every union, in both languages", () => {
    for (const locale of LOCALES) {
      for (const [path, value] of leaves(propertyLabels(locale))) {
        expect(value, `${locale}.${path}`).toBeTruthy();
      }
    }
  });

  /* The point of the whole exercise: the two languages say different things. */
  it("actually differs between the languages", () => {
    const es = propertyLabels("es");
    const en = propertyLabels("en");

    expect(es.types.house).toBe("Casa");
    expect(en.types.house).toBe("House");
    expect(es.ui.filterType).not.toBe(en.ui.filterType);
    expect(es.bedrooms[4]).toBe("4 o más");
    expect(en.bedrooms[4]).toBe("4 or more");
  });
});
