import { dictionaryFor } from "@/shared/i18n/dictionary";
import { describe, expect, it } from "vitest";

import {
  applicationBlocker,
  canAdvance,
  canClose,
  closedAtLabel,
  isCompleted,
  isUnbuilt,
  nextStage,
  normalizeStage,
  processDescription,
  processStageLabel,
  stageProgress,
  applicationCode,
  stageProgressLabel,
  stageState,
  STAGES,
  stageDescription,
  type Application,
  type Stage,
  UNBUILT_STAGES,
} from "./application";

const at = (
  stage: Stage,
  status: Application["status"] = "open",
  completedAt: string | null = null,
) => ({ stage, status, completedAt });

/** El proceso terminado: la última etapa, y la marca que escribe el canon confirmado. */
const finished = at("first_payment", "open", "2026-10-01T15:00:00.000Z");

/**
 * The words are the dictionary's now, so the tests take a copy handle.
 *
 * **Spanish for the assertions that are about wording** — "does not tell the landlord to wait for
 * the landlord" only means anything against real sentences — and English wherever the assertion is
 * about the *mechanism* rather than the words, which is what makes the two-voice rule provable in
 * both languages rather than in one.
 */
const ES = dictionaryFor("es").application;
const EN = dictionaryFor("en").application;

describe("the eight stages", () => {
  it("are eight, in the agreed order, and end with the first canon", () => {
    expect(STAGES).toHaveLength(8);
    expect(STAGES[0]).toBe("submitted");
    expect(STAGES.at(-1)).toBe("first_payment");
  });

  /*
   * La visita va segunda, y la posición *es* el argumento: a nadie se le pide la cédula, el soporte
   * de ingresos ni permiso para consultar sus antecedentes por un inmueble que no ha visto. Si
   * alguna vez se mueve detrás de los documentos, este test es donde se para.
   */
  it("manda a ver el inmueble antes de pedir un solo dato", () => {
    expect(STAGES[1]).toBe("visit");
    expect(STAGES.indexOf("visit")).toBeLessThan(STAGES.indexOf("tenant_data"));
    expect(STAGES.indexOf("visit")).toBeLessThan(STAGES.indexOf("background_check"));
  });

  /*
   * Las dos que salieron, y por qué el test se queda: `approved` no registraba nada que no
   * registrara la firma —decidir firmar *es* aprobar— y `active` no era una etapa sino el
   * arriendo, que tiene su propia página, su propia vida y doce meses en vez de siete pasos.
   */
  it("no tiene ni la aprobacion ni el arriendo como pasos", () => {
    expect(STAGES).not.toContain("approved");
    expect(STAGES).not.toContain("active");
  });

  /*
   * Checking records comes right after the documents that make it possible: the identity
   * document is what the search is run against, so asking before it exists asks for nothing.
   */
  it("checks records only once the documents are in", () => {
    expect(STAGES.indexOf("background_check")).toBe(STAGES.indexOf("tenant_data") + 1);
    expect(STAGES.indexOf("background_check")).toBeLessThan(STAGES.indexOf("contract_signature"));
  });

  /*
   * Reviewing the documents *is* stage two, where each is approved or rejected. A stage that
   * repeats what the previous one settled is a stage everybody clicks through without reading.
   */
  it("has no separate document review stage", () => {
    expect(STAGES).not.toContain("document_review");
  });

  /*
   * Ley 820 de 2003 forbids cash deposits on urban housing leases in Colombia. The reference
   * design this was adapted from has one; if it ever comes back, this test is where it stops.
   */
  it("has no deposit stage, and does have the guarantee that replaces it", () => {
    expect(STAGES).not.toContain("deposit");
    /*
     * Both languages: the word to keep out is "depósito", and its English counterpart is "deposit" —
     * a stage called that would be just as illegal under Ley 820 for being in English.
     */
    expect(Object.values(ES.stageLabels).join(" ").toLowerCase()).not.toContain("depósito");
    expect(Object.values(EN.stageLabels).join(" ").toLowerCase()).not.toContain("deposit");
    expect(STAGES).toContain("guarantee");
  });

  it("names and explains every one of them, to each side", () => {
    for (const stage of STAGES) {
      for (const copy of [ES, EN]) {
        expect(copy.stageLabels[stage]).toBeTruthy();
        expect(copy.stageDescriptions[stage]).toBeTruthy();
        expect(copy.stageDescriptionsLandlord[stage]).toBeTruthy();
      }
    }
  });

  /*
   * Both sides read the same screen. One set of words cannot serve them: the sentence that
   * tells the tenant to wait for a call is the sentence that tells the landlord to make it.
   */
  it("does not tell the landlord to wait for the landlord", () => {
    expect(stageDescription("interview", false, ES)).toMatch(/El propietario propondrá/);
    expect(stageDescription("interview", true, ES)).toMatch(/Propón una fecha/);
    for (const stage of STAGES) {
      expect(stageDescription(stage, true, ES)).not.toMatch(/El propietario te/);
    }

    /*
     * And the same rule in English, which is the half a single-language test could not state: the
     * landlord is never told to wait for the landlord, whichever words are being used.
     */
    expect(stageDescription("interview", false, EN)).toMatch(/The landlord will propose/);
    expect(stageDescription("interview", true, EN)).toMatch(/Propose a time/);
    for (const stage of STAGES) {
      expect(stageDescription(stage, true, EN)).not.toMatch(/The landlord will/);
    }
  });

  /*
   * Ya no queda ninguna: las ocho etapas tienen trabajo en el producto. El test se queda para que
   * añadir una etapa sin interfaz obligue a declararla, en vez de que aparezca vacía sin que nadie
   * lo diga.
   */
  it("no marks any stage as unbuilt: the eight have work in the product now", () => {
    for (const stage of STAGES) {
      expect(isUnbuilt(stage)).toBe(false);
    }
    expect(UNBUILT_STAGES).toHaveLength(0);
  });
});

