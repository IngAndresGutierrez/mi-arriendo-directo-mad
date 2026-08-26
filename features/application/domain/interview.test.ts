import { dictionaryFor } from "@/shared/i18n/dictionary";
import { describe, expect, it } from "vitest";

import {
  channelNeedsLink,
  dueReminder,
  MEET_CREATE_URL,
  interviewBlocker,
  interviewBlockerMessage,
  interviewEndsAt,
  interviewHasPassed,
  interviewState,
  interviewTimeRange,
  interviewWhen,
  INTERVIEW_MINUTES,
  type Interview,
} from "./interview";

const PROPOSED: Interview = {
  at: "2026-09-10T20:00:00.000Z",
  channel: "meet",
  link: "https://meet.google.com/abc-defg-hij",
  note: "",
  proposedAt: "2026-09-01T15:00:00.000Z",
  confirmedAt: null,
  declinedAt: null,
  declineNote: "",
  feedback: null,
};

const ES = dictionaryFor("es").interview;

describe("interviewState", () => {
  it("is `none` while nothing has been proposed", () => {
    expect(interviewState(null)).toBe("none");
  });

  it("waits for the tenant once proposed", () => {
    expect(interviewState(PROPOSED)).toBe("proposed");
  });

  it("asks for another time when the tenant declined", () => {
    expect(interviewState({ ...PROPOSED, declinedAt: "2026-09-02T10:00:00.000Z" })).toBe("declined");
  });

  it("is scheduled once confirmed", () => {
    expect(interviewState({ ...PROPOSED, confirmedAt: "2026-09-02T10:00:00.000Z" })).toBe("confirmed");
  });

  it("is done once there is feedback", () => {
    const done: Interview = {
      ...PROPOSED,
      confirmedAt: "2026-09-02T10:00:00.000Z",
      feedback: { result: "went_well", note: "Buena conversación.", at: "2026-09-10T21:00:00.000Z" },
    };
    expect(interviewState(done)).toBe("done");
  });

  it("a confirmation does not survive a new proposal", () => {
    // `proposeInterview` writes a fresh object; the shape has no way to keep a stale confirmation.
    expect(interviewState({ ...PROPOSED, confirmedAt: null, declinedAt: null })).toBe("proposed");
  });
});

describe("interviewBlocker", () => {
  it("blocks with nothing proposed", () => {
    expect(interviewBlocker(null)).toBe("not_proposed");
  });

  it("blocks while the tenant has not confirmed", () => {
    expect(interviewBlocker(PROPOSED)).toBe("not_confirmed");
    expect(interviewBlocker({ ...PROPOSED, declinedAt: "2026-09-02T10:00:00.000Z" })).toBe(
      "not_confirmed",
    );
  });

  it("blocks a confirmed interview with no conclusion written", () => {
    expect(interviewBlocker({ ...PROPOSED, confirmedAt: "2026-09-02T10:00:00.000Z" })).toBe(
      "no_feedback",
    );
  });

  it("does not block once there is feedback — and reservations do not block either", () => {
    const conReparos: Interview = {
      ...PROPOSED,
      confirmedAt: "2026-09-02T10:00:00.000Z",
      feedback: { result: "with_reservations", note: "Dudas con los ingresos.", at: "2026-09-10T21:00:00.000Z" },
    };
    expect(interviewBlocker(conReparos)).toBeNull();
  });

  it("says why, differently to each side", () => {
    expect(interviewBlockerMessage("not_proposed", true, ES)).toContain("Propón");
    expect(interviewBlockerMessage("not_proposed", false, ES)).toContain("todavía no");
    expect(interviewBlockerMessage("not_confirmed", false, ES)).toContain("Confirma");
    expect(interviewBlockerMessage(null, true, ES)).toBeNull();
  });
});

describe("the call itself", () => {
  it("lasts half an hour", () => {
    expect(interviewEndsAt("2026-09-10T20:00:00.000Z")).toBe("2026-09-10T20:30:00.000Z");
    expect(INTERVIEW_MINUTES).toBe(30);
  });

  it("has passed only once it is over, not when it starts", () => {
    const empezando = new Date("2026-09-10T20:10:00.000Z");
    const terminada = new Date("2026-09-10T20:31:00.000Z");
    expect(interviewHasPassed(PROPOSED, empezando)).toBe(false);
    expect(interviewHasPassed(PROPOSED, terminada)).toBe(true);
  });

  it("only a Meet needs a link pasted", () => {
    expect(channelNeedsLink("meet")).toBe(true);
    expect(channelNeedsLink("whatsapp")).toBe(false);
    expect(channelNeedsLink("phone")).toBe(false);
  });
});

describe("interviewWhen", () => {
  it("says the day and the hour in Colombian time", () => {
    // 20:00 UTC is 3 p.m. in Bogotá.
    const dicho = interviewWhen({ at: "2026-09-10T20:00:00.000Z" });
    expect(dicho).toContain("jueves");
    expect(dicho).toContain("10 de septiembre");
    expect(dicho).toMatch(/3:00/);
  });

  it("reads the day in Bogotá, not in UTC", () => {
    // 02:00 UTC on the 11th is still 9 p.m. on the 10th in Colombia.
    expect(interviewWhen({ at: "2026-09-11T02:00:00.000Z" })).toContain("10 de septiembre");
  });

  it("spells the half hour out", () => {
    expect(interviewTimeRange("2026-09-10T20:00:00.000Z")).toMatch(/3:00.*a.*3:30/);
  });

  it("says nothing for a value that is not a date", () => {
    expect(interviewWhen({ at: "el jueves" })).toBe("");
  });
});

describe("MEET_CREATE_URL", () => {
  it("is Google's shortcut for a new meeting, over https", () => {
    expect(MEET_CREATE_URL).toBe("https://meet.new");
  });
});

describe("dueReminder", () => {
  const at = "2026-09-10T20:00:00.000Z";
  const confirmed: Interview = { ...PROPOSED, at, confirmedAt: "2026-09-01T10:00:00.000Z" };
  const minutesBefore = (minutes: number) => new Date(new Date(at).getTime() - minutes * 60_000);

  it("does not remind about a proposal nobody confirmed", () => {
    expect(dueReminder({ ...PROPOSED, at }, minutesBefore(30))).toBeNull();
  });

  it("does not remind two days out", () => {
    expect(dueReminder(confirmed, minutesBefore(48 * 60))).toBeNull();
  });

  it("reminds the day before once inside its window", () => {
    expect(dueReminder(confirmed, minutesBefore(23 * 60))?.send).toBe("day_before");
  });

  it("does not repeat one already sent", () => {
    const sent = { ...confirmed, remindersSent: ["day_before"] };
    expect(dueReminder(sent, minutesBefore(23 * 60))).toBeNull();
    expect(dueReminder(sent, minutesBefore(9))?.send).toBe("ten_minutes");
  });

  it("sends only the closest one, and writes off the stale one", () => {
    // Confirmed nine minutes before it starts: both windows are open at once.
    const result = dueReminder(confirmed, minutesBefore(9));
    expect(result?.send).toBe("ten_minutes");
    expect(result?.alsoMark).toEqual(["day_before"]);
  });

  it("stops once the call has started", () => {
    expect(dueReminder(confirmed, new Date(at))).toBeNull();
    expect(dueReminder(confirmed, new Date(new Date(at).getTime() + 60_000))).toBeNull();
  });
});
