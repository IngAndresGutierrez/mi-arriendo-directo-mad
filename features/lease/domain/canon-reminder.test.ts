/**
 * When a canon reminder goes out, and to whom.
 *
 * This is the rule with no screen behind it: a cron fires it, so nothing in the browser can show
 * that it chose wrong. The two ways it fails are silence on the month that mattered and a message
 * that arrives about money somebody already sent — and each of those has a case here.
 */
import { describe, expect, it } from "vitest";

import {
  CANON_REMINDERS,
  REMINDER_HORIZON_DAYS,
  canonReminderAudience,
  daysFromDue,
  dueCanonReminder,
  isCanonReminderId,
  remindableMonths,
} from "./canon-reminder";
import type { Period } from "./lease";

const MONTH = { dueDate: "2026-09-05" };

/** A month with a receipt on it, judged or not. */
const withReceipt = (
  uploadedAt: string,
  verdict?: { status: "confirmed" | "rejected"; at: string },
): Pick<Period, "receipt" | "verdict"> => ({
  receipt: {
    path: "payments/lease-1/a.pdf",
    fileName: "comprobante.pdf",
    contentType: "application/pdf",
    bytes: 1000,
    amount: 1_400_000,
    paidOn: "2026-09-04",
    uploadedAt,
    note: "",
  },
  verdict: verdict ? { status: verdict.status, at: verdict.at, reason: "" } : null,
});

