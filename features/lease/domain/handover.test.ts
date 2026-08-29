/**
 * El acta de entrega.
 *
 * Lo que se afirma aquí es sobre todo una cosa: **una aceptación pertenece a la versión que
 * aceptó**. Es la tercera vez que este producto paga por esa regla — la firma del contrato con
 * `documentHash`, el veredicto de un comprobante con `verdictApplies` — y es la que decide si el
 * acta es una prueba o solo una afirmación editable después del acuerdo.
 */
import { describe, expect, it } from "vitest";

import {
  AREA_CONDITIONS,
  HANDOVER_KINDS,
  acceptanceApplies,
  availableHandoverActions,
  checkoutBlocker,
  damagedAreas,
  handoverAnchor,
  handoverFingerprint,
  handoverFolder,
  handoverPhotoProblem,
  handoverState,
  isHandoverKind,
  isHandoverSettled,
  isOwnHandoverPath,
  mayDo,
  objectionApplies,
  type Handover,
  type HandoverArea,
} from "./handover";

const photo = (path: string) => ({
  path,
  fileName: "foto.jpg",
  contentType: "image/jpeg",
  bytes: 1000,
  uploadedAt: "2026-09-01T10:00:00.000Z",
});

const AREAS: readonly HandoverArea[] = [
  { id: "a1", name: "Cocina", condition: "good", note: "Todo funciona.", photos: [photo("handovers/u1/1.jpg")] },
  { id: "a2", name: "Baño principal", condition: "damaged", note: "Grieta en el lavamanos.", photos: [] },
];

/** Un acta enviada, con la huella que le corresponde. */
function acta(overrides: Partial<Handover> = {}): Handover {
  const areas = overrides.areas ?? AREAS;

  return {
    kind: "checkin",
    areas,
    fingerprint: handoverFingerprint(areas),
    submittedAt: "2026-09-01T12:00:00.000Z",
    acceptance: null,
    objection: null,
    createdAt: "2026-09-01T11:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("handoverFingerprint", () => {
  it("es el mismo para el mismo contenido", () => {
    expect(handoverFingerprint(AREAS)).toBe(handoverFingerprint([...AREAS]));
  });

  /**
   * Cada campo que se puede editar tiene que mover la huella. Uno que no entre es un campo que
   * alguien puede cambiar después de que el acta fue aceptada sin que la aceptación se entere — la
   * única forma en que este diseño falla en silencio.
   */
  it.each([
    ["el nombre del área", { name: "Cocina integral" }],
    ["el estado", { condition: "damaged" as const }],
    ["la nota", { note: "Se dañó la llave." }],
    ["las fotos", { photos: [photo("handovers/u1/otra.jpg")] }],
  ])("cambia cuando cambia %s", (_que, cambio) => {
    const cambiadas = [{ ...AREAS[0], ...cambio }, AREAS[1]] as readonly HandoverArea[];

    expect(handoverFingerprint(cambiadas)).not.toBe(handoverFingerprint(AREAS));
  });

  /** El orden es parte del documento: leer la cocina antes que el baño no es lo mismo. */
  it("cambia cuando cambia el orden de las áreas", () => {
    expect(handoverFingerprint([AREAS[1], AREAS[0]] as readonly HandoverArea[])).not.toBe(
      handoverFingerprint(AREAS),
    );
  });

  /** Y no cambia por espacios de más, que no son contenido. */
  it("no cambia por espacios alrededor", () => {
    const conEspacios = [{ ...AREAS[0], name: "  Cocina  ", note: " Todo funciona. " }, AREAS[1]];

    expect(handoverFingerprint(conEspacios as readonly HandoverArea[])).toBe(
      handoverFingerprint(AREAS),
    );
  });

  it("no revienta con un acta vacía", () => {
    expect(handoverFingerprint([])).toBe("");
  });
});

