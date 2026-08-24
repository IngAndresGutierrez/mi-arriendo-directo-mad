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
  strokeRequired,
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

const spot = (party: ContractParty): SignatureSpot => ({
  party,
  page: 0,
  x: 0.1,
  y: 0.8,
  width: 0.28,
  height: 0.06,
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

/**
 * Un contrato con los dos recuadros marcados, que es el estado desde el que se puede firmar.
 *
 * Existe porque el dibujo de la firma pasó a ser obligatorio para las dos partes: sin recuadros no
 * hay dónde estamparlo, así que `contractBlocker` responde `no_spots` y las aserciones sobre "a
 * quién le falta firmar" tienen que partir de un contrato que ya se puede firmar.
 */
const marcado = (
  signatures: readonly ContractSignature[],
  sha256 = HASH,
): Contract => ({ ...contract(signatures, sha256), spots: [spot("landlord"), spot("tenant")] });

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
    const firmado = marcado([signature("landlord"), signature("tenant")]);
    expect(contractState(firmado)).toBe("signed");

    // El propietario sube otro archivo: mismo registro, hash nuevo.
    const conOtroArchivo: Contract = {
      ...firmado,
      spots: [spot("landlord"), spot("tenant")],
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

  /*
   * Lo primero que falta es dónde se firma, no quién firma: con el dibujo obligatorio para las dos
   * partes, un PDF sin recuadros no se puede firmar, y decirle "falta tu firma" a quien no tiene
   * dónde dibujarla es señalar la puerta equivocada.
   */
  it("bloquea antes por los recuadros, que es lo que falta primero", () => {
    expect(contractBlocker(contract([]))).toBe("no_spots");
    expect(contractBlocker({ ...contract([]), spots: [spot("landlord")] })).toBe("no_spots");
  });

  /* Sobre una foto no hay nada que marcar, así que ahí los recuadros no bloquean nada. */
  it("no pide recuadros sobre un documento que no se puede estampar", () => {
    const conFoto: Contract = {
      ...contract([]),
      document: { ...contract([]).document!, contentType: "image/jpeg" },
    };
    expect(contractBlocker(conFoto)).toBe("awaiting_both");
  });

  it("nombra a quién falta", () => {
    expect(contractBlocker(marcado([]))).toBe("awaiting_both");
    expect(contractBlocker(marcado([signature("landlord")]))).toBe("awaiting_tenant");
    expect(contractBlocker(marcado([signature("tenant")]))).toBe("awaiting_landlord");
  });

  it("deja pasar solo con las dos firmas", () => {
    expect(contractBlocker(marcado([signature("landlord"), signature("tenant")]))).toBeNull();
  });

  /*
   * Y un contrato que se firmó cuando el dibujo era opcional sigue firmado: las dos firmas se
   * comprueban antes que los recuadros justamente para no reabrir una etapa cerrada.
   */
  it("un contrato ya firmado sin recuadros sigue pasando", () => {
    expect(contractBlocker(contract([signature("landlord"), signature("tenant")]))).toBeNull();
  });

  it("cada lado lee el bloqueo de los recuadros como lo que le toca", () => {
    expect(contractBlockerMessage("no_spots", true)).toMatch(/Marca en el PDF/);
    expect(contractBlockerMessage("no_spots", false)).toMatch(/El propietario/);
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

  /*
   * La v1 decía "en mi correo o WhatsApp **verificado**", y este producto verifica el correo al
   * registrarse pero **nunca ha verificado un teléfono**: se escribe en el formulario del perfil y
   * se guarda. La cláusula es el texto en el que se apoya la presunción del Decreto 2364, así que
   * afirmar una garantía que no existe es peor que una frase modesta que sí se sostiene.
   *
   * Esto se rompe el día que alguien vuelva a escribir "verificado" junto al teléfono — y el día que
   * se verifique de verdad con Firebase Phone Auth, este test es el recordatorio de actualizarlo.
   */
  it("no afirma que el teléfono esté verificado, porque no lo está", () => {
    expect(SIGNATURE_CLAUSE).not.toMatch(/WhatsApp verificado/i);
    expect(SIGNATURE_CLAUSE).not.toMatch(/tel[ée]fono verificado/i);
    expect(SIGNATURE_CLAUSE).not.toMatch(/n[úu]mero verificado/i);
    // Y sí dice de dónde sale el canal: de lo que la persona registró.
    expect(SIGNATURE_CLAUSE).toMatch(/registr/i);
  });

  it("subió de versión al corregirse, para no aplicar hacia atrás", () => {
    expect(SIGNATURE_CLAUSE_VERSION).toBeGreaterThanOrEqual(2);
  });
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

/*
 * El dibujo es obligatorio para las **dos** partes, que es lo que cambió: antes era un añadido
 * opcional porque un lienzo no se opera con el teclado. Ese coste se paga en el lienzo —que ofrece
 * firmar con el nombre— y no bajando la exigencia.
 */
describe("strokeRequired", () => {
  const conPuntos = (...partes: ContractParty[]): Contract => ({
    ...contract([]),
    spots: partes.map(spot),
  });

  it("se lo exige a las dos partes, no solo al propietario", () => {
    const listo = conPuntos("landlord", "tenant");
    expect(strokeRequired(listo, "landlord")).toBe(true);
    expect(strokeRequired(listo, "tenant")).toBe(true);
  });

  /* Solo se exige donde se puede estampar: pedir un dibujo que nada lee es pedir un archivo. */
  it("no se le exige a la parte que no tiene recuadro", () => {
    const soloDueño = conPuntos("landlord");
    expect(strokeRequired(soloDueño, "landlord")).toBe(true);
    expect(strokeRequired(soloDueño, "tenant")).toBe(false);
  });

  it("no se exige sobre un documento que no se puede estampar", () => {
    const sobreFoto: Contract = {
      ...conPuntos("landlord", "tenant"),
      document: { ...contract([]).document!, contentType: "image/jpeg" },
    };
    expect(strokeRequired(sobreFoto, "landlord")).toBe(false);
    expect(strokeRequired(sobreFoto, "tenant")).toBe(false);
  });

  it("ni sin contrato, ni sobre la forma vieja sin recuadros", () => {
    expect(strokeRequired(null, "tenant")).toBe(false);
    expect(strokeRequired(contract([]), "tenant")).toBe(false);
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

/*
 * El fallo real: un contrato guardado antes de que existieran `spots`, `signatures` o `stamped`
 * llega sin esos campos, y `contract?.spots.find(...)` protegía `contract` y no `spots`. Reventaba
 * al renderizar la etapa con `Cannot read properties of undefined (reading 'find')`.
 *
 * El converter los normaliza, pero estas son funciones puras que cualquiera puede llamar con un
 * objeto armado a mano, así que aquí se fija que sobreviven la forma vieja.
 */
describe("un contrato guardado antes de los campos nuevos", () => {
  // Deliberadamente incompleto: es la forma que hay en la base.
  const viejo = {
    document: {
      path: "contracts/abc/contrato.pdf",
      fileName: "contrato.pdf",
      contentType: "application/pdf",
      bytes: 1000,
      sha256: HASH,
      uploadedAt: "2026-09-01T10:00:00.000Z",
    },
    note: "",
  } as unknown as Contract;

  it("no revienta al buscar el recuadro de una parte", () => {
    expect(() => spotFor(viejo, "landlord")).not.toThrow();
    expect(spotFor(viejo, "landlord")).toBeNull();
  });

  it("no revienta al contar las firmas válidas", () => {
    expect(() => validSignatures(viejo)).not.toThrow();
    expect(validSignatures(viejo)).toHaveLength(0);
  });

  /*
   * `awaiting_both` hasta que el dibujo pasó a ser obligatorio: ahora lo primero que le falta a un
   * contrato sin recuadros son los recuadros, y eso es lo que hay que decirle a quien lo abra.
   */
  it("y el resto del dominio lo lee como lo que es: sin firmar", () => {
    expect(contractState(viejo)).toBe("awaiting_signatures");
    expect(contractBlocker(viejo)).toBe("no_spots");
    expect(spotsReady(viejo)).toBe(false);
    expect(replacingVoids(viejo)).toBe(0);
  });
});
