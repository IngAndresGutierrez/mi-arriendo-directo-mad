import { describe, expect, it } from "vitest";

import {
  errandMessage,
  reminderDue,
  reminderMessage,
  ERRAND_REMINDER_MINUTES,
  errandState,
  availableActions,
  isClosed,
  isOverdue,
  sortForCollaborator,
  ERRAND_STATE_LABELS,
  ERRAND_STATES,
  ERRAND_TYPE_LABELS,
  ERRAND_TYPES,
  type Errand,
} from "./errand";

const NOW = new Date("2026-08-25T15:00:00.000Z");

function errand(overrides: Partial<Errand> & { id: string }): Errand {
  return {
    landlordUid: "landlord",
    collaboratorUid: "collab",
    collaboratorName: "Ana Restrepo",
    collaboratorPhone: "+573001234567",
    propertyId: "prop",
    propertyTitle: "Apartamento en Palermo",
    propertyArea: "Palermo, Manizales",
    type: "showing",
    title: "Mostrar el apartamento",
    description: "El interesado llega a las 3.",
    dueAt: "2026-08-26T20:00:00.000Z",
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("errandState", () => {
  it("starts as assigned", () => {
    expect(errandState({})).toBe("assigned");
  });

  it("reads each mark", () => {
    expect(errandState({ acceptedAt: "x" })).toBe("accepted");
    expect(errandState({ declinedAt: "x" })).toBe("declined");
    expect(errandState({ completedAt: "x" })).toBe("done");
    expect(errandState({ cancelledAt: "x" })).toBe("cancelled");
  });

  it("lets a cancellation outrank everything else", () => {
    // A landlord calling it off ends it whatever else was recorded. Reordering these checks is what
    // makes the screen claim something different from what happened.
    expect(errandState({ acceptedAt: "x", completedAt: "x", cancelledAt: "x" })).toBe("cancelled");
  });

  it("lets done outrank accepted, because finishing implies having taken it", () => {
    expect(errandState({ acceptedAt: "x", completedAt: "x" })).toBe("done");
  });

  it("has a label for every state and every type", () => {
    // A state with no label renders blank, which is the one bug nobody notices until production.
    for (const state of ERRAND_STATES) expect(ERRAND_STATE_LABELS[state]).toBeTruthy();
    for (const type of ERRAND_TYPES) expect(ERRAND_TYPE_LABELS[type]).toBeTruthy();
  });
});

describe("availableActions", () => {
  it("offers accepting or declining while nothing has happened", () => {
    expect(availableActions({})).toEqual(["accept", "decline"]);
  });

  it("drops declining once it has been accepted", () => {
    // Backing out of something you confirmed is a conversation, not a button: the landlord stopped
    // looking for somebody else on the strength of that acceptance.
    expect(availableActions({ acceptedAt: "x" })).toEqual(["complete"]);
  });

  it("offers nothing on anything closed", () => {
    for (const marks of [{ completedAt: "x" }, { declinedAt: "x" }, { cancelledAt: "x" }]) {
      expect(availableActions(marks)).toEqual([]);
    }
  });
});

describe("isClosed", () => {
  it("counts done, declined and cancelled as closed and nothing else", () => {
    expect(isClosed({})).toBe(false);
    expect(isClosed({ acceptedAt: "x" })).toBe(false);
    expect(isClosed({ completedAt: "x" })).toBe(true);
    expect(isClosed({ declinedAt: "x" })).toBe(true);
    expect(isClosed({ cancelledAt: "x" })).toBe(true);
  });
});

describe("isOverdue", () => {
  it("is true once the due date has passed and it is still open", () => {
    expect(isOverdue(errand({ id: "a", dueAt: "2026-08-24T10:00:00.000Z" }), NOW)).toBe(true);
  });

  it("is false before the due date", () => {
    expect(isOverdue(errand({ id: "a", dueAt: "2026-08-26T10:00:00.000Z" }), NOW)).toBe(false);
  });

  it("is never true for something already closed", () => {
    // A job finished late is finished. Colouring it red for ever tells somebody off for something
    // they already did.
    const late = { id: "a", dueAt: "2026-08-01T10:00:00.000Z" } as const;
    expect(isOverdue(errand({ ...late, completedAt: "2026-08-02T10:00:00.000Z" }), NOW)).toBe(false);
    expect(isOverdue(errand({ ...late, cancelledAt: "2026-08-02T10:00:00.000Z" }), NOW)).toBe(false);
    expect(isOverdue(errand({ ...late, declinedAt: "2026-08-02T10:00:00.000Z" }), NOW)).toBe(false);
  });

  it("takes the reference date instead of reading the clock", () => {
    // The interesting cases are the ones that are not true today, and a function that read the clock
    // could not be asked about them.
    const one = errand({ id: "a", dueAt: "2026-08-26T10:00:00.000Z" });
    expect(isOverdue(one, new Date("2026-08-27T00:00:00.000Z"))).toBe(true);
    expect(isOverdue(one, new Date("2026-08-25T00:00:00.000Z"))).toBe(false);
  });
});

describe("sortForCollaborator", () => {
  it("puts open ones first, soonest first", () => {
    const sorted = sortForCollaborator([
      errand({ id: "later", dueAt: "2026-09-10T10:00:00.000Z" }),
      errand({ id: "closed", dueAt: "2026-08-01T10:00:00.000Z", completedAt: "x" }),
      errand({ id: "soon", dueAt: "2026-08-26T10:00:00.000Z" }),
    ]);

    expect(sorted.map((one) => one.id)).toEqual(["soon", "later", "closed"]);
  });

  it("keeps closed ones instead of hiding them", () => {
    // Somebody who wants to check what they were asked to do last month should not have to remember.
    const sorted = sortForCollaborator([errand({ id: "closed", completedAt: "x" })]);

    expect(sorted).toHaveLength(1);
  });

  it("does not mutate what it was given", () => {
    const input = [errand({ id: "b", dueAt: "2026-09-01T10:00:00.000Z" }), errand({ id: "a" })];
    sortForCollaborator(input);

    expect(input.map((one) => one.id)).toEqual(["b", "a"]);
  });
});

describe("errandMessage", () => {
  const one = { title: "Mostrar el apartamento", propertyArea: "Palermo, Manizales" };
  const link = "https://miarriendodirecto.com/colaborador";

  it("carries what, where, when and the link", () => {
    const text = errandMessage(one, "jueves 27 de agosto, 3:00 p. m.", link);

    expect(text).toContain("Mostrar el apartamento");
    expect(text).toContain("Palermo, Manizales");
    expect(text).toContain("jueves 27 de agosto");
    expect(text).toContain(link);
  });

  it("names the product, because an SMS from an unknown number is a scam until it is not", () => {
    expect(errandMessage(one, "hoy", link)).toMatch(/miarriendoDIRECTO/i);
  });

  it("fits an SMS without splitting, for a realistic errand", () => {
    // Twilio bills per 160-character segment and a split message arrives out of order often enough
    // to matter. This is not a hard limit on the type, it is a check that the shape is sane.
    expect(errandMessage(one, "jueves 27 de agosto, 3:00 p. m.", link).length).toBeLessThan(320);
  });
});

describe("reminderDue", () => {
  const at = "2026-08-26T20:00:00.000Z";
  const accepted = { dueAt: at, acceptedAt: "2026-08-20T10:00:00.000Z" };
  const minutes = (n: number) => new Date(Date.parse(at) - n * 60_000);

  it("fires inside the hour before", () => {
    expect(reminderDue(accepted, minutes(59))).toBe(true);
    expect(reminderDue(accepted, minutes(1))).toBe(true);
  });

  it("does not fire before the window opens", () => {
    expect(reminderDue(accepted, minutes(ERRAND_REMINDER_MINUTES + 1))).toBe(false);
  });

  it("treats the exact hour mark as inside", () => {
    // The sweep runs every five minutes, so the boundary decides whether the first tick catches it.
    expect(reminderDue(accepted, minutes(ERRAND_REMINDER_MINUTES))).toBe(true);
  });

  it("stops once the hour has arrived", () => {
    // Past `dueAt` a reminder is an interruption: they either turned up or did not.
    expect(reminderDue(accepted, new Date(at))).toBe(false);
    expect(reminderDue(accepted, minutes(-5))).toBe(false);
  });

  it("never reminds an errand nobody confirmed", () => {
    // The rule the interview reminder holds too: a proposal nobody accepted is not an appointment.
    expect(reminderDue({ dueAt: at }, minutes(30))).toBe(false);
  });

  it("never reminds twice", () => {
    // The sweep wakes every five minutes: without this the same person gets it twelve times an hour.
    expect(reminderDue({ ...accepted, remindedAt: "2026-08-26T19:05:00.000Z" }, minutes(30))).toBe(false);
  });

  it("never reminds something already closed", () => {
    for (const closed of [{ completedAt: "x" }, { declinedAt: "x" }, { cancelledAt: "x" }]) {
      expect(reminderDue({ ...accepted, ...closed }, minutes(30))).toBe(false);
    }
  });

  it("does not throw on an unparseable date", () => {
    expect(reminderDue({ dueAt: "no es una fecha", acceptedAt: "x" }, minutes(30))).toBe(false);
  });
});

describe("reminderMessage", () => {
  it("says which errand, where and when", () => {
    const text = reminderMessage(
      { title: "Mostrar el apartamento", propertyArea: "Palermo, Manizales" },
      "jueves 27 de agosto, 3:00 p. m.",
    );

    expect(text).toContain("Mostrar el apartamento");
    expect(text).toContain("Palermo, Manizales");
    expect(text).toContain("jueves 27 de agosto");
    expect(text).toMatch(/una hora/i);
  });

  it("cabe en un SMS sin partirse", () => {
    const text = reminderMessage(
      { title: "Mostrar el apartamento a un interesado", propertyArea: "Palermo, Manizales" },
      "jueves 27 de agosto, 3:00 p. m.",
    );

    expect(text.length).toBeLessThan(320);
  });
});
