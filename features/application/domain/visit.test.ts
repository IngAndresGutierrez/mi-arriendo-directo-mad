import { describe, expect, it } from "vitest";

import {
  visitBlocker,
  visitBlockerMessage,
  visitHasPassed,
  visitState,
  visitTime,
  visitWhen,
  VISIT_OUTCOMES,
  VISIT_STATE_LABELS,
  type Visit,
  type VisitOutcome,
} from "./visit";

const AT = "2026-09-10T20:00:00.000Z"; // 3:00 p. m. en Bogotá

const visit = (over: Partial<Visit> = {}): Visit => ({
  at: AT,
  meetingPoint: "En la portería de la torre 2",
  note: "",
  proposedAt: "2026-09-01T15:00:00.000Z",
  confirmedAt: null,
  declinedAt: null,
  declineNote: "",
  verdict: null,
  ...over,
});

const withVerdict = (result: VisitOutcome, note = "Me gustó mucho la luz."): Visit =>
  visit({ confirmedAt: "2026-09-02T15:00:00.000Z", verdict: { result, note, at: AT } });

describe("visitState", () => {
  it("va de sin agendar a confirmada según lo que haya pasado", () => {
    expect(visitState(null)).toBe("none");
    expect(visitState(visit())).toBe("proposed");
    expect(visitState(visit({ declinedAt: AT, declineNote: "Ese día trabajo" }))).toBe("declined");
    expect(visitState(visit({ confirmedAt: AT }))).toBe("confirmed");
  });

  /*
   * Las dos conclusiones son dos estados y no uno, igual que `withdrawn` y `resolved` en los
   * incidentes: una deja seguir el proceso y la otra lo para, y un solo estado "visitada" obligaría
   * a cada lector a entrar a mirar cuál de las dos fue.
   */
  it("distingue las dos conclusiones en vez de decir solo 'visitada'", () => {
    expect(visitState(withVerdict("interested"))).toBe("interested");
    expect(visitState(withVerdict("not_interested"))).toBe("not_interested");
  });

  /*
   * La conclusión pertenece a la visita que se hizo, así que manda sobre la confirmación: una vez
   * que el inquilino dijo qué le pareció, "Agendada" ya no es lo que hay que contar.
   */
  it("la conclusión manda sobre la confirmación", () => {
    expect(visitState(visit({ confirmedAt: AT, verdict: { result: "interested", note: "", at: AT } }))).toBe(
      "interested",
    );
  });

  it("nombra todos los estados", () => {
    for (const state of Object.values(VISIT_STATE_LABELS)) {
      expect(state).toBeTruthy();
    }
  });
});

describe("visitBlocker", () => {
  it("pide proponer, confirmar y contar qué le pareció, en ese orden", () => {
    expect(visitBlocker(null)).toBe("not_proposed");
    expect(visitBlocker(visit())).toBe("not_confirmed");
    expect(visitBlocker(visit({ declinedAt: AT }))).toBe("not_confirmed");
    expect(visitBlocker(visit({ confirmedAt: AT }))).toBe("no_verdict");
  });

  /*
   * Lo que esta etapa existe para responder: si al inquilino no le interesó, el proceso no sigue.
   * Es la diferencia entre una etapa que filtra y una etapa que solo se registra.
   */
  it("solo deja pasar cuando al inquilino le interesó el inmueble", () => {
    expect(visitBlocker(withVerdict("interested"))).toBeNull();
    expect(visitBlocker(withVerdict("not_interested"))).toBe("not_interested");
  });

  it("le dice a cada parte algo distinto, y nunca le habla al propietario de sí mismo", () => {
    const blockers = ["not_proposed", "not_confirmed", "no_verdict", "not_interested"] as const;
    for (const blocker of blockers) {
      const landlord = visitBlockerMessage(blocker, true);
      const tenant = visitBlockerMessage(blocker, false);
      expect(landlord).toBeTruthy();
      expect(tenant).toBeTruthy();
      expect(landlord).not.toBe(tenant);
      expect(landlord).not.toMatch(/El propietario te/);
    }
    expect(visitBlockerMessage(null, true)).toBeNull();
  });

  /*
   * Un "no me interesa" no cierra el proceso solo: terminarlo es una decisión con nombre, las dos
   * partes ya tienen su botón, y el mensaje es el que dice cuál es. Si esto dejara de nombrarlos,
   * el proceso quedaría clavado sin decir cómo salir.
   */
  it("cuando no le interesó, dice cómo se sale de ahí", () => {
    expect(visitBlockerMessage("not_interested", true)).toMatch(/rechazar|proponer otra/i);
    expect(visitBlockerMessage("not_interested", false)).toMatch(/retirar|cambiaste de opinión/i);
  });
});

describe("visitHasPassed", () => {
  it("es la hora a la que quedaron, no una duración inventada", () => {
    expect(visitHasPassed(visit(), new Date("2026-09-10T19:59:00.000Z"))).toBe(false);
    expect(visitHasPassed(visit(), new Date("2026-09-10T20:00:00.000Z"))).toBe(true);
    expect(visitHasPassed(visit(), new Date("2026-09-11T00:00:00.000Z"))).toBe(true);
  });

  it("una fecha rota no es una visita que ya pasó", () => {
    expect(visitHasPassed(visit({ at: "no-es-una-fecha" }), new Date())).toBe(false);
  });
});

describe("visitWhen", () => {
  /*
   * En hora de Colombia y con el día de la semana: "el 10 de septiembre" es una fecha que hay que
   * ir a mirar, y "jueves" es una que ya se sabe dónde cae. Las 20:00 UTC son las 3 p. m. aquí, y
   * ese es justo el error que este formato existe para no cometer.
   */
  it("dice el día de la semana y la hora de Bogotá", () => {
    const dicho = visitWhen({ at: AT });
    expect(dicho).toContain("jueves");
    expect(dicho).toContain("10 de septiembre");
    expect(dicho).toMatch(/3:00/);
    expect(visitTime(AT)).toMatch(/^3:00 p\. m\.$/);
  });

  /*
   * Y el día se lee en Bogotá, no en UTC: las 2 de la madrugada del 11 en UTC son las 9 de la noche
   * del 10 aquí, que es el error que manda a alguien a una visita el día equivocado.
   */
  it("lee el día en Bogotá, no en UTC", () => {
    expect(visitWhen({ at: "2026-09-11T02:00:00.000Z" })).toContain("10 de septiembre");
  });

  it("una fecha rota no rompe la pantalla", () => {
    expect(visitWhen({ at: "" })).toBe("");
    expect(visitTime("mañana")).toBe("");
  });
});

describe("las dos conclusiones", () => {
  it("son dos y solo dos", () => {
    expect(VISIT_OUTCOMES).toEqual(["interested", "not_interested"]);
  });
});
