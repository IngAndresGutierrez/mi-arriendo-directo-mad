import { describe, expect, it } from "vitest";

import { MAX_VERIFICATION_DOCUMENTS } from "../domain/verification";
import { verificationRequestSchema, verificationVerdictSchema } from "./verification";

const documento = {
  path: "verifications/u1/certificado.pdf",
  fileName: "certificado.pdf",
  contentType: "application/pdf",
  bytes: 120_000,
};

describe("verificationRequestSchema", () => {
  it("acepta una solicitud con el certificado adjunto", () => {
    expect(verificationRequestSchema.safeParse({ documents: [documento] }).success).toBe(true);
  });

  /** No hay nada que teclear: la matrícula ya está en el anuncio y es contra ella que se lee. */
  it("exige al menos un archivo", () => {
    expect(verificationRequestSchema.safeParse({ documents: [] }).success).toBe(false);
  });

  it("pone techo a los archivos", () => {
    const muchos = Array.from({ length: MAX_VERIFICATION_DOCUMENTS + 1 }, () => documento);

    expect(verificationRequestSchema.safeParse({ documents: muchos }).success).toBe(false);
  });

  it("rechaza un archivo que no es ni PDF ni foto", () => {
    expect(
      verificationRequestSchema.safeParse({
        documents: [{ ...documento, contentType: "video/mp4" }],
      }).success,
    ).toBe(false);
  });

  it("rechaza un archivo de más de 8 MB", () => {
    expect(
      verificationRequestSchema.safeParse({
        documents: [{ ...documento, bytes: 9 * 1024 * 1024 }],
      }).success,
    ).toBe(false);
  });
});

describe("verificationVerdictSchema", () => {
  it("aprueba sin necesidad de explicar nada", () => {
    expect(verificationVerdictSchema.safeParse({ approve: true }).success).toBe(true);
  });

  /**
   * **Un rechazo sin motivo es un muro.** "El certificado tiene cuatro meses" y "el certificado
   * nombra a otra persona" son dos cosas completamente distintas que hacer después, y el propietario
   * solo puede actuar sobre la que le digan. Es la misma regla que ya sigue un documento rechazado
   * dentro del proceso.
   */
  it("no deja rechazar sin decir por qué", () => {
    expect(verificationVerdictSchema.safeParse({ approve: false }).success).toBe(false);
    expect(verificationVerdictSchema.safeParse({ approve: false, note: "no" }).success).toBe(false);
    expect(
      verificationVerdictSchema.safeParse({
        approve: false,
        note: "El certificado tiene cuatro meses de expedido.",
      }).success,
    ).toBe(true);
  });
});