/*
 * Las etapas que se fueron siguen escritas en documentos que están en la base de datos, y en
 * notificaciones ya enviadas. Una etapa que el código no conoce cae en `stageIndex() === -1`, que
 * se lee como "antes del primer paso" en todas las comparaciones — así que se traducen a lo que
 * son hoy en vez de dejarlas caer.
 */
describe("normalizeStage", () => {
  it("traduce las dos etapas que se fueron a lo que hoy significan", () => {
    expect(normalizeStage("approved")).toBe("contract_signature");
    expect(normalizeStage("active")).toBe("first_payment");
  });

  it("deja pasar las que existen", () => {
    for (const stage of STAGES) {
      expect(normalizeStage(stage)).toBe(stage);
    }
  });

  it("nunca devuelve algo que no sea una etapa", () => {
    expect(normalizeStage("lo_que_sea")).toBe("submitted");
    expect(normalizeStage(undefined)).toBe("submitted");
    expect(normalizeStage(null)).toBe("submitted");
    expect(normalizeStage(7)).toBe("submitted");
  });
});

describe("nextStage", () => {
  it("walks the list and stops at the end", () => {
    expect(nextStage("submitted")).toBe("visit");
    expect(nextStage("visit")).toBe("tenant_data");
    expect(nextStage("tenant_data")).toBe("background_check");
    expect(nextStage("guarantee")).toBe("contract_signature");
    expect(nextStage("first_payment")).toBeNull();
  });

  it("reaches the last stage in exactly seven moves", () => {
    let stage: Stage | null = "submitted";
    let moves = 0;
    while (nextStage(stage!) !== null) {
      stage = nextStage(stage!);
      moves += 1;
    }
    expect(stage).toBe("first_payment");
    expect(moves).toBe(7);
  });
});

describe("isCompleted", () => {
  /*
   * Un instante, no un booleano: *cuándo* terminó es parte del registro que leen las dos partes, y
   * una bandera responde "no" igual el día que se acabó que estando en la etapa tres.
   */
  it("lo decide la marca de tiempo, no la etapa", () => {
    expect(isCompleted(finished)).toBe(true);
    expect(isCompleted(at("first_payment"))).toBe(false);
    expect(isCompleted(at("submitted"))).toBe(false);
  });
});

describe("stageState", () => {
  it("sorts the list into done, current and pending", () => {
    expect(stageState("submitted", "interview")).toBe("done");
    expect(stageState("interview", "interview")).toBe("current");
    expect(stageState("contract_signature", "interview")).toBe("pending");
  });

  /*
   * La última **no** se lee terminada por estar al final de la fila, que es como se leía cuando la
   * última era `active` y no pedía nada. `first_payment` pide el dinero: llegar a ella es tener todo
   * su trabajo por delante, y darla por hecha ahí sería decir que el proceso acabó el día que
   * empezó su último paso. Lo decide la confirmación del canon, que es la que abre el arriendo.
   */
  it("la última etapa está en curso hasta que el proceso termina", () => {
    expect(stageState("first_payment", "first_payment")).toBe("current");
    expect(stageState("first_payment", "first_payment", true)).toBe("done");
  });

  /* Y ninguna otra cambia por que el proceso haya terminado: las de antes ya estaban hechas. */
  it("y las anteriores siguen hechas, terminado o no", () => {
    expect(stageState("guarantee", "first_payment")).toBe("done");
    expect(stageState("guarantee", "first_payment", true)).toBe("done");
  });
});

describe("progress", () => {
  /*
   * "Paso 8 de 8" es cierto mientras el propietario no ha confirmado el canon, y deja de serlo en
   * cuanto lo confirma: entonces lo que hay que decir es que se acabó. Una insignia que sigue
   * numerando pasos es lo que no distingue un proceso acabado de uno atascado en el último.
   */
  it("terminado no es un paso: es el proceso completado", () => {
    expect(stageProgressLabel(finished, ES)).toBe("Proceso completado");
    expect(stageProgressLabel(finished, ES)).not.toMatch(/Paso/);
  });

  it("counts from one, not from zero", () => {
    expect(stageProgressLabel(at("submitted"), ES)).toBe("Paso 1 de 8");
    expect(stageProgressLabel(at("visit"), ES)).toBe("Paso 2 de 8");
    expect(stageProgressLabel(at("first_payment"), ES)).toBe("Paso 8 de 8");
  });

  it("fills the bar only when the process is at the last stage", () => {
    expect(stageProgress("submitted")).toBeCloseTo(1 / 8);
    expect(stageProgress("first_payment")).toBe(1);
  });
});

