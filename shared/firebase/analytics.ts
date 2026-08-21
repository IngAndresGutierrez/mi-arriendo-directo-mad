/**
 * Google Analytics de Firebase — SOLO navegador.
 *
 * `getAnalytics()` toca `window` y `document`, así que no puede ejecutarse durante el
 * render en el servidor (recuerda: un Client Component también se renderiza en el
 * servidor). Por eso se inicializa de forma diferida, tras el montaje, y detrás de
 * `isSupported()` (Safari en modo privado y algunos navegadores no lo soportan).
 *
 * Importa `lib/firebase/app` y no un módulo de servicio: así este chunk no arrastra
 * Firestore ni Storage.
 */
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";

import { firebaseApp } from "@/shared/firebase/app";

let instance: Analytics | null = null;

/** `null` si el navegador no lo soporta, si falta measurementId, o si se llama en el servidor. */
export async function getAnalyticsInstance(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  if (!process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) return null;
  if (instance) return instance;
  if (!(await isSupported())) return null;

  instance = getAnalytics(firebaseApp);
  return instance;
}

/**
 * Registra un evento si Analytics está disponible; si no, no hace nada.
 *
 * Nunca envíes datos personales en los parámetros: ni cédula, ni email, ni ingresos,
 * ni nombres. Solo identificadores no sensibles (inmuebleId, ciudad, tipo).
 */
export async function trackEvent(
  name: string,
  params?: Readonly<Record<string, string | number | boolean>>,
): Promise<void> {
  const analytics = await getAnalyticsInstance();
  if (!analytics) return;
  logEvent(analytics, name, params);
}
