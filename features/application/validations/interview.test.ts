import { describe, expect, it } from "vitest";

import {
  interviewFeedbackSchema,
  proposeInterviewSchema,
  toInstant,
  validateInterviewSlot,
} from "./interview";

const VALID = {
  day: "2026-09-10",
  time: "15:00",
  channel: "meet",
  link: "https://meet.google.com/abc-defg-hij",
  note: "",
};

describe("proposeInterviewSchema", () => {
  it("accepts a Meet with its link", () => {
    expect(proposeInterviewSchema.safeParse(VALID).success).toBe(true);
  });

  it("requires the link only for a Meet", () => {
    expect(proposeInterviewSchema.safeParse({ ...VALID, link: "" }).success).toBe(false);
    expect(
      proposeInterviewSchema.safeParse({ ...VALID, channel: "whatsapp", link: "" }).success,
    ).toBe(true);
  });

  it("rejects a link that is not an https URL", () => {
    expect(proposeInterviewSchema.safeParse({ ...VALID, link: "meet.google.com/abc" }).success).toBe(
      false,
    );
    expect(
      proposeInterviewSchema.safeParse({ ...VALID, link: "http://meet.google.com/abc" }).success,
    ).toBe(false);
  });

  it("rejects a time that is not a time", () => {
    expect(proposeInterviewSchema.safeParse({ ...VALID, time: "25:00" }).success).toBe(false);
    expect(proposeInterviewSchema.safeParse({ ...VALID, day: "10/09/2026" }).success).toBe(false);
  });
});

describe("toInstant", () => {
  it("reads the two fields as Colombian time, whatever clock the server is on", () => {
    // 3 p.m. in Bogotá is 20:00 UTC, always: Colombia has no daylight saving.
    expect(toInstant("2026-09-10", "15:00").toISOString()).toBe("2026-09-10T20:00:00.000Z");
  });
});

describe("validateInterviewSlot", () => {
  const now = new Date("2026-09-01T15:00:00.000Z");

  it("accepts a time still to come", () => {
    expect(validateInterviewSlot(new Date("2026-09-02T15:00:00.000Z"), now).ok).toBe(true);
  });

  it("rejects a time that already passed", () => {
    const r = validateInterviewSlot(new Date("2026-08-31T15:00:00.000Z"), now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("no hayan pasado");
  });

  it("rejects a date more than a year out", () => {
    expect(validateInterviewSlot(new Date("2027-10-01T15:00:00.000Z"), now).ok).toBe(false);
  });
});

describe("interviewFeedbackSchema", () => {
  it("wants a sentence, not a word", () => {
    expect(interviewFeedbackSchema.safeParse({ result: "went_well", note: "Bien" }).success).toBe(
      false,
    );
    expect(
      interviewFeedbackSchema.safeParse({
        result: "with_reservations",
        note: "Quedó de enviar el soporte de ingresos del mes pasado.",
      }).success,
    ).toBe(true);
  });
});
