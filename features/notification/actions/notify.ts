import "server-only";

// Not `"use server"`: this is called *by* Server Actions, not from a form. Making it one would
// publish an endpoint that lets anyone send anyone an email.
import { FieldValue } from "firebase-admin/firestore";
import { headers } from "next/headers";
import { after } from "next/server";

import { adminDb } from "@/shared/firebase/admin";
import { resolveSiteUrl } from "@/shared/lib/site-url";

import { renderNotificationEmail } from "../domain/email";
import { interviewReminderMessage } from "../domain/whatsapp";
import { notificationCopy } from "../domain/notification";
import { sendEmail } from "./send-email";
import { sendWhatsApp, whatsAppTemplate } from "./send-whatsapp";
import type { NotificationType } from "../domain/notification";
import type { Stage } from "@/features/application/client";

/**
 * Where the links in an email point.
 *
 * Taken from the request, so an email produced while testing on localhost links to localhost
 * and one produced in production links to production — without anybody remembering to set a
 * variable. `resolveSiteUrl` is what decides which hosts are believed.
 */
async function baseUrl(): Promise<string> {
  const requestHeaders = await headers();

  return resolveSiteUrl({
    host: requestHeaders.get("host"),
    proto: requestHeaders.get("x-forwarded-proto"),
    configured: process.env.NEXT_PUBLIC_SITE_URL,
  });
}

export type NotifyInput = {
  readonly recipientUid: string;
  /** Where the email goes. Absent — a profile with no email — sends nothing, and says nothing. */
  readonly recipientEmail: string | null;
  readonly type: NotificationType;
  readonly applicationId: string;
  readonly stage: Stage;
  readonly propertyTitle: string;
  readonly actorName: string;
  /** Only for the types that need it: which document, and what was wrong with it. */
  readonly detail?: string;
  /**
   * `YYYY-MM`, on the notifications that are about one month of a tenancy.
   *
   * It is what the link needs — the anchor of one month inside a page with twelve of them — and it
   * is also what lets the copy say "septiembre de 2026" instead of "un canon".
   */
  readonly period?: string;
  /**
   * The incident's id, on the notification that says one was reported.
   *
   * Same job as `period`: it is what the link needs to land on the report instead of at the top of
   * the tenancy.
   */
  readonly incident?: string;
  /**
   * E.164, and only for what is worth a WhatsApp: a reminder minutes before a call.
   *
   * Passing a phone is what says "this one also goes out over WhatsApp". Every other movement of
   * a process is news, and news belongs in the bell and the inbox — a phone that buzzes for each
   * of nine stages is a phone somebody mutes, and then the reminder arrives muted too.
   */
  readonly recipientPhone?: string | null;
};

/**
 * Tells someone that something happened: in the app, and by email.
 *
 * **Never throws.** It is called at the end of an action that has already written what matters —
 * the application exists, the stage moved — and a notification that fails must not undo any of
 * it or show the user an error about work that succeeded. What it does instead is log, so a
 * silent failure is still a visible one.
 *
 * The email goes out through Resend — see `send-email.ts` — and it goes out **after the
 * response**. A notification is three network calls the person who clicked has no business
 * waiting for: their decision is already saved, and making them wait half a second so that
 * somebody else finds out is charging them for work that is not theirs. `after()` runs even
 * when the action ends in a `redirect()`, which is what applying does.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await adminDb().collection("notifications").add({
      recipientUid: input.recipientUid,
      type: input.type,
      applicationId: input.applicationId,
      stage: input.stage,
      propertyTitle: input.propertyTitle,
      actorName: input.actorName,
      // Firestore rejects `undefined`, and a notification with no detail simply has none.
      ...(input.detail ? { detail: input.detail } : {}),
      ...(input.period ? { period: input.period } : {}),
      ...(input.incident ? { incident: input.incident } : {}),
      readAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // Logged, not thrown: see above. The id is enough to find it in the process.
    console.error(`notify failed for application ${input.applicationId}:`, error);
  }

  if (input.recipientPhone) {
    const { template, locale } = whatsAppTemplate();
    const message = interviewReminderMessage({
      to: input.recipientPhone,
      propertyTitle: input.propertyTitle,
      // The bell's own words for this notification, so the three channels say one thing.
      when: input.detail || notificationCopy(input).body,
      template,
      locale,
    });
    after(() => sendWhatsApp(message));
  }

  // A profile with no email address sends nothing, and says nothing about it.
  if (!input.recipientEmail) return;

  // Read here, not inside `after()`: the request's headers belong to the request, and by the
  // time the callback runs there is no longer one to read them from.
  const email = renderNotificationEmail(input, input.recipientEmail, await baseUrl());
  after(() => sendEmail(email));
}
