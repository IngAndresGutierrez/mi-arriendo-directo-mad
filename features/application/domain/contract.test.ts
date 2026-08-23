import { describe, expect, it } from "vitest";

import {
  challengeProblem,
  challengeProblemMessage,
  contractBlocker,
  contractBlockerMessage,
  contractFileProblem,
  canStamp,
  contractState,
  hasSigned,
  spotFor,
  spotProblem,
  spotsReady,
  maskChannel,
  replacingVoids,
  validSignatures,
  CONTRACT_MAX_BYTES,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  SIGNATURE_CLAUSE,
  SIGNATURE_CLAUSE_VERSION,
  type Contract,
  type ContractParty,
  type ContractSignature,
  type SignatureChallenge,
  type SignatureSpot,
} from "./contract";

const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);
const NOW = Date.parse("2026-09-20T15:00:00.000Z");

const signature = (party: ContractParty, documentHash = HASH): ContractSignature => ({
  party,
  uid: `uid-${party}`,
  fullName: party === "landlord" ? "Marta Propietaria Gómez" : "Carlos Inquilino Ramírez",
  documentId: "Cédula de ciudadanía 1053812345",
  signedAt: "2026-09-20T14:00:00.000Z",
  acceptedClauseAt: "2026-09-20T13:59:00.000Z",
  clauseVersion: SIGNATURE_CLAUSE_VERSION,
  documentHash,
  channel: "email",
  sentTo: "ca••••••@ejemplo.test",
  ip: "190.0.0.1",
  userAgent: "Mozilla/5.0",
  strokePath: "",
});

const contract = (
  signatures: readonly ContractSignature[],
  sha256 = HASH,
): Contract => ({
  document: {
    path: "contracts/abc/contrato.pdf",
    fileName: "contrato.pdf",
    contentType: "application/pdf",
    bytes: 120_000,
    sha256,
    uploadedAt: "2026-09-20T13:00:00.000Z",
  },
  signatures,
  spots: [],
  stamped: null,
  note: "",
});

describe("contractState", () => {
  it("is `none` with no document", () => {
    expect(contractState(null)).toBe("none");
    expect(contractState({ document: null, signatures: [], spots: [], stamped: null, note: "" })).toBe("none");
  });

  it("is `awaiting_signatures` with a document and nobody signed", () => {
    expect(contractState(contract([]))).toBe("awaiting_signatures");
  });

  it("is still `awaiting_signatures` with only one party signed", () => {
    expect(contractState(contract([signature("landlord")]))).toBe("awaiting_signatures");
    expect(contractState(contract([signature("tenant")]))).toBe("awaiting_signatures");
  });

  it("is `signed` only once both signed", () => {
    expect(contractState(contract([signature("landlord"), signature("tenant")]))).toBe("signed");
  });
});

/*
 * El corazón del cumplimiento: "es posible detectar cualquier alteración posterior a la firma"
 * (Decreto 2364). No hace falta código de limpieza — la firma deja de contar sola.
 */
describe("validSignatures: la firma está atada al hash del documento", () => {
  it("descarta las firmas de un documento distinto al actual", () => {
    const reemplazado = contract(
      [signature("landlord", OTHER_HASH), signature("tenant", OTHER_HASH)],
      HASH,
    );
    expect(validSignatures(reemplazado)).toHaveLength(0);
    expect(contractState(reemplazado)).toBe("awaiting_signatures");
  });

  it("reemplazar el contrato invalida lo ya firmado, sin borrar nada", () => {
    const firmado = contract([signature("landlord"), signature("tenant")]);
    expect(contractState(firmado)).toBe("signed");

    // El propietario sube otro archivo: mismo registro, hash nuevo.
    const conOtroArchivo: Contract = {
      ...firmado,
      document: { ...firmado.document!, sha256: OTHER_HASH },
    };
    expect(contractState(conOtroArchivo)).toBe("awaiting_signatures");
    expect(contractBlocker(conOtroArchivo)).toBe("awaiting_both");
  });

  it("conserva la firma que sí corresponde al documento actual", () => {
    const mixto = contract([signature("landlord"), signature("tenant", OTHER_HASH)]);
    expect(validSignatures(mixto)).toHaveLength(1);
    expect(hasSigned(mixto, "landlord")).toBe(true);
    expect(hasSigned(mixto, "tenant")).toBe(false);
  });

  it("sin documento no hay firma válida, aunque haya firmas guardadas", () => {
    expect(validSignatures({ document: null, signatures: [signature("landlord")], spots: [], stamped: null, note: "" })).toHaveLength(0);
  });
});

