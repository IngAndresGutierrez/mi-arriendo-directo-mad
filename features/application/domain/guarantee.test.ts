import { describe, expect, it } from "vitest";

import { dictionaryFor } from "@/shared/i18n/dictionary";

import {
  canWaiveGuarantee,
  guaranteeBlocker,
  guaranteeBlockerMessage,
  guaranteeState,
  GUARANTEE_MAX_MONTHS,
  GUARANTEE_PLAN,
  GUARANTEE_PROVIDER,
  GUARANTEE_STATES,
  isProviderLink,
  type Guarantee,
} from "./guarantee";

const REQUESTED: Guarantee = {
  requestedAt: "2026-09-01T15:00:00.000Z",
  waivedAt: null,
  activeAt: null,
  policyNumber: "",
  tenantLink: "",
  note: "",
};

const ACTIVE: Guarantee = {
  ...REQUESTED,
  activeAt: "2026-09-03T10:00:00.000Z",
  policyNumber: "AR-99123",
};

/** El propietario dijo que este arriendo va sin seguro. */
const WAIVED: Guarantee = { ...REQUESTED, waivedAt: "2026-09-02T09:00:00.000Z" };

/** Spanish for the assertions that are about wording; English where the rule must hold in both. */
const ES = dictionaryFor("es").guarantee;

describe("guaranteeState", () => {
  it("is `none` with nothing recorded", () => {
    expect(guaranteeState(null)).toBe("none");
  });

  it("is `requested` once the landlord applied", () => {
    expect(guaranteeState(REQUESTED)).toBe("requested");
  });

  it("is `active` only with a policy number: a date alone proves nothing", () => {
    expect(
      guaranteeState({ ...REQUESTED, activeAt: "2026-09-03T10:00:00.000Z", policyNumber: "" }),
    ).toBe("requested");
    expect(
      guaranteeState({ ...REQUESTED, activeAt: "2026-09-03T10:00:00.000Z", policyNumber: "AR-99123" }),
    ).toBe("active");
  });
});

describe("guaranteeBlocker", () => {
  it("blocks with nothing requested", () => {
    expect(guaranteeBlocker(null)).toBe("not_requested");
  });

  it('blocks on "ya la solicité": a wait is not a guarantee', () => {
    expect(guaranteeBlocker(REQUESTED)).toBe("not_issued");
  });

  it("lets an issued policy through", () => {
    const active: Guarantee = {
      ...REQUESTED,
      activeAt: "2026-09-03T10:00:00.000Z",
      policyNumber: "AR-99123",
    };
    expect(guaranteeBlocker(active)).toBeNull();
    expect(guaranteeBlockerMessage(null, true, ES)).toBeNull();
  });

  it("says why, differently to each side", () => {
    expect(guaranteeBlockerMessage("not_requested", true, ES)).toContain("Sura");
    expect(guaranteeBlockerMessage("not_requested", false, ES)).toContain("todavía no");
    expect(guaranteeBlockerMessage("not_issued", false, ES)).toContain("en estudio");
  });
});

describe("what the product promises", () => {
  it("points at Sura's own quoting page, over https", () => {
    expect(GUARANTEE_PROVIDER.quoteUrl).toBe(
      "https://ecomm.sura.co/seguros/hogar/arriendo/cotizador",
    );
  });

  it("names the three coverages and never promises a deposit", () => {
    const es = Object.values(ES.coverages);
    expect(es).toHaveLength(3);
    const todo = es.join(" ").toLowerCase();
    expect(todo).toContain("arriendo");
    expect(todo).toContain("administración");
    expect(todo).toContain("asistencia");
    expect(todo).not.toContain("depósito");

    /*
     * And the English set, where the word to keep out is "deposit": a coverage list that promised one
     * would be just as illegal under Ley 820 for being written in English.
     */
    const en = Object.values(dictionaryFor("en").guarantee.coverages);
    expect(en).toHaveLength(3);
    expect(en.join(" ").toLowerCase()).not.toContain("deposit");
  });

  it("keeps the twelve-month ceiling in the sentence, not only in a constant", () => {
    expect(GUARANTEE_MAX_MONTHS).toBe(12);
    /*
     * The ceiling is composed from the two halves and the constant, so the sentence cannot drift
     * from the number: that is the whole point of not writing "12" into the prose.
     */
    const nota = `${ES.limitNoteBefore} ${GUARANTEE_MAX_MONTHS} ${ES.limitNoteAfter}`;
    expect(nota).toContain("12 meses");
    expect(nota).toContain("vigente");
  });
});