describe("handoverState", () => {
  it("es borrador mientras no se ha enviado", () => {
    expect(handoverState(null)).toBe("draft");
    expect(handoverState(acta({ submittedAt: null }))).toBe("draft");
    expect(handoverState(acta({ areas: [], submittedAt: "2026-09-01T12:00:00.000Z" }))).toBe("draft");
  });

  it("espera al inquilino una vez enviada", () => {
    expect(handoverState(acta())).toBe("awaiting_tenant");
  });

  it("queda aceptada cuando el inquilino acepta esa versión", () => {
    const enviada = acta();
    const aceptada = acta({
      acceptance: {
        at: "2026-09-02T10:00:00.000Z",
        fingerprint: enviada.fingerprint,
        ip: "1.2.3.4",
        userAgent: "Mozilla/5.0",
      },
    });

    expect(handoverState(aceptada)).toBe("accepted");
    expect(acceptanceApplies(aceptada)).toBe(true);
  });

  /**
   * **La aserción que sostiene todo el diseño.** El propietario acepta una versión, el propietario
   * la edita, y la aceptación deja de aplicar sola — sin ninguna limpieza, igual que reemplazar el
   * PDF de un contrato invalida sus firmas.
   */
  it("vuelve a esperar al inquilino si el acta se edita después de aceptada", () => {
    const original = acta();
    const aceptacion = {
      at: "2026-09-02T10:00:00.000Z",
      fingerprint: original.fingerprint,
      ip: "1.2.3.4",
      userAgent: "Mozilla/5.0",
    };
    const editadas = [{ ...AREAS[0], condition: "good" as const, note: "Nada que reportar." }, AREAS[1]];
    const editada = acta({
      areas: editadas as readonly HandoverArea[],
      fingerprint: handoverFingerprint(editadas as readonly HandoverArea[]),
      acceptance: aceptacion,
    });

    expect(handoverState(original)).toBe("awaiting_tenant");
    expect(handoverState(editada)).toBe("awaiting_tenant");
    expect(acceptanceApplies(editada)).toBe(false);
  });

  it("queda con observaciones cuando el inquilino objeta esa versión", () => {
    const base = acta();
    const objetada = acta({
      objection: {
        at: "2026-09-02T10:00:00.000Z",
        fingerprint: base.fingerprint,
        note: "La grieta del baño ya estaba y no aparece en las fotos.",
        photos: [],
      },
    });

    expect(handoverState(objetada)).toBe("disputed");
    expect(objectionApplies(objetada)).toBe(true);
  });

  /** Una objeción sobre una versión anterior tampoco aplica: el propietario ya la corrigió. */
  it("deja de estar en disputa cuando el propietario revisa lo objetado", () => {
    const base = acta();
    const revisadas = [{ ...AREAS[1], condition: "damaged" as const, note: "Grieta preexistente." }];
    const revisada = acta({
      areas: revisadas as readonly HandoverArea[],
      fingerprint: handoverFingerprint(revisadas as readonly HandoverArea[]),
      objection: {
        at: "2026-09-02T10:00:00.000Z",
        fingerprint: base.fingerprint,
        note: "La grieta ya estaba.",
        photos: [],
      },
    });

    expect(handoverState(revisada)).toBe("awaiting_tenant");
  });

  /** Y si objetó y luego aceptó la misma versión, manda la última: cambiar de opinión vale. */
  it("respeta la última respuesta cuando las dos aplican", () => {
    const base = acta();
    const ambas = acta({
      objection: { at: "2026-09-02T10:00:00.000Z", fingerprint: base.fingerprint, note: "Falta el balcón.", photos: [] },
      acceptance: {
        at: "2026-09-03T10:00:00.000Z",
        fingerprint: base.fingerprint,
        ip: "1.2.3.4",
        userAgent: "Mozilla/5.0",
      },
    });

    expect(handoverState(ambas)).toBe("accepted");
    expect(handoverState({ ...ambas, acceptance: { ...ambas.acceptance!, at: "2026-09-01T10:00:00.000Z" } })).toBe(
      "disputed",
    );
  });
});