describe("replacingVoids", () => {
  it("dice cuántas firmas se perderían al reemplazar", () => {
    expect(replacingVoids(contract([]))).toBe(0);
    expect(replacingVoids(contract([signature("landlord")]))).toBe(1);
    expect(replacingVoids(contract([signature("landlord"), signature("tenant")]))).toBe(2);
  });

  it("no cuenta las que ya estaban invalidadas", () => {
    expect(replacingVoids(contract([signature("landlord", OTHER_HASH)]))).toBe(0);
  });
});

describe("contractBlocker", () => {
  it("bloquea sin documento", () => {
    expect(contractBlocker(null)).toBe("no_document");
  });

  it("nombra a quién falta", () => {
    expect(contractBlocker(contract([]))).toBe("awaiting_both");
    expect(contractBlocker(contract([signature("landlord")]))).toBe("awaiting_tenant");
    expect(contractBlocker(contract([signature("tenant")]))).toBe("awaiting_landlord");
  });

  it("deja pasar solo con las dos firmas", () => {
    expect(contractBlocker(contract([signature("landlord"), signature("tenant")]))).toBeNull();
  });

  /* El mismo bloqueo se lee distinto en cada lado: "falta tu firma" o "falta la del otro". */
  it("le dice a cada parte de quién es el turno", () => {
    expect(contractBlockerMessage("awaiting_landlord", true)).toBe("Falta tu firma.");
    expect(contractBlockerMessage("awaiting_landlord", false)).toMatch(/Ya firmaste/);
    expect(contractBlockerMessage("awaiting_tenant", false)).toBe("Falta tu firma.");
    expect(contractBlockerMessage("awaiting_tenant", true)).toMatch(/Ya firmaste/);
    expect(contractBlockerMessage(null, true)).toBeNull();
  });
});

describe("challengeProblem", () => {
  const challenge: SignatureChallenge = {
    party: "tenant",
    codeHash: "c".repeat(64),
    channel: "email",
    sentTo: "ca••••••@ejemplo.test",
    issuedAt: new Date(NOW - 60_000).toISOString(),
    attempts: 0,
    documentHash: HASH,
  };

  it("acepta uno recién pedido para el documento actual", () => {
    expect(challengeProblem(challenge, "tenant", HASH, NOW)).toBe("none");
  });

  it("no hay nada que responder si nunca se pidió", () => {
    expect(challengeProblem(null, "tenant", HASH, NOW)).toBe("missing");
  });

  it("un código de la otra parte no sirve", () => {
    expect(challengeProblem(challenge, "landlord", HASH, NOW)).toBe("wrong_party");
  });

  /* Si el contrato cambió entre pedir el código y usarlo, se estaría firmando otra cosa. */
  it("un código pedido para otro documento no sirve", () => {
    expect(challengeProblem(challenge, "tenant", OTHER_HASH, NOW)).toBe("stale_document");
  });

  it("caduca a los diez minutos, y justo en el límite todavía vale", () => {
    const enElLimite = { ...challenge, issuedAt: new Date(NOW - OTP_TTL_MS).toISOString() };
    expect(challengeProblem(enElLimite, "tenant", HASH, NOW)).toBe("none");

    const pasado = { ...challenge, issuedAt: new Date(NOW - OTP_TTL_MS - 1).toISOString() };
    expect(challengeProblem(pasado, "tenant", HASH, NOW)).toBe("expired");
  });

  it("muere tras demasiados intentos", () => {
    const quemado = { ...challenge, attempts: OTP_MAX_ATTEMPTS };
    expect(challengeProblem(quemado, "tenant", HASH, NOW)).toBe("too_many_attempts");
  });

  /*
   * El orden importa: un código quemado Y caducado tiene que reportar el agotamiento, no la
   * caducidad, o alguien podría seguir intentando pidiendo códigos nuevos sin límite real.
   */
  it("los intentos agotados pesan más que la caducidad", () => {
    const ambos = {
      ...challenge,
      attempts: OTP_MAX_ATTEMPTS,
      issuedAt: new Date(NOW - OTP_TTL_MS - 1).toISOString(),
    };
    expect(challengeProblem(ambos, "tenant", HASH, NOW)).toBe("too_many_attempts");
  });

  it("cada problema tiene su frase, y 'none' no tiene ninguna", () => {
    for (const problem of ["missing", "expired", "too_many_attempts", "stale_document", "wrong_party"] as const) {
      expect(challengeProblemMessage(problem)).toBeTruthy();
    }
    expect(challengeProblemMessage("none")).toBeNull();
  });
});

