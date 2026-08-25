import { describe, expect, it } from "vitest";

import { createErrandFormSchema, errandSchema, collaboratorSchema } from "./errand";

/** Exactly what the form sends when somebody fills it in properly. */
const filled = {
  propertyId: "property-1",
  type: "showing" as const,
  title: "Mostrarle el apartamento a un interesado",
  description: "El portero tiene copia de la llave. Llega a las 3.",
  day: "2026-09-10",
  time: "15:00",
  name: "Carlos Ruiz",
  phoneCountry: "CO",
  phoneNational: "3001234567",
};

describe("createErrandFormSchema", () => {
  /*
   * The one that matters: a complete, realistic submission has to pass. It did not — the form's
   * button appeared to do nothing, which is what `handleSubmit` does when validation fails, and the
   * reason was invisible on screen. A schema with no test is a schema whose failures are discovered
   * by clicking.
   */
  it("accepts a fully filled form", () => {
    const result = createErrandFormSchema.safeParse(filled);

    expect(
      result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    ).toEqual([]);
    expect(result.success).toBe(true);
  });

  it("reports the field when something is missing, so the form can show it", () => {
    const result = createErrandFormSchema.safeParse({ ...filled, title: "", phoneNational: "" });

    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toContain("title");
    expect(paths).toContain("phoneNational");
  });

  it("rejects a Colombian mobile that is not one", () => {
    // The per-country rule: ten digits starting with 3. A landline typed here would mean the errand
    // is announced into the void.
    const result = createErrandFormSchema.safeParse({ ...filled, phoneNational: "6017654321" });

    expect(result.success).toBe(false);
  });

  it("keeps both halves parseable on their own, because the action validates them apart", () => {
    // `createErrand` runs `errandSchema` and `collaboratorSchema` separately: they authorize against
    // different things. If the form's combined schema drifted from either, the form would accept
    // what the action refuses.
    expect(errandSchema.safeParse(filled).success).toBe(true);
    expect(collaboratorSchema.safeParse(filled).success).toBe(true);
  });
});
