/**
 * Firebase Google Analytics — BROWSER ONLY.
 *
 * `getAnalytics()` touches `window` and `document`, so it cannot run during server
 * rendering (remember: a Client Component is rendered on the server too). That is why it
 * is initialized lazily, after mount, and behind `isSupported()` (Safari in private mode
 * and some browsers do not support it).
 *
 * It imports `shared/firebase/app` rather than a service module, so this chunk does not
 * drag in Firestore or Storage.
 */
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";

import { firebaseApp } from "@/shared/firebase/app";

let instance: Analytics | null = null;

/** `null` if the browser does not support it, if measurementId is missing, or if called on the server. */
export async function getAnalyticsInstance(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  if (!process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) return null;
  if (instance) return instance;
  if (!(await isSupported())) return null;

  instance = getAnalytics(firebaseApp);
  return instance;
}

/**
 * Logs an event if Analytics is available; otherwise it does nothing.
 *
 * Never send personal data in the parameters: no national id, no email, no income, no
 * names. Only non-sensitive identifiers (propertyId, city, type).
 */
export async function trackEvent(
  name: string,
  params?: Readonly<Record<string, string | number | boolean>>,
): Promise<void> {
  const analytics = await getAnalyticsInstance();
  if (!analytics) return;
  logEvent(analytics, name, params);
}
