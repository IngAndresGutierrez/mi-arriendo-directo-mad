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
  COMPLETED_LABEL,
  STAGES,
  stageDescription,
  STAGE_DESCRIPTIONS,
  STAGE_DESCRIPTIONS_LANDLORD,
  STAGE_LABELS,
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

describe("the seven stages", () => {
  it("are seven, in the agreed order, and end with the first canon", () => {
    expect(STAGES).toHaveLength(7);
    expect(STAGES[0]).toBe("submitted");
    expect(STAGES.at(-1)).toBe("first_payment");
  });

  /*
   * Las dos que salieron, y por qué el test se queda: `approved` no registraba nada que no
   * registrara la firma —decidir firmar *es* aprobar— y `active` no era una etapa sino el
   * arriendo, que tiene su propia página, su propia vida y doce meses en vez de siete pasos.
   */
  it("no tiene ni la aprobación ni el arriendo como pasos", () => {
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
    expect(Object.values(STAGE_LABELS).join(" ").toLowerCase()).not.toContain("depósito");
    expect(STAGES).toContain("guarantee");
  });

  it("names and explains every one of them, to each side", () => {
    for (const stage of STAGES) {
      expect(STAGE_LABELS[stage]).toBeTruthy();
      expect(STAGE_DESCRIPTIONS[stage]).toBeTruthy();
      expect(STAGE_DESCRIPTIONS_LANDLORD[stage]).toBeTruthy();
    }
  });

  /*
   * Both sides read the same screen. One set of words cannot serve them: the sentence that
   * tells the tenant to wait for a call is the sentence that tells the landlord to make it.
   */
  it("does not tell the landlord to wait for the landlord", () => {
    expect(stageDescription("interview", false)).toMatch(/El propietario propondrá/);
    expect(stageDescription("interview", true)).toMatch(/Propón una fecha/);
    for (const stage of STAGES) {
      expect(stageDescription(stage, true)).not.toMatch(/El propietario te/);
    }
  });

  /*
   * Ya no queda ninguna: las siete etapas tienen trabajo en el producto. El test se queda para que
   * añadir una etapa sin interfaz obligue a declararla, en vez de que aparezca vacía sin que nadie
   * lo diga.
   */
  it("no marks any stage as unbuilt: the seven have work in the product now", () => {
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
    expect(nextStage("submitted")).toBe("tenant_data");
    expect(nextStage("tenant_data")).toBe("background_check");
    expect(nextStage("guarantee")).toBe("contract_signature");
    expect(nextStage("first_payment")).toBeNull();
  });

  it("reaches the last stage in exactly six moves", () => {
    let stage: Stage | null = "submitted";
    let moves = 0;
    while (nextStage(stage!) !== null) {
      stage = nextStage(stage!);
      moves += 1;
    }
    expect(stage).toBe("first_payment");
    expect(moves).toBe(6);
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
   * "Paso 7 de 7" es cierto mientras el propietario no ha confirmado el canon, y deja de serlo en
   * cuanto lo confirma: entonces lo que hay que decir es que se acabó. Una insignia que sigue
   * numerando pasos es lo que no distingue un proceso acabado de uno atascado en el último.
   */
  it("terminado no es un paso: es el proceso completado", () => {
    expect(stageProgressLabel(finished)).toBe("Proceso completado");
    expect(stageProgressLabel(finished)).not.toMatch(/Paso/);
  });

  it("counts from one, not from zero", () => {
    expect(stageProgressLabel(at("submitted"))).toBe("Paso 1 de 7");
    expect(stageProgressLabel(at("first_payment"))).toBe("Paso 7 de 7");
  });

  it("fills the bar only when the process is at the last stage", () => {
    expect(stageProgress("submitted")).toBeCloseTo(1 / 7);
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
    expect(processStageLabel(at("interview"))).toBe(STAGE_LABELS.interview);
    expect(processDescription(at("interview"), false)).toBe(STAGE_DESCRIPTIONS.interview);
    expect(processDescription(at("interview"), true)).toBe(STAGE_DESCRIPTIONS_LANDLORD.interview);
  });

  it("y una vez terminado dice el arriendo, no la etapa", () => {
    expect(processStageLabel(finished)).toBe(COMPLETED_LABEL);
    expect(processStageLabel(finished)).not.toBe(STAGE_LABELS.first_payment);
    expect(processDescription(finished, false)).toMatch(/El proceso terminó/);
    expect(processDescription(finished, true)).toMatch(/El proceso terminó/);
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
    expect(closedAtLabel(at("interview"))).toBeNull();
  });

  // "Rejected at the interview" and "rejected on arrival" are different stories.
  it("keeps the stage it stopped at", () => {
    expect(closedAtLabel(at("interview", "rejected"))).toBe(
      'Rechazada en la etapa "Entrevista con el propietario"',
    );
    expect(closedAtLabel(at("submitted", "withdrawn"))).toBe(
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
