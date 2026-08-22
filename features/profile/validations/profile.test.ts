import { describe, expect, it } from "vitest";

import { GENDERS, MIN_AGE } from "../domain/profile";
import { COUNTRIES, DEFAULT_COUNTRY_ISO, findCountry, toE164 } from "@/shared/phone/countries";
import {
  ageInYears,
  completeProfileSchema,
  validateBirthDate,
} from "./profile";

const VALID_PROFILE = {
  fullName: "Ana María Restrepo",
  phone: { country: "CO", national: "3001234567" },
  gender: "female",
  address: {
    line: "Calle 60 #10-20, apto 301",
    city: "Bogotá",
    department: "Bogotá D.C.",
  },
  birthDate: "1995-04-12",
  acceptsTerms: true,
} as const;

describe("completeProfileSchema", () => {
  it("accepts a complete profile", () => {
    expect(completeProfileSchema.safeParse(VALID_PROFILE).success).toBe(true);
  });

  it("the role does not come from the form: the schema does not accept it as a field", () => {
    const parsed = completeProfileSchema.parse({ ...VALID_PROFILE, role: "landlord" });
    expect("role" in parsed).toBe(false);
  });

  describe("full name", () => {
    it("requires a given name and a surname", () => {
      const r = completeProfileSchema.safeParse({ ...VALID_PROFILE, fullName: "Ana" });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.message).toBe("Ingresa tu nombre y tu apellido");
    });

    it("trims whitespace", () => {
      const r = completeProfileSchema.parse({ ...VALID_PROFILE, fullName: "  Ana Restrepo  " });
      expect(r.fullName).toBe("Ana Restrepo");
    });
  });

  describe("phone", () => {
    it.each([
      ["with spaces", "300 123 4567"],
      ["with dashes", "300-123-4567"],
      ["with parentheses", "(300) 1234567"],
    ])("normalizes a Colombian mobile %s", (_case, input) => {
      const r = completeProfileSchema.parse({
        ...VALID_PROFILE,
        phone: { country: "CO", national: input },
      });
      expect(r.phone.national).toBe("3001234567");
    });

    it.each([
      ["Bogotá landline", "6011234567"],
      ["too short", "300123456"],
      ["too long", "30012345678"],
      ["with letters", "300abc4567"],
      ["empty", ""],
    ])("rejects a %s number in Colombia", (_case, input) => {
      const r = completeProfileSchema.safeParse({
        ...VALID_PROFILE,
        phone: { country: "CO", national: input },
      });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.path).toEqual(["phone", "national"]);
    });

    it("the strict rule is Colombia-only: Spain accepts a number that would fail there", () => {
      // 612345678 neither starts with 3 nor has 10 digits: invalid in CO, valid in ES.
      expect(
        completeProfileSchema.safeParse({
          ...VALID_PROFILE,
          phone: { country: "CO", national: "612345678" },
        }).success,
      ).toBe(false);
      expect(
        completeProfileSchema.safeParse({
          ...VALID_PROFILE,
          phone: { country: "ES", national: "612345678" },
        }).success,
      ).toBe(true);
    });

    it("rejects a country outside the list", () => {
      expect(
        completeProfileSchema.safeParse({
          ...VALID_PROFILE,
          phone: { country: "XX", national: "3001234567" },
        }).success,
      ).toBe(false);
    });
  });

  describe("country catalog", () => {
    it("Colombia is the default and heads the list", () => {
      expect(DEFAULT_COUNTRY_ISO).toBe("CO");
      expect(COUNTRIES[0]?.iso).toBe("CO");
      expect(findCountry(DEFAULT_COUNTRY_ISO)?.dialCode).toBe("+57");
    });

    it("has no duplicate ISO codes", () => {
      const isos = COUNTRIES.map((country) => country.iso);
      expect(new Set(isos).size).toBe(isos.length);
    });

    it("every dial code has the form +digits", () => {
      for (const country of COUNTRIES) {
        expect(country.dialCode).toMatch(/^\+\d{1,4}$/);
      }
    });

    it("several countries share +1, which is why the key is the ISO", () => {
      const conMasUno = COUNTRIES.filter((country) => country.dialCode === "+1");
      expect(conMasUno.length).toBeGreaterThan(1);
    });
  });

  describe("toE164", () => {
    it("composes the number with the country dial code", () => {
      expect(toE164("CO", "3001234567")).toBe("+573001234567");
      expect(toE164("ES", "612345678")).toBe("+34612345678");
    });

    it("returns null when the country does not exist", () => {
      expect(toE164("XX", "3001234567")).toBeNull();
    });
  });

  describe("gender", () => {
    it.each(GENDERS)("accepts %s", (gender) => {
      expect(completeProfileSchema.safeParse({ ...VALID_PROFILE, gender }).success).toBe(true);
    });

    it("rejects a value outside the list", () => {
      expect(completeProfileSchema.safeParse({ ...VALID_PROFILE, gender: "otro" }).success).toBe(
        false,
      );
    });
  });

  describe("address", () => {
    it("rejects a department that does not exist", () => {
      const r = completeProfileSchema.safeParse({
        ...VALID_PROFILE,
        address: { ...VALID_PROFILE.address, department: "Cataluña" },
      });
      expect(r.success).toBe(false);
    });

    it("rejects a city that is not in the chosen department", () => {
      const r = completeProfileSchema.safeParse({
        ...VALID_PROFILE,
        address: { line: "Calle 60 #10-20", city: "Manizales", department: "Antioquia" },
      });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.message).toBe("Manizales no es un municipio de Antioquia");
      expect(r.error?.issues[0]?.path).toEqual(["address", "city"]);
    });

    it("accepts a real pair, with its accent", () => {
      const r = completeProfileSchema.safeParse({
        ...VALID_PROFILE,
        address: { line: "Calle 60 #10-20", city: "Medellín", department: "Antioquia" },
      });
      expect(r.success).toBe(true);
    });

    it("requires city and address line", () => {
      expect(
        completeProfileSchema.safeParse({
          ...VALID_PROFILE,
          address: { ...VALID_PROFILE.address, city: "" },
        }).success,
      ).toBe(false);
      expect(
        completeProfileSchema.safeParse({
          ...VALID_PROFILE,
          address: { ...VALID_PROFILE.address, line: "Cra" },
        }).success,
      ).toBe(false);
    });
  });

  describe("consent", () => {
    it("rejects unchecked consent", () => {
      const r = completeProfileSchema.safeParse({ ...VALID_PROFILE, acceptsTerms: false });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.message).toBe(
        "Debes aceptar los Términos y la Política de privacidad",
      );
    });
  });

});

