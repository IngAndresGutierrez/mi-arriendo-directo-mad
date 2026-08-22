import "server-only";

import { adminDb } from "@/shared/firebase/admin";

import type { Notification, NotificationDoc } from "../domain/notification";

type Snapshot = { id: string; data: () => Record<string, unknown> | undefined };

function iso(value: unknown): string {
  return typeof value === "object" && value !== null && "toDate" in value
    ? (value as { toDate: () => Date }).toDate().toISOString()
    : new Date(0).toISOString();
}

function toNotification(snapshot: Snapshot): Notification | null {
  const data = snapshot.data();
  if (!data) return null;

  const doc = data as unknown as NotificationDoc;

  return {
    id: snapshot.id,
    recipientUid: doc.recipientUid,
    type: doc.type,
    applicationId: doc.applicationId,
    stage: doc.stage,
    propertyTitle: doc.propertyTitle,
    actorName: doc.actorName,
    readAt: doc.readAt ? iso(doc.readAt) : null,
    createdAt: iso(doc.createdAt),
  };
}

/** How many the bell shows at once. Beyond this the answer is a page, not a longer list. */
export const NOTIFICATION_PAGE_SIZE = 15;

const EMPTY = { items: [] as readonly Notification[], unread: 0 };

/**
 * The most recent notifications for one person, newest first, with how many are unread.
 *
 * **Never throws.** It is read by the layout that wraps every screen behind a session, so a
 * failure here would be a failure of the whole product — which is exactly what happened the
 * first time this shipped, with the composite index still building: every page went down
 * because the bell could not be filled. A bell with nothing in it is a bad bell; a bell that
 * takes the app with it is a bad layout.
 */
export async function listNotifications(
  uid: string,
): Promise<{ readonly items: readonly Notification[]; readonly unread: number }> {
  try {
    const snapshot = await adminDb()
      .collection("notifications")
      .where("recipientUid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(NOTIFICATION_PAGE_SIZE)
      .get();

    const items = snapshot.docs
      .map((doc) => toNotification(doc as unknown as Snapshot))
      .filter((notification): notification is Notification => notification !== null);

    return { items, unread: items.filter((notification) => notification.readAt === null).length };
  } catch (error) {
    console.error("listNotifications failed:", error);

    return EMPTY;
  }
}