describe("maskChannel", () => {
  it("deja ver de dónde salió el correo, no cuál es", () => {
    const masked = maskChannel("email", "carlos.inquilino@ejemplo.test");
    expect(masked).toMatch(/^ca•+@ejemplo\.test$/);
    expect(masked).not.toContain("carlos.inquilino");
  });

  it("del teléfono deja los últimos cuatro", () => {
    const masked = maskChannel("whatsapp", "+573001234567");
    expect(masked.endsWith("4567")).toBe(true);
    expect(masked).not.toContain("300123");
  });

  /* Un valor roto no debe filtrarse entero por no parecerse a lo esperado. */
  it("no filtra nada cuando el valor no tiene la forma esperada", () => {
    expect(maskChannel("email", "sin-arroba")).toBe("•••");
    expect(maskChannel("email", "@solo-dominio")).toBe("•••");
    expect(maskChannel("whatsapp", "12")).toBe("•••");
  });
});

describe("contractFileProblem", () => {
  it("acepta el PDF de un contrato", () => {
    expect(contractFileProblem({ type: "application/pdf", size: 200_000 })).toBeNull();
  });

  /* Se aceptaban fotos y se dejó de hacer: una foto no se puede estampar, así que la firma no
     tiene dónde dibujarse y el panel acababa explicando una limitación en vez de ofrecer algo. */
  it("ya no acepta una foto del contrato", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(contractFileProblem({ type, size: 200_000 })).toMatch(/PDF/);
    }
  });

  it("rechaza cualquier otra cosa, se llame como se llame", () => {
    expect(contractFileProblem({ type: "application/zip", size: 1000 })).toMatch(/PDF/);
    expect(contractFileProblem({ type: "", size: 1000 })).toMatch(/PDF/);
  });

  /*
   * Y sigue tratando bien lo que ya está subido: hay contratos guardados como imagen de antes de
   * esta regla, y son válidos — el código es lo que firma. Lo que no se puede es crear otro.
   */
  it("un contrato ya guardado como imagen sigue firmándose, solo no se estampa", () => {
    const conFoto = { ...contract([]), document: { ...contract([]).document!, contentType: "image/jpeg" } };
    expect(canStamp(conFoto.document)).toBe(false);
    expect(contractState(conFoto)).toBe("awaiting_signatures");
    expect(contractBlocker(conFoto)).toBe("awaiting_both");
  });

  it("rechaza el vacío y lo que pasa del tope, y acepta justo el tope", () => {
    expect(contractFileProblem({ type: "application/pdf", size: 0 })).toMatch(/vacío/);
    expect(contractFileProblem({ type: "application/pdf", size: CONTRACT_MAX_BYTES + 1 })).toMatch(/8 MB/);
    expect(contractFileProblem({ type: "application/pdf", size: CONTRACT_MAX_BYTES })).toBeNull();
  });
});

describe("la cláusula que sostiene la presunción", () => {
  /*
   * Decreto 2364: la presunción aplica a la firma "pactada mediante acuerdo". La cláusula tiene que
   * decir las tres cosas que hacen confiable el método, y su versión tiene que existir para que un
   * cambio de redacción no aplique hacia atrás.
   */
  it("dice que el código equivale a la firma, que se registra el momento y que no se puede alterar", () => {
    expect(SIGNATURE_CLAUSE).toMatch(/equivale a mi firma/);
    expect(SIGNATURE_CLAUSE).toMatch(/momento exacto/);
    expect(SIGNATURE_CLAUSE).toMatch(/no puede modificarse/);
  });

  it("está versionada", () => {
    expect(SIGNATURE_CLAUSE_VERSION).toBeGreaterThanOrEqual(1);
  });
});