describe("availableHandoverActions", () => {
  /** El inquilino nunca escribe el acta, y el propietario nunca la acepta por él. */
  it("mantiene separado quién escribe y quién responde", () => {
    expect(mayDo("draft", "tenant", "draft")).toBe(false);
    expect(mayDo("draft", "tenant", "submit")).toBe(false);
    expect(mayDo("awaiting_tenant", "landlord", "accept")).toBe(false);
    expect(mayDo("awaiting_tenant", "landlord", "object")).toBe(false);
  });

  it("deja al propietario redactar y enviar mientras es borrador", () => {
    expect(availableHandoverActions("draft", "landlord")).toEqual(["draft", "submit"]);
  });

  it("no deja reenviar lo ya enviado, pero sí corregirlo", () => {
    expect(availableHandoverActions("awaiting_tenant", "landlord")).toEqual(["draft"]);
    expect(availableHandoverActions("accepted", "landlord")).toEqual(["draft"]);
  });

  it("deja al inquilino aceptar u objetar mientras hay algo que responder", () => {
    expect(availableHandoverActions("awaiting_tenant", "tenant")).toEqual(["accept", "object"]);
    expect(availableHandoverActions("disputed", "tenant")).toEqual(["accept", "object"]);
  });

  /** Sobre un borrador el inquilino no tiene nada que responder: todavía no le han mostrado nada. */
  it("no le ofrece nada al inquilino sobre un borrador ni sobre lo ya aceptado", () => {
    expect(availableHandoverActions("draft", "tenant")).toEqual([]);
    expect(availableHandoverActions("accepted", "tenant")).toEqual([]);
  });
});

describe("checkoutBlocker", () => {
  /** Una devolución es una comparación: sin entrega no hay contra qué compararla. */
  it("bloquea la devolución mientras no se haya enviado la entrega", () => {
    expect(checkoutBlocker(null)).toBe("no_checkin");
    expect(checkoutBlocker({ submittedAt: null })).toBe("no_checkin");
  });

  /**
   * Basta con que se haya **enviado**, no con que esté aceptada: exigir la aceptación dejaría al
   * propietario en manos de un inquilino que nunca responde, que es un rehén que este producto no
   * puede crear.
   */
  it("basta con que la entrega se haya enviado, aunque nadie la haya aceptado", () => {
    expect(checkoutBlocker({ submittedAt: "2026-09-01T12:00:00.000Z" })).toBeNull();
  });
});

describe("las fotos", () => {
  it("acepta los tres formatos que un teléfono produce", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(handoverPhotoProblem({ type, size: 1000 })).toBeNull();
    }
  });

  /** Sin video, y a propósito: dos videos de una pared se comparan peor que dos fotos de ella. */
  it("rechaza el video, que en un acta no compara nada", () => {
    expect(handoverPhotoProblem({ type: "video/mp4", size: 1000 })).toContain("JPG");
  });

  it("rechaza lo vacío y lo enorme, y dice qué hacer", () => {
    expect(handoverPhotoProblem({ type: "image/jpeg", size: 0 })).toContain("vacío");
    expect(handoverPhotoProblem({ type: "image/jpeg", size: 9 * 1024 * 1024 })).toContain("8 MB");
  });

  /** La carpeta la escribe el navegador y la comprueba el servidor: una sola función para las dos. */
  it("solo acepta rutas dentro de la carpeta de quien sube", () => {
    expect(isOwnHandoverPath(`${handoverFolder("u1")}foto.jpg`, "u1")).toBe(true);
    expect(isOwnHandoverPath(`${handoverFolder("u2")}foto.jpg`, "u1")).toBe(false);
    expect(isOwnHandoverPath(`${handoverFolder("u1")}../u2/foto.jpg`, "u1")).toBe(false);
  });
});

describe("lo demás", () => {
  it("reconoce los dos tipos de acta y nada más", () => {
    expect(HANDOVER_KINDS.every(isHandoverKind)).toBe(true);
    expect(isHandoverKind("intermedia")).toBe(false);
    expect(isHandoverKind(undefined)).toBe(false);
  });

  it("solo da por resuelta la aceptada", () => {
    expect(isHandoverSettled("accepted")).toBe(true);
    for (const state of ["draft", "awaiting_tenant", "disputed"] as const) {
      expect(isHandoverSettled(state)).toBe(false);
    }
  });

  it("cuenta las áreas con daños", () => {
    expect(damagedAreas(acta())).toBe(1);
    expect(damagedAreas(null)).toBe(0);
  });

  it("tiene una etiqueta para cada estado posible de un área", () => {
    expect(AREA_CONDITIONS).toHaveLength(3);
  });

  it("ancla cada acta en su propia sección", () => {
    expect(handoverAnchor("checkin")).toBe("entrega-checkin");
    expect(handoverAnchor("checkout")).toBe("entrega-checkout");
  });
});