describe("daysFromDue", () => {
  it("counts whole days either side of the due date", () => {
    expect(daysFromDue("2026-09-05", "2026-09-02")).toBe(-3);
    expect(daysFromDue("2026-09-05", "2026-09-05")).toBe(0);
    expect(daysFromDue("2026-09-05", "2026-09-06")).toBe(1);
    expect(daysFromDue("2026-09-05", "2026-10-05")).toBe(30);
  });

  /**
   * Across a month boundary and across a leap day, which is where naive arithmetic drifts.
   */
  it("crosses months and a leap day without slipping", () => {
    expect(daysFromDue("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysFromDue("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("answers zero rather than NaN for a value that is not a date", () => {
    expect(daysFromDue("no es una fecha", "2026-09-05")).toBe(0);
  });
});

describe("dueCanonReminder", () => {
  it("says nothing while the month is still far off", () => {
    expect(dueCanonReminder(MONTH, null, [], "2026-08-20")).toBeNull();
  });

  it("warns three days ahead", () => {
    expect(dueCanonReminder(MONTH, null, [], "2026-09-02")).toEqual({
      send: "due_soon",
      alsoMark: [],
    });
  });

  it("says it is today, on the day", () => {
    expect(dueCanonReminder(MONTH, null, ["due_soon"], "2026-09-05")?.send).toBe("due_today");
  });

  /** The day after, not the same evening: a transfer sent on the 5th can land on the 6th. */
  it("does not call it arrears on the due date itself", () => {
    expect(dueCanonReminder(MONTH, null, ["due_soon"], "2026-09-05")?.send).not.toBe("overdue");
    expect(dueCanonReminder(MONTH, null, ["due_soon", "due_today"], "2026-09-06")?.send).toBe(
      "overdue",
    );
  });

  /**
   * **The mirror of the interview rule, and the case it exists for.** A tenancy whose first sweep
   * runs a week after the due date must not open with "tu canon vence en 3 días" about a month
   * already in arrears. The furthest-along reminder wins and the earlier ones are written off, so
   * they cannot fire late on the next tick either.
   */
  it("sends the furthest-along reminder and writes off the ones it skipped", () => {
    expect(dueCanonReminder(MONTH, null, [], "2026-09-12")).toEqual({
      send: "overdue",
      alsoMark: ["due_soon", "due_today"],
    });
  });

  it("never repeats one that already went out", () => {
    const all = CANON_REMINDERS.map((reminder) => reminder.id);

    expect(dueCanonReminder(MONTH, null, all, "2026-09-12")).toBeNull();
  });

  /**
   * Once the tenant has uploaded a receipt the ball is with the landlord. Chasing somebody for
   * money they have already said they sent is the product taking a side it cannot support.
   */
  it("goes quiet the moment a receipt is uploaded", () => {
    expect(dueCanonReminder(MONTH, withReceipt("2026-09-04T10:00:00.000Z"), [], "2026-09-12")).toBeNull();
  });

  it("stays quiet once the landlord confirmed it", () => {
    const paid = withReceipt("2026-09-04T10:00:00.000Z", {
      status: "confirmed",
      at: "2026-09-05T10:00:00.000Z",
    });

    expect(dueCanonReminder(MONTH, paid, [], "2026-09-12")).toBeNull();
  });

  /** But a **rejected** receipt is not a payment, and that month is still owed. */
  it("resumes when the receipt was rejected", () => {
    const rejected = withReceipt("2026-09-04T10:00:00.000Z", {
      status: "rejected",
      at: "2026-09-05T10:00:00.000Z",
    });

    expect(dueCanonReminder(MONTH, rejected, [], "2026-09-12")?.send).toBe("overdue");
  });

  /**
   * A month two months late is not a reminder problem any more. Without the horizon, every month
   * of a tenancy that stopped paying a year ago stays a candidate for ever — which is both noise
   * and unbounded work.
   */
  it("stops having anything to say past the horizon", () => {
    const justInside = dueCanonReminder(MONTH, null, ["due_soon", "due_today"], "2026-10-05");
    const past = dueCanonReminder(MONTH, null, ["due_soon", "due_today"], "2026-10-06");

    expect(daysFromDue(MONTH.dueDate, "2026-10-05")).toBe(REMINDER_HORIZON_DAYS);
    expect(justInside?.send).toBe("overdue");
    expect(past).toBeNull();
  });

  it("tolerates a month written before reminders existed", () => {
    expect(dueCanonReminder(MONTH, null, [], "2026-09-02")?.send).toBe("due_soon");
  });
});

describe("canonReminderAudience", () => {
  /**
   * Before the due date it is the tenant's business alone: a bell that rings at a landlord for the
   * calendar is a bell muted before the month it matters.
   */
  it("keeps the two early reminders between the product and the tenant", () => {
    expect(canonReminderAudience("due_soon")).toEqual({ tenant: true, landlord: false });
    expect(canonReminderAudience("due_today")).toEqual({ tenant: true, landlord: false });
  });

  /** Arrears are a fact about the tenancy, and the landlord is the one who decides what to do. */
  it("tells both parties about arrears", () => {
    expect(canonReminderAudience("overdue")).toEqual({ tenant: true, landlord: true });
  });
});

describe("isCanonReminderId", () => {
  it("recognises exactly the three that exist", () => {
    expect(CANON_REMINDERS.every((reminder) => isCanonReminderId(reminder.id))).toBe(true);
    expect(isCanonReminderId("weekly")).toBe(false);
    expect(isCanonReminderId(undefined)).toBe(false);
  });
});

describe("remindableMonths", () => {
  const schedule = [
    { dueDate: "2026-06-01" },
    { dueDate: "2026-07-01" },
    { dueDate: "2026-08-01" },
    { dueDate: "2026-09-01" },
    { dueDate: "2026-10-01" },
  ];

  /**
   * **The bug this function exists for.** On the 29th of August, the month the tenancy is "in" is
   * August — whose canon fell due four weeks ago — while September's, three days away, is not the
   * current month at all. Looking only at the current month, "vence pronto" could never fire for a
   * canon due on the 1st, and would fire normally for one due on the 28th. That is a delivery
   * failure that looks like an infrastructure problem for months.
   */
  it("reaches a month whose due date is still ahead", () => {
    const reachable = remindableMonths(schedule, "2026-08-29").map((month) => month.dueDate);

    expect(reachable).toContain("2026-09-01");
  });

  it("stops at the lead time: a month further off is not in scope", () => {
    const reachable = remindableMonths(schedule, "2026-08-28").map((month) => month.dueDate);

    expect(reachable).not.toContain("2026-09-01");
  });

  it("drops months past the horizon", () => {
    const reachable = remindableMonths(schedule, "2026-08-29").map((month) => month.dueDate);

    /* July fell due 59 days ago: long past anything a reminder can help with. */
    expect(reachable).not.toContain("2026-07-01");
    expect(reachable).toContain("2026-08-01");
  });

  /** Oldest first: the debt worth naming is the one that has been sitting longest. */
  it("orders them oldest first", () => {
    const reachable = remindableMonths(schedule, "2026-08-29").map((month) => month.dueDate);

    expect(reachable).toEqual([...reachable].toSorted());
    expect(reachable[0]).toBe("2026-08-01");
  });

  it("answers nothing for a tenancy that has not started", () => {
    expect(remindableMonths(schedule, "2026-01-15")).toEqual([]);
  });
});