/*
 * Un proceso terminado no es "Primer canon": dejó de pedir nada, y el nombre de la última etapa a
 * su lado se lee como un paso pendiente. Una sola función lo decide, así que la tarjeta de inicio y
 * la de la lista no pueden acabar diciendo cosas distintas.
 */
describe("processStageLabel / processDescription", () => {
  it("nombra la etapa mientras el proceso corre", () => {
    expect(processStageLabel(at("interview"), ES)).toBe(ES.stageLabels.interview);
    expect(processDescription(at("interview"), false, ES)).toBe(ES.stageDescriptions.interview);
    expect(processDescription(at("interview"), true, ES)).toBe(ES.stageDescriptionsLandlord.interview);
  });

  it("y una vez terminado dice el arriendo, no la etapa", () => {
    expect(processStageLabel(finished, ES)).toBe(ES.completedLabel);
    expect(processStageLabel(finished, ES)).not.toBe(ES.stageLabels.first_payment);
    expect(processDescription(finished, false, ES)).toMatch(/El proceso terminó/);
    expect(processDescription(finished, true, ES)).toMatch(/El proceso terminó/);
  });
});

describe("applicationCode", () => {
  it("takes six characters, upper case, so it can be read out loud", () => {
    expect(applicationCode("i4rwXIRttilMjbYca60i")).toBe("I4RWXI");
  });

  it("does not pad a shorter id", () => {
    expect(applicationCode("abc")).toBe("ABC");
  });
});

describe("canAdvance / canClose", () => {
  it("advances only an open process that has somewhere to go", () => {
    expect(canAdvance(at("submitted"))).toBe(true);
    // No hay octava etapa: lo que termina el proceso es confirmar el canon, no un botón.
    expect(canAdvance(at("first_payment"))).toBe(false);
    expect(canAdvance(at("interview", "rejected"))).toBe(false);
    expect(canAdvance(at("interview", "withdrawn"))).toBe(false);
  });

  // Stopping a rental that is already running is a termination, which is another feature.
  it("stops an open process at any stage until the tenancy starts", () => {
    expect(canClose(at("submitted"))).toBe(true);
    expect(canClose(at("first_payment"))).toBe(true);
    expect(canClose(finished)).toBe(false);
    expect(canClose(at("interview", "rejected"))).toBe(false);
  });
});

describe("closedAtLabel", () => {
  it("says nothing while the process is open", () => {
    expect(closedAtLabel(at("interview"), ES)).toBeNull();
  });

  // "Rejected at the interview" and "rejected on arrival" are different stories.
  it("keeps the stage it stopped at", () => {
    expect(closedAtLabel(at("interview", "rejected"), ES)).toBe(
      'Rechazada en la etapa "Entrevista con el propietario"',
    );
    expect(closedAtLabel(at("submitted", "withdrawn"), ES)).toBe(
      'Retirada en la etapa "Postulación recibida"',
    );
  });
});

describe("applicationBlocker", () => {
  const listing = { landlordUid: "landlord", status: "available" };

  it("lets a stranger apply to an available listing", () => {
    expect(applicationBlocker(listing, "tenant", null)).toBeNull();
  });

  it("does not let a landlord apply to their own listing", () => {
    expect(applicationBlocker(listing, "landlord", null)).toBe("own_property");
  });

  it("refuses a listing that is not published", () => {
    expect(applicationBlocker({ ...listing, status: "rented" }, "tenant", null)).toBe("not_available");
    expect(applicationBlocker({ ...listing, status: "draft" }, "tenant", null)).toBe("not_available");
  });

  // A second live application would split the conversation in two.
  it("refuses a second application while one is open", () => {
    expect(applicationBlocker(listing, "tenant", { status: "open" })).toBe("already_applied");
  });

  /*
   * A rejection is final: the landlord looked at this person and said no. Offering the form
   * again offers the same answer with extra steps — and the first version did worse, offering
   * the button and refusing on submit.
   */
  it("refuses again after a rejection", () => {
    expect(applicationBlocker(listing, "tenant", { status: "rejected" })).toBe("rejected_before");
  });

  /*
   * A withdrawal is not. The tenant stopped it themselves, and locking them out for changing
   * their mind would be punishing them for using the button we gave them.
   */
  it("lets someone who withdrew apply again", () => {
    expect(applicationBlocker(listing, "tenant", { status: "withdrawn" })).toBeNull();
  });

  // Order matters: their own property is the answer even if everything else is also wrong.
  it("reports the owner first when several things are wrong", () => {
    expect(applicationBlocker({ ...listing, status: "rented" }, "landlord", { status: "open" })).toBe(
      "own_property",
    );
  });
});