describe("isProviderLink", () => {
  const LINK =
    "https://ecomm.sura.co/seguros/hogar/arriendo/inquilino/resumen-proceso?quoteId=E0SGqCQ%2Bmoew";

  it("accepts the link Sura's quoter produces", () => {
    expect(isProviderLink(LINK)).toBe(true);
  });

  it("accepts the bare domain and any subdomain of it", () => {
    expect(isProviderLink("https://sura.co/algo")).toBe(true);
    expect(isProviderLink("https://otro.sura.co/algo")).toBe(true);
  });

  it("tolerates the whitespace that comes with a paste", () => {
    expect(isProviderLink(`  ${LINK}  `)).toBe(true);
  });

  /*
   * The one that matters: this is the check standing between a tenant and whatever a landlord
   * pasted. A hostname that merely *contains* the domain is not the domain.
   */
  it("rejects a host that only looks like Sura's", () => {
    expect(isProviderLink("https://sura.co.example.com/phishing")).toBe(false);
    expect(isProviderLink("https://notsura.co/phishing")).toBe(false);
    expect(isProviderLink("https://example.com/?x=sura.co")).toBe(false);
  });

  it("rejects anything that is not https", () => {
    expect(isProviderLink("http://ecomm.sura.co/algo")).toBe(false);
    expect(isProviderLink("javascript:alert(1)")).toBe(false);
    expect(isProviderLink("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects what is not a URL at all", () => {
    expect(isProviderLink("")).toBe(false);
    expect(isProviderLink("ecomm.sura.co/sin-esquema")).toBe(false);
  });
});

describe("GUARANTEE_PLAN", () => {
  it("names the tier the panel tells the landlord to pick", () => {
    expect(GUARANTEE_PLAN).toBe("Plus");
  });
});

// ---------------------------------------------------------------------------
// el seguro es opcional
// ---------------------------------------------------------------------------

describe("waiving the policy", () => {
  it("is a state of its own, with an empty guarantee still reading `none`", () => {
    expect(guaranteeState(WAIVED)).toBe("waived");
    expect(guaranteeState(null)).toBe("none");
    // Un `waivedAt` es lo único que hace falta: no depende de haberla solicitado antes.
    expect(guaranteeState({ ...WAIVED, requestedAt: null })).toBe("waived");
  });

  /*
   * **Una póliza expedida gana a cualquier renuncia anterior.** Es la línea que impide que un
   * `waivedAt` viejo esconda un seguro del que ya se avisó al inquilino, y el orden de las cuatro
   * comprobaciones de `guaranteeState` es toda la regla: invertir las dos primeras hace pasar este
   * caso a "waived" y el arriendo aparecería sin garantía teniendo una.
   */
  it("never outranks a policy that exists", () => {
    expect(guaranteeState({ ...ACTIVE, waivedAt: "2026-09-02T09:00:00.000Z" })).toBe("active");
  });

  /** Pero sí gana a una solicitud: pedirla y luego decidir que no es una secuencia normal. */
  it("outranks a request that was never issued", () => {
    expect(guaranteeState({ ...REQUESTED, waivedAt: "2026-09-02T09:00:00.000Z" })).toBe("waived");
  });

  /*
   * Lo que la función existe para permitir: que la etapa deje de bloquear. Sin esto el propietario
   * que arrienda a un familiar no tenía forma de pasar de aquí más que comprar un seguro que no
   * quería.
   */
  it("stops blocking the stage", () => {
    expect(guaranteeBlocker(WAIVED)).toBeNull();
    expect(guaranteeBlocker(null)).toBe("not_requested");
    expect(guaranteeBlocker(REQUESTED)).toBe("not_issued");
  });

  it("blocks on the unanswered question and never on the answer", () => {
    // Los dos estados que son decisiones dejan pasar; los dos que son preguntas sin responder, no.
    const blocking = GUARANTEE_STATES.filter((state) =>
      Boolean(
        guaranteeBlocker(
          state === "waived"
            ? WAIVED
            : state === "active"
              ? ACTIVE
              : state === "requested"
                ? REQUESTED
                : null,
        ),
      ),
    );
    expect(blocking).toEqual(["none", "requested"]);
  });

  it("can be turned off until a policy exists, and not after", () => {
    expect(canWaiveGuarantee(null)).toBe(true);
    expect(canWaiveGuarantee(REQUESTED)).toBe(true);
    expect(canWaiveGuarantee(WAIVED)).toBe(true);
    expect(canWaiveGuarantee(ACTIVE)).toBe(false);
  });

  /** Y la frase que ofrece la salida está en el mensaje del bloqueo, o nadie la encuentra. */
  it("is offered in the message that says why the stage is stuck", () => {
    expect(guaranteeBlockerMessage("not_requested", true, ES)).toMatch(/sin p[óo]liza/i);
    // Al inquilino no se le ofrece: la decisión no es suya.
    expect(guaranteeBlockerMessage("not_requested", false, ES)).not.toMatch(/marca/i);
  });
});