describe("ageInYears", () => {
  const referencia = new Date("2026-08-21T12:00:00");

  it("counts completed years", () => {
    expect(ageInYears(new Date("2000-08-21T00:00:00"), referencia)).toBe(26);
  });

  it("does not count the year when the birthday has not arrived yet", () => {
    expect(ageInYears(new Date("2000-08-22T00:00:00"), referencia)).toBe(25);
  });

  it("does count it on the birthday itself", () => {
    expect(ageInYears(new Date("2008-08-21T00:00:00"), referencia)).toBe(18);
  });
});

describe("validateBirthDate", () => {
  const referencia = new Date("2026-08-21T12:00:00");

  it("accepts someone of age", () => {
    expect(validateBirthDate("1995-04-12", referencia).ok).toBe(true);
  });

  it("accepts exactly whoever reaches the minimum age today", () => {
    expect(validateBirthDate("2008-08-21", referencia).ok).toBe(true);
  });

  it("rejects whoever reaches it tomorrow", () => {
    const r = validateBirthDate("2008-08-22", referencia);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toBe(`Debes ser mayor de ${MIN_AGE} años`);
  });

  it("rejects a future date", () => {
    const r = validateBirthDate("2030-01-01", referencia);
    expect(r.ok === false && r.error).toBe("La fecha no puede estar en el futuro");
  });

  it("rejects an absurd age", () => {
    expect(validateBirthDate("1850-01-01", referencia).ok).toBe(false);
  });

  it("rejects text that is not a date", () => {
    const r = validateBirthDate("no-es-fecha", referencia);
    expect(r.ok === false && r.error).toBe("Elige una fecha válida");
  });
});
