import { describe, expect, it } from "vitest";

import { declineVisitSchema, proposeVisitSchema, visitVerdictSchema } from "./visit";

const proposal = {
  day: "2026-09-10",
  time: "15:00",
  meetingPoint: "En la portería de la torre 2, Cra 23 #14-08",
  note: "",
};

describe("proposeVisitSchema", () => {
  it("acepta una propuesta con día, hora y punto de encuentro", () => {
    const parsed = proposeVisitSchema.safeParse(proposal);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.note).toBe("");
  });

  it("rechaza fechas y horas que no lo son", () => {
    expect(proposeVisitSchema.safeParse({ ...proposal, day: "10/09/2026" }).success).toBe(false);
    expect(proposeVisitSchema.safeParse({ ...proposal, time: "25:00" }).success).toBe(false);
    expect(proposeVisitSchema.safeParse({ ...proposal, time: "3 p. m." }).success).toBe(false);
  });

  /*
   * Una visita es alguien cruzando una ciudad. "El jueves a las 3" sin dirección es una cita que
   * nadie puede cumplir, así que este campo es el único que esta etapa no se puede saltar.
   */
  it("no deja proponer una visita sin decir dónde", () => {
    expect(proposeVisitSchema.safeParse({ ...proposal, meetingPoint: "" }).success).toBe(false);
    expect(proposeVisitSchema.safeParse({ ...proposal, meetingPoint: "allá" }).success).toBe(false);
    expect(proposeVisitSchema.safeParse({ day: proposal.day, time: proposal.time }).success).toBe(
      false,
    );
  });

  it("recorta los espacios y limita la longitud", () => {
    const parsed = proposeVisitSchema.safeParse({
      ...proposal,
      meetingPoint: "  Cra 23 #14-08, portería  ",
    });
    expect(parsed.data?.meetingPoint).toBe("Cra 23 #14-08, portería");
    expect(proposeVisitSchema.safeParse({ ...proposal, meetingPoint: "x".repeat(301) }).success).toBe(
      false,
    );
    expect(proposeVisitSchema.safeParse({ ...proposal, note: "x".repeat(301) }).success).toBe(false);
  });
});

describe("visitVerdictSchema", () => {
  it("acepta las dos conclusiones y rechaza cualquier otra", () => {
    expect(visitVerdictSchema.safeParse({ result: "interested" }).success).toBe(true);
    expect(visitVerdictSchema.safeParse({ result: "not_interested" }).success).toBe(true);
    expect(visitVerdictSchema.safeParse({ result: "quizá" }).success).toBe(false);
    expect(visitVerdictSchema.safeParse({}).success).toBe(false);
  });

  /*
   * La nota es opcional aquí y obligatoria en la entrevista, y la asimetría es a propósito: exigir
   * un texto antes de poder decir "no me interesa" es poner un peaje justo a la respuesta que esta
   * etapa existe para recoger.
   */
  it("deja decir que no sin obligar a explicarse", () => {
    const parsed = visitVerdictSchema.safeParse({ result: "not_interested" });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.note).toBe("");
  });

  it("pero se queda con la razón cuando la escriben", () => {
    const parsed = visitVerdictSchema.safeParse({
      result: "not_interested",
      note: "  Da a la avenida y se oye mucho.  ",
    });
    expect(parsed.data?.note).toBe("Da a la avenida y se oye mucho.");
    expect(visitVerdictSchema.safeParse({ result: "interested", note: "x".repeat(601) }).success).toBe(
      false,
    );
  });
});

describe("declineVisitSchema", () => {
  it("deja pedir otro día con o sin explicación", () => {
    expect(declineVisitSchema.safeParse({}).data?.note).toBe("");
    expect(declineVisitSchema.safeParse({ note: "Ese día trabajo" }).data?.note).toBe(
      "Ese día trabajo",
    );
    expect(declineVisitSchema.safeParse({ note: "x".repeat(301) }).success).toBe(false);
  });
});
