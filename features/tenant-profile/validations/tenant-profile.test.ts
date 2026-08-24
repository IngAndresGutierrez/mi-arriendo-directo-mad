import { describe, expect, it } from "vitest";

import { tenantDossierSchema, type TenantDossierInput } from "./tenant-profile";

const valid: TenantDossierInput = {
  documentType: "cc",
  documentNumber: "1053812345",
  occupation: "employee",
  employer: "Crehana",
  monthlyIncome: 6_000_000,
  householdSize: 2,
  hasPets: false,
  petsDescription: "",
  reference: {
    name: "Carolina Restrepo",
    phoneCountry: "CO",
    phone: "3001234567",
    relationship: "Jefe directo",
  },
  referenceAuthorized: true,
};

const parse = (overrides: Partial<TenantDossierInput> = {}) =>
  tenantDossierSchema.safeParse({ ...valid, ...overrides });

/** The first message for a field, or `undefined`. */
function errorFor(result: ReturnType<typeof parse>, path: string): string | undefined {
  if (result.success) return undefined;

  return result.error.issues.find((issue) => issue.path.join(".") === path)?.message;
}

describe("tenantDossierSchema", () => {
  it("accepts a complete dossier", () => {
    expect(parse().success).toBe(true);
  });

  /**
   * **The reference is a third party who never authorised anything.**
   *
   * This is the one field in the product where somebody hands us another person's name and phone
   * number. Ley 1581 requires the authorisation of the titular, and the titular here is the
   * reference — not the tenant filling the form. Decreto 1074 art. 2.2.2.25.2.7 anticipates data
   * collected from someone other than the titular; what we can do is put the declaration on the
   * record and tell the tenant the obligation exists.
   */
  describe("the reference's own authorisation", () => {
    it("refuses a dossier that does not declare it", () => {
      const result = parse({ referenceAuthorized: false });

      expect(result.success).toBe(false);
      expect(errorFor(result, "referenceAuthorized")).toBe(
        "Confirma que tu referencia sabe que vas a dar sus datos",
      );
    });

    /* Absent is not "no answer", it is the same as saying no: we would be holding the data anyway. */
    it("refuses a dossier that omits it entirely", () => {
      expect(tenantDossierSchema.safeParse({ ...valid, referenceAuthorized: undefined }).success).toBe(
        false,
      );
    });
  });

  describe("identity document", () => {
    it("takes digits and a passport's letters, without punctuation", () => {
      expect(parse({ documentNumber: "1053812345" }).success).toBe(true);
      expect(parse({ documentType: "passport", documentNumber: "AY123456" }).success).toBe(true);
      expect(errorFor(parse({ documentNumber: "1.053.812.345" }), "documentNumber")).toMatch(/sin puntos/);
    });

    /*
     * No length or checksum rule beyond the obvious. A `CC` issued in the fifties is six or
     * seven digits and a child's is ten: a tighter rule rejects real people.
     */
    it("accepts the short numbers of an older cédula", () => {
      expect(parse({ documentNumber: "24567" }).success).toBe(true);
      expect(errorFor(parse({ documentNumber: "123" }), "documentNumber")).toBeDefined();
    });

    it("rejects a document type it does not know", () => {
      expect(parse({ documentType: "nit" as never }).success).toBe(false);
    });
  });

  describe("income and household", () => {
    it("wants a positive whole number of pesos", () => {
      expect(errorFor(parse({ monthlyIncome: 0 }), "monthlyIncome")).toBeDefined();
      expect(errorFor(parse({ monthlyIncome: -1 }), "monthlyIncome")).toBeDefined();
      expect(errorFor(parse({ monthlyIncome: 1_500_000.5 }), "monthlyIncome")).toMatch(/centavos/);
      expect(errorFor(parse({ monthlyIncome: 999_999_999_999 }), "monthlyIncome")).toMatch(/Revisa/);
    });

    it("counts at least the tenant", () => {
      expect(errorFor(parse({ householdSize: 0 }), "householdSize")).toMatch(/tú/);
      expect(parse({ householdSize: 1 }).success).toBe(true);
      expect(errorFor(parse({ householdSize: 40 }), "householdSize")).toBeDefined();
    });
  });

  describe("pets", () => {
    // Pets are the commonest reason an application is refused: "yes" with no detail is useless.
    it("asks what the pet is when there is one", () => {
      expect(errorFor(parse({ hasPets: true, petsDescription: "" }), "petsDescription")).toMatch(/qué mascota/);
      expect(errorFor(parse({ hasPets: true, petsDescription: "   " }), "petsDescription")).toBeDefined();
      expect(parse({ hasPets: true, petsDescription: "Un gato esterilizado" }).success).toBe(true);
    });

    it("does not ask when there are none", () => {
      expect(parse({ hasPets: false, petsDescription: "" }).success).toBe(true);
    });
  });

  describe("reference", () => {
    it("wants a full name and a relationship", () => {
      expect(errorFor(parse({ reference: { ...valid.reference, name: "Carolina" } }), "reference.name")).toMatch(/apellido/);
      expect(errorFor(parse({ reference: { ...valid.reference, relationship: "a" } }), "reference.relationship")).toBeDefined();
    });

    it("validates the phone against its own country, not Colombia's", () => {
      expect(errorFor(parse({ reference: { ...valid.reference, phone: "6001234567" } }), "reference.phone")).toMatch(/empieza por 3/);
      expect(parse({ reference: { ...valid.reference, phoneCountry: "ES", phone: "612345678" } }).success).toBe(true);
      // The same number is invalid as a Colombian one.
      expect(parse({ reference: { ...valid.reference, phone: "612345678" } }).success).toBe(false);
    });

    it("accepts a number typed with spaces and parentheses", () => {
      expect(parse({ reference: { ...valid.reference, phone: "(300) 123 4567" } }).success).toBe(true);
    });
  });
});
