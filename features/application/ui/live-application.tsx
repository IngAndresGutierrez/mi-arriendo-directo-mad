"use client";

import { useLiveRefresh } from "@/shared/lib/use-live-refresh";

/**
 * Keeps the process page current for whoever is looking at it.
 *
 * Both people are often on this screen at the same time — one uploading, the other approving —
 * and the whole point of a shared process is that they see the same thing. Reloading to find out
 * whether the other side did something is the product asking the user to poll it.
 *
 * It watches the application document, which is the one thing both parties are allowed to read
 * and which every action here touches: a verdict, a stage, an authorisation, a document arriving.
 */
export function LiveApplication({
  applicationId,
  updatedAt,
}: {
  readonly applicationId: string;
  /** What the server rendered, so the change we caused ourselves is not refreshed twice. */
  readonly updatedAt: string;
}) {
  useLiveRefresh(`applications/${applicationId}`, String(new Date(updatedAt).getTime()));

  return null;
}
