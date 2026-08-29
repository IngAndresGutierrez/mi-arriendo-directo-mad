/**
 * La verificación de titularidad.
 *
 * Lo que se afirma aquí es sobre todo **cuándo la insignia deja de valer**: una aprobación dice que
 * esta cuenta figura como propietaria del inmueble detrás de *esa* matrícula, así que el día que la
 * matrícula cambia la frase habla de otro inmueble. Es la misma atadura que el `documentHash` de la
 * firma y la huella del acta, por tercera vez.
 */
import { describe, expect, it } from "vitest";

import {
  isOwnVerificationPath,
  isVerified,
  sameRegistry,
  verificationBlocker,
  verificationDocumentProblem,
  verificationFolder,
  verificationState,
  type PropertyVerification,
} from "./verification";

const MATRICULA = "050-123456";

const verificacion = (overrides: Partial<PropertyVerification> = {}): PropertyVerification => ({
  documents: [],
  submittedAt: "2026-09-01T10:00:00.000Z",
  verifiedAt: null,
  rejectedAt: null,
  note: "",
  registryNumber: MATRICULA,
  reviewerUid: "",
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:00:00.000Z",
  ...overrides,
});

describe("verificationState", () => {
  it("no hay nada mientras nadie la ha pedido", () => {
    expect(verificationState(null, MATRICULA)).toBe("none");
    expect(verificationState(verificacion({ submittedAt: null }), MATRICULA)).toBe("none");
  });

  it("queda en revisión hasta que alguien la mira", () => {
    expect(verificationState(verificacion(), MATRICULA)).toBe("in_review");
  });

  it("queda verificada cuando el revisor la aprueba", () => {
    const aprobada = verificacion({ verifiedAt: "2026-09-02T10:00:00.000Z" });

    expect(verificationState(aprobada, MATRICULA)).toBe("verified");
    expect(isVerified(verificationState(aprobada, MATRICULA))).toBe(true);
  });

  it("queda rechazada, con su motivo, cuando no se pudo", () => {
    const rechazada = verificacion({
      rejectedAt: "2026-09-02T10:00:00.000Z",
      note: "El certificado tiene cuatro meses.",
    });

    expect(verificationState(rechazada, MATRICULA)).toBe("rejected");
  });

  /**
   * **La aserción que sostiene el diseño.** Un propietario aprobado que cambia la matrícula tiene
   * una aprobación sobre otro inmueble, y la insignia tiene que caerse en el momento en que el
   * número se mueve — no cuando alguien se acuerde de volver a revisar.
   */
  it("deja de valer sola cuando cambia la matrícula", () => {
    const aprobada = verificacion({ verifiedAt: "2026-09-02T10:00:00.000Z" });

    expect(verificationState(aprobada, "050-999999")).toBe("stale");
    expect(isVerified(verificationState(aprobada, "050-999999"))).toBe(false);
  });

  /** Un rechazo corregido y vuelto a aprobar: manda el veredicto más nuevo, no el que exista. */
  it("respeta el veredicto más reciente cuando hay dos", () => {
    const corregida = verificacion({
      rejectedAt: "2026-09-02T10:00:00.000Z",
      verifiedAt: "2026-09-05T10:00:00.000Z",
    });
    const vueltaAtras = verificacion({
      verifiedAt: "2026-09-02T10:00:00.000Z",
      rejectedAt: "2026-09-05T10:00:00.000Z",
    });

    expect(verificationState(corregida, MATRICULA)).toBe("verified");
    expect(verificationState(vueltaAtras, MATRICULA)).toBe("rejected");
  });
});

describe("sameRegistry", () => {
  /**
   * `050-123456`, `050 123456` y `50-123456` son el mismo inmueble. La matrícula se valida flojo
   * en `property.ts` porque en la práctica se escribe de todas las formas, así que la comparación
   * tiene que ser tan floja como la validación — perder una insignia por un guion sería absurdo.
   */
  it("reconoce el mismo número escrito de varias formas", () => {
    expect(sameRegistry("050-123456", "050 123456")).toBe(true);
    expect(sameRegistry("050-123456", "50-123456")).toBe(true);
    expect(sameRegistry("050-123456", "050123456")).toBe(true);
  });

  it("distingue dos matrículas de verdad distintas", () => {
    expect(sameRegistry("050-123456", "050-123457")).toBe(false);
    expect(sameRegistry("050-123456", "060-123456")).toBe(false);
  });

  /** Vacío contra vacío no es "la misma": es no tener número, y eso no verifica nada. */
  it("no da por iguales dos matrículas vacías", () => {
    expect(sameRegistry("", "")).toBe(false);
    expect(sameRegistry("  ", "")).toBe(false);
  });
});

describe("verificationBlocker", () => {
  const publicado = { status: "available" };

  it("deja pedirla sobre un inmueble publicado y con matrícula", () => {
    expect(verificationBlocker(publicado, MATRICULA, "none")).toBeNull();
  });

  /** Verificar un borrador sería gastar el tiempo de un revisor en algo que nadie puede ver. */
  it("no la deja pedir sobre un borrador", () => {
    expect(verificationBlocker({ status: "draft" }, MATRICULA, "none")).toBe("not_published");
  });

  /** Sin matrícula no hay certificado que pedir: es el número con el que se saca. */
  it("no la deja pedir sin matrícula", () => {
    expect(verificationBlocker(publicado, "  ", "none")).toBe("no_registry");
  });

  /** Dos solicitudes del mismo inmueble son dos revisores leyendo el mismo certificado. */
  it("no acepta una segunda solicitud mientras hay una en revisión", () => {
    expect(verificationBlocker(publicado, MATRICULA, "in_review")).toBe("in_review");
  });

  it("no la repite sobre algo ya verificado", () => {
    expect(verificationBlocker(publicado, MATRICULA, "verified")).toBe("already_verified");
  });

  /** Pero un rechazo y una caducada sí se pueden volver a pedir: para eso está el motivo. */
  it("deja volver a pedirla tras un rechazo o cuando caducó", () => {
    expect(verificationBlocker(publicado, MATRICULA, "rejected")).toBeNull();
    expect(verificationBlocker(publicado, MATRICULA, "stale")).toBeNull();
  });
});

describe("los archivos", () => {
  it("acepta el certificado en PDF y una foto de él", () => {
    for (const type of ["application/pdf", "image/jpeg", "image/png", "image/webp"]) {
      expect(verificationDocumentProblem({ type, size: 1000 })).toBeNull();
    }
  });

  it("rechaza lo que no es ninguno de los dos, lo vacío y lo enorme", () => {
    expect(verificationDocumentProblem({ type: "video/mp4", size: 1000 })).toContain("PDF");
    expect(verificationDocumentProblem({ type: "application/pdf", size: 0 })).toContain("vacío");
    expect(
      verificationDocumentProblem({ type: "application/pdf", size: 9 * 1024 * 1024 }),
    ).toContain("8 MB");
  });

  /**
   * Un certificado de tradición lleva la dirección completa y la identidad del dueño — es el
   * documento más sensible que este producto guarda sobre un inmueble. La carpeta la escribe el
   * navegador y la comprueba el servidor con esta misma función.
   */
  it("solo acepta rutas dentro de la carpeta de quien sube", () => {
    expect(isOwnVerificationPath(`${verificationFolder("u1")}cert.pdf`, "u1")).toBe(true);
    expect(isOwnVerificationPath(`${verificationFolder("u2")}cert.pdf`, "u1")).toBe(false);
    expect(isOwnVerificationPath(`${verificationFolder("u1")}../u2/cert.pdf`, "u1")).toBe(false);
  });
});
