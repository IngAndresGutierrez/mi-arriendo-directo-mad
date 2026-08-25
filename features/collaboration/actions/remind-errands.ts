import "server-only";

// Not `"use server"`: a module marked that way publishes every export as an endpoint, and this one
// messages people. It is called by the cron route and by nothing else.

import { sendSms, sendWhatsAppTwilio } from "@/features/notification";
import { adminDb } from "@/shared/firebase/admin";
import { formatBogotaWeekdayTime } from "@/shared/format/date";

import { reminderDue, reminderMessage, ERRAND_REMINDER_MINUTES } from "../domain/errand";
import type { Errand, ErrandDoc } from "../domain/errand";

export type ErrandReminderSweep = { readonly checked: number; readonly sent: number };

/**
 * The errands that could plausibly need a reminder on this tick.
 *
 * **A range on `dueAt` alone**, which Firestore serves from the single-field index it maintains
 * automatically — so this needs no entry in `firestore.indexes.json`, unlike the two list queries.
 * That is worth stating because the instinct is to add `where("acceptedAt", "!=", null)` and narrow
 * it in the query: that would be a composite index, and an inequality on a second field Firestore
 * refuses outright. The acceptance is checked in `reminderDue`, in memory, over a handful of rows.
 *
 * The window opens a little wider than the reminder itself. The sweep runs every five minutes and a
 * tick can be late; reading from `now` exactly would let an errand slip past the boundary between
 * two runs and never be reminded at all.
 */
async function candidates(now: Date): Promise<readonly Errand[]> {
  const from = new Date(now.getTime() - 10 * 60_000);
  const to = new Date(now.getTime() + (ERRAND_REMINDER_MINUTES + 10) * 60_000);

  const snapshot = await adminDb()
    .collection("errands")
    .where("dueAt", ">=", from)
    .where("dueAt", "<=", to)
    .limit(200)
    .get();

  return snapshot.docs.map((document) => {
    const doc = document.data() as unknown as ErrandDoc;
    const iso = (value: unknown): string | undefined =>
      value && typeof value === "object" && "toDate" in value
        ? (value as { toDate: () => Date }).toDate().toISOString()
        : undefined;

    return {
      ...doc,
      id: document.id,
      evidence: doc.evidence ?? [],
      dueAt: iso(doc.dueAt) ?? "",
      createdAt: iso(doc.createdAt) ?? "",
      updatedAt: iso(doc.updatedAt) ?? "",
      acceptedAt: iso(doc.acceptedAt),
      declinedAt: iso(doc.declinedAt),
      completedAt: iso(doc.completedAt),
      cancelledAt: iso(doc.cancelledAt),
      remindedAt: iso(doc.remindedAt),
    } as Errand;
  });
}

/**
 * One sweep: remind whoever has an errand starting within the hour.
 *
 * **The mark is written before the message leaves**, and that order is the whole reason this does
 * not spam. The cron wakes every five minutes, so if the send came first and then the write, any
 * failure between them — a Twilio timeout, a cold start killed mid-flight — would send the same
 * reminder again on the next tick, and the one after that. Writing first costs, at worst, one
 * reminder that never arrives; the other order costs twelve an hour until the errand starts. The
 * interview sweep makes the same trade for the same reason.
 *
 * **Both channels, like everything else this collaborator receives.** Neither sender throws — they
 * answer `false` — so a channel that is down costs that channel and not the sweep.
 *
 * It does **not** notify the landlord. A reminder is for the person who has to be somewhere; the
 * landlord already knows, and a bell on their phone an hour before every errand they ever handed out
 * is a bell they mute — which would then be muted for the things that do need them.
 */
export async function remindUpcomingErrands(now: Date = new Date()): Promise<ErrandReminderSweep> {
  const errands = await candidates(now);
  let sent = 0;

  for (const errand of errands) {
    if (!reminderDue(errand, now)) continue;

    await adminDb().collection("errands").doc(errand.id).update({ remindedAt: now });

    const body = reminderMessage(errand, formatBogotaWeekdayTime(errand.dueAt));
    await Promise.all([
      sendSms({ to: errand.collaboratorPhone, body }),
      sendWhatsAppTwilio({
        to: errand.collaboratorPhone,
        body,
        variables: [errand.title, errand.propertyArea, formatBogotaWeekdayTime(errand.dueAt)],
        // La misma plantilla que el anuncio: mismas tres variables, y el texto del SMS ya distingue
        // "tienes un encargo" de "en una hora tienes". Una segunda plantilla para eso sería una
        // aprobación más de Meta a cambio de nada.
        template: process.env.TWILIO_WHATSAPP_ERRAND_TEMPLATE_SID,
      }),
    ]);

    sent += 1;
  }

  return { checked: errands.length, sent };
}
