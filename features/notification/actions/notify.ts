import "server-only";

// Not `"use server"`: this is called *by* Server Actions, not from a form. Making it one would
// publish an endpoint that lets anyone send anyone an email.
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/shared/firebase/admin";

import { renderNotificationEmail } from "../domain/email";
import type { NotificationType } from "../domain/notification";
import type { Stage } from "@/features/application/client";

/** Where the links in an email point. Absolute: an inbox has no origin of its own. */
function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.miarriendodirecto.com";
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
};

/**
 * Tells someone that something happened: in the app, and by email.
 *
 * **Never throws.** It is called at the end of an action that has already written what matters —
 * the application exists, the stage moved — and a notification that fails must not undo any of
 * it or show the user an error about work that succeeded. What it does instead is log, so a
 * silent failure is still a visible one.
 *
 * The email is not sent from here. It is written to the `mail` collection, which the Firebase
 * "Trigger Email from Firestore" extension delivers: no SMTP credential ever reaches this
 * codebase, retries are the extension's problem, and swapping providers is a change to its
 * configuration rather than to this file.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const batch = adminDb().batch();

    batch.set(adminDb().collection("notifications").doc(), {
      recipientUid: input.recipientUid,
      type: input.type,
      applicationId: input.applicationId,
      stage: input.stage,
      propertyTitle: input.propertyTitle,
      actorName: input.actorName,
      readAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (input.recipientEmail) {
      const email = renderNotificationEmail(input, input.recipientEmail, baseUrl());

      batch.set(adminDb().collection("mail").doc(), {
        to: [email.to],
        message: { subject: email.subject, text: email.text, html: email.html },
      });
    }

    await batch.commit();
  } catch (error) {
    // Logged, not thrown: see above. The id is enough to find it in the process.
    console.error(`notify failed for application ${input.applicationId}:`, error);
  }
}