const spot = (party: ContractParty): SignatureSpot => ({
  party,
  page: 0,
  x: 0.1,
  y: 0.8,
  width: 0.28,
  height: 0.06,
});

describe("canStamp", () => {
  it("solo un PDF puede llevar la firma estampada", () => {
    expect(canStamp(contract([]).document)).toBe(true);
  });

  /* Una foto del contrato firmado a mano sigue siendo un contrato: no se rechaza, no se estampa. */
  it("una foto no se estampa, y no por eso deja de valer", () => {
    for (const contentType of ["image/jpeg", "image/png", "image/webp"]) {
      const conFoto = { ...contract([]), document: { ...contract([]).document!, contentType } };
      expect(canStamp(conFoto.document)).toBe(false);
      // Y se puede firmar igual: el código es lo que firma.
      expect(contractState(conFoto)).toBe("awaiting_signatures");
    }
  });

  it("sin documento no hay nada que estampar", () => {
    expect(canStamp(null)).toBe(false);
  });
});

describe("spotFor y spotsReady", () => {
  const conPuntos = (...partes: ContractParty[]): Contract => ({
    ...contract([]),
    spots: partes.map(spot),
  });

  it("encuentra el punto de cada parte", () => {
    const marcado = conPuntos("landlord", "tenant");
    expect(spotFor(marcado, "landlord")?.party).toBe("landlord");
    expect(spotFor(marcado, "tenant")?.party).toBe("tenant");
    expect(spotFor(contract([]), "landlord")).toBeNull();
  });

  it("está listo solo con los dos puntos marcados", () => {
    expect(spotsReady(contract([]))).toBe(false);
    expect(spotsReady(conPuntos("landlord"))).toBe(false);
    expect(spotsReady(conPuntos("landlord", "tenant"))).toBe(true);
  });

  /* Marcar puntos sobre una foto no habilita el dibujo: no hay dónde estamparlo. */
  it("no está listo si el documento no es un PDF, aunque haya puntos", () => {
    const sobreFoto: Contract = {
      ...conPuntos("landlord", "tenant"),
      document: { ...contract([]).document!, contentType: "image/jpeg" },
    };
    expect(spotsReady(sobreFoto)).toBe(false);
  });
});

describe("spotProblem", () => {
  const valido = { page: 0, x: 0.1, y: 0.8, width: 0.28, height: 0.06 };

  it("acepta un recuadro dentro de la página", () => {
    expect(spotProblem(valido)).toBeNull();
  });

  it("acepta uno que toca exactamente el borde", () => {
    expect(spotProblem({ ...valido, x: 0.72, width: 0.28 })).toBeNull();
  });

  /*
   * Las coordenadas llegan del navegador, así que aquí es donde se decide qué es una posición y
   * qué es basura. Un recuadro fuera de la página se estamparía en ningún sitio.
   */
  it("rechaza un recuadro que se sale de la página", () => {
    expect(spotProblem({ ...valido, x: 0.9, width: 0.28 })).toMatch(/se sale/);
    expect(spotProblem({ ...valido, y: 0.99, height: 0.06 })).toMatch(/se sale/);
    expect(spotProblem({ ...valido, x: -0.01 })).toMatch(/se sale/);
  });

  it("rechaza un recuadro vacío", () => {
    expect(spotProblem({ ...valido, width: 0 })).toMatch(/vacío/);
    expect(spotProblem({ ...valido, height: -0.1 })).toMatch(/vacío/);
  });

  it("rechaza una página que no es un índice", () => {
    expect(spotProblem({ ...valido, page: -1 })).toMatch(/página/);
    expect(spotProblem({ ...valido, page: 1.5 })).toMatch(/página/);
  });

  it("rechaza NaN e infinito, que es lo que da una división por cero en el visor", () => {
    expect(spotProblem({ ...valido, x: Number.NaN })).toMatch(/posición/);
    expect(spotProblem({ ...valido, height: Number.POSITIVE_INFINITY })).toMatch(/posición/);
  });
});
