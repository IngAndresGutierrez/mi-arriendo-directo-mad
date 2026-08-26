import { describe, expect, it } from "vitest";

import { LOCALES } from "@/shared/i18n/locale";

import { dossierLabels } from "./labels";

function leaves(value: unknown, path = ""): readonly (readonly [string, unknown])[] {
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      leaves(child, path ? `${path}.${key}` : key),
    );
  }

  return [[path, value]];
}

describe("dossierLabels", () => {
  /**
   * The same guard `propertyLabels` carries, and for the same reason: this object is handed whole to
   * `DossierFields` and `DocumentChecklist`, both Client Components, so a function anywhere in it
   * would throw *"Functions cannot be passed directly to Client Components"* and 500 the page.
   */
  it("returns no functions anywhere: all of it crosses to a Client Component", () => {
    for (const locale of LOCALES) {
      for (const [path, value] of leaves(dossierLabels(locale))) {
        expect(typeof value, `${locale}.${path} is a ${typeof value}`).toBe("string");
      }
    }
  });

  it("has a non-empty word for every document kind and occupation, in both languages", () => {
    for (const locale of LOCALES) {
      for (const [path, value] of leaves(dossierLabels(locale))) {
        expect(value, `${locale}.${path}`).toBeTruthy();
      }
    }
  });

  it("actually differs between the languages", () => {
    expect(dossierLabels("es").occupations.student).toBe("Estudiante");
    expect(dossierLabels("en").occupations.student).toBe("Student");
    expect(dossierLabels("es").documentLabels.payslip).not.toBe(
      dossierLabels("en").documentLabels.payslip,
    );
  });
});
