import { describe, expect, it } from "vitest";

import { GENDERS, MIN_AGE } from "../domain/colombia";
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
  it("acepta un perfil completo", () => {
    expect(completeProfileSchema.safeParse(VALID_PROFILE).success).toBe(true);
  });

  it("el rol no viene del formulario: el schema no lo acepta como campo", () => {
    const parsed = completeProfileSchema.parse({ ...VALID_PROFILE, role: "landlord" });
    expect("role" in parsed).toBe(false);
  });

  describe("nombre completo", () => {
    it("exige nombre y apellido", () => {
      const r = completeProfileSchema.safeParse({ ...VALID_PROFILE, fullName: "Ana" });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.message).toBe("Ingresa tu nombre y tu apellido");
    });

    it("recorta espacios", () => {
      const r = completeProfileSchema.parse({ ...VALID_PROFILE, fullName: "  Ana Restrepo  " });
      expect(r.fullName).toBe("Ana Restrepo");
    });
  });

  describe("teléfono", () => {
    it.each([
      ["con espacios", "300 123 4567"],
      ["con guiones", "300-123-4567"],
      ["con paréntesis", "(300) 1234567"],
    ])("normaliza un celular colombiano %s", (_caso, entrada) => {
      const r = completeProfileSchema.parse({
        ...VALID_PROFILE,
        phone: { country: "CO", national: entrada },
      });
      expect(r.phone.national).toBe("3001234567");
    });

    it.each([
      ["fijo de Bogotá", "6011234567"],
      ["muy corto", "300123456"],
      ["muy largo", "30012345678"],
      ["con letras", "300abc4567"],
      ["vacío", ""],
    ])("rechaza en Colombia un número %s", (_caso, entrada) => {
      const r = completeProfileSchema.safeParse({
        ...VALID_PROFILE,
        phone: { country: "CO", national: entrada },
      });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.path).toEqual(["phone", "national"]);
    });

    it("la regla estricta es solo de Colombia: España acepta un número que allí no valdría", () => {
      // 612345678 no empieza por 3 ni tiene 10 dígitos: inválido en CO, válido en ES.
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

    it("rechaza un país que no está en la lista", () => {
      expect(
        completeProfileSchema.safeParse({
          ...VALID_PROFILE,
          phone: { country: "XX", national: "3001234567" },
        }).success,
      ).toBe(false);
    });
  });

  describe("catálogo de países", () => {
    it("Colombia es el valor por defecto y encabeza la lista", () => {
      expect(DEFAULT_COUNTRY_ISO).toBe("CO");
      expect(COUNTRIES[0]?.iso).toBe("CO");
      expect(findCountry(DEFAULT_COUNTRY_ISO)?.dialCode).toBe("+57");
    });

    it("no hay códigos ISO repetidos", () => {
      const isos = COUNTRIES.map((country) => country.iso);
      expect(new Set(isos).size).toBe(isos.length);
    });

    it("todo indicativo tiene la forma +digitos", () => {
      for (const country of COUNTRIES) {
        expect(country.dialCode).toMatch(/^\+\d{1,4}$/);
      }
    });

    it("varios países comparten +1, por eso la clave es el ISO", () => {
      const conMasUno = COUNTRIES.filter((country) => country.dialCode === "+1");
      expect(conMasUno.length).toBeGreaterThan(1);
    });
  });

  describe("toE164", () => {
    it("compone el número con el indicativo del país", () => {
      expect(toE164("CO", "3001234567")).toBe("+573001234567");
      expect(toE164("ES", "612345678")).toBe("+34612345678");
    });

    it("devuelve null si el país no existe", () => {
      expect(toE164("XX", "3001234567")).toBeNull();
    });
  });

  describe("género", () => {
    it.each(GENDERS)("acepta %s", (gender) => {
      expect(completeProfileSchema.safeParse({ ...VALID_PROFILE, gender }).success).toBe(true);
    });

    it("rechaza un valor fuera de la lista", () => {
      expect(completeProfileSchema.safeParse({ ...VALID_PROFILE, gender: "otro" }).success).toBe(
        false,
      );
    });
  });

  describe("dirección", () => {
    it("rechaza un departamento que no existe", () => {
      const r = completeProfileSchema.safeParse({
        ...VALID_PROFILE,
        address: { ...VALID_PROFILE.address, department: "Cataluña" },
      });
      expect(r.success).toBe(false);
    });

    it("exige ciudad y dirección", () => {
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

  describe("consentimiento", () => {
    it("rechaza el consentimiento sin marcar", () => {
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

  it("cuenta años cumplidos", () => {
    expect(ageInYears(new Date("2000-08-21T00:00:00"), referencia)).toBe(26);
  });

  it("no cuenta el año si el cumpleaños aún no llegó", () => {
    expect(ageInYears(new Date("2000-08-22T00:00:00"), referencia)).toBe(25);
  });

  it("sí lo cuenta el mismo día del cumpleaños", () => {
    expect(ageInYears(new Date("2008-08-21T00:00:00"), referencia)).toBe(18);
  });
});

describe("validateBirthDate", () => {
  const referencia = new Date("2026-08-21T12:00:00");

  it("acepta a una persona mayor de edad", () => {
    expect(validateBirthDate("1995-04-12", referencia).ok).toBe(true);
  });

  it("acepta exactamente al que cumple la edad mínima hoy", () => {
    expect(validateBirthDate("2008-08-21", referencia).ok).toBe(true);
  });

  it("rechaza al que la cumple mañana", () => {
    const r = validateBirthDate("2008-08-22", referencia);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toBe(`Debes ser mayor de ${MIN_AGE} años`);
  });

  it("rechaza una fecha futura", () => {
    const r = validateBirthDate("2030-01-01", referencia);
    expect(r.ok === false && r.error).toBe("La fecha no puede estar en el futuro");
  });

  it("rechaza una edad absurda", () => {
    expect(validateBirthDate("1850-01-01", referencia).ok).toBe(false);
  });

  it("rechaza texto que no es fecha", () => {
    const r = validateBirthDate("no-es-fecha", referencia);
    expect(r.ok === false && r.error).toBe("Elige una fecha válida");
  });
});
