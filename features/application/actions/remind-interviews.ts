import "server-only";

// Not `"use server"`: this is called by the cron route, never from a form. Published as an
// action it would let anyone make the platform send messages to everybody with an interview.
import { FieldValue } from "firebase-admin/firestore";

import { notify } from "@/features/notification";
import { getProfile } from "@/features/profile";
import { adminDb } from "@/shared/firebase/admin";

import { dueReminder, interviewWhen, type Interview } from "../domain/interview";
import type { Application } from "../domain/application";

export type ReminderSweep = {
  /** How many interviews were looked at. */
  readonly checked: number;
  /** How many reminders went out, each to both parties. */
  readonly sent: number;
};

/**
 * Interviews close enough to remind, in one bounded read.
 *
 * Only processes sitting on the interview stage — a set that is naturally small, because a
 * process passes through it once — so it filters in memory instead of asking for a composite
 * index on a nested field. If that stops being small, the shape it wants is an index on
 * `interview.at`, not a bigger limit.
 */
const MAX_SCAN = 200;

async function candidates(): Promise<readonly Application[]> {
  const snapshot = await adminDb()
    .collection("applications")
    .where("stage", "==", "interview")
    .where("status", "==", "open")
    .limit(MAX_SCAN)
    .get();

  return snapshot.docs.map(
    (doc) => ({ ...(doc.data() as object), id: doc.id }) as unknown as Application,
  );
}

/**
 * Sends the reminders that are due, and records that it did.
 *
 * Both parties get it: they are both on the call, and the one who proposed the time is as
 * capable of forgetting it as the one who confirmed. It goes out over the three channels at once
 * — the bell, an email and a WhatsApp — because ten minutes before a call is exactly the moment
 * when "they will see it when they open the app" is not good enough.
 *
 * **Idempotent**, and that is the whole design: the sweep wakes up every few minutes, so what
 * has been sent is written on the interview before anything leaves. A crash between the write
 * and the send costs one reminder; the other order would cost the same reminder every five
 * minutes until the call.
 */
export async function remindUpcomingInterviews(now: Date = new Date()): Promise<ReminderSweep> {
  const applications = await candidates();
  let sent = 0;

  for (const application of applications) {
    const interview = application.interview as Interview | null;
    const due = dueReminder(interview, now);
    if (!due || !interview) continue;

    await adminDb()
      .collection("applications")
      .doc(application.id)
      .update({
        "interview.remindersSent": FieldValue.arrayUnion(due.send, ...due.alsoMark),
      });

    const type = due.send === "day_before" ? "interview_reminder_day" : "interview_reminder_soon";
    const when = interviewWhen(interview);

    const [tenant, landlord] = await Promise.all([
      getProfile(application.tenantUid),
      getProfile(application.landlordUid),
    ]);

    for (const [uid, profile] of [
      [application.tenantUid, tenant],
      [application.landlordUid, landlord],
    ] as const) {
      await notify({
        recipientUid: uid,
        recipientEmail: profile?.email ?? null,
        recipientPhone: profile?.phone ?? null,
        type,
        applicationId: application.id,
        stage: "interview",
        propertyTitle: application.propertyTitle,
        // Nobody caused this one: it is the clock. The copy for these types names neither party.
        actorName: "",
        detail: when,
      });
    }

    sent += 1;
  }

  return { checked: applications.length, sent };
}
