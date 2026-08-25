import "server-only";

import { adminDb } from "@/shared/firebase/admin";

import { normalizePreferences, type NotificationPreferences } from "../domain/preferences";

/**
 * Dónde vive la respuesta: `users/{uid}/settings/notifications`.
 *
 * Una subcolección de `users` y no un campo del perfil, por lo mismo que `documents` y `consents`
 * son subcolecciones: un `get` del perfil se hace en media docena de sitios —el saludo de `/inicio`,
 * el nombre del postulante, cada correo— y ninguno de ellos tiene nada que ver con qué avisos quiere
 * recibir alguien. Colgarlo del documento haría que cada una de esas lecturas arrastrara una tabla
 * de ocho respuestas, y que cada escritura del perfil pudiera pisarla.
 *
 * `settings` en plural y el documento nombrado por asunto: el día que haya una segunda preferencia
 * que guardar, es un documento hermano y no un campo más aquí.
 */
export const NOTIFICATION_SETTINGS_DOC = "notifications";

function settingsRef(uid: string) {
  return adminDb().collection("users").doc(uid).collection("settings").doc(NOTIFICATION_SETTINGS_DOC);
}

/**
 * Qué avisos quiere esta persona.
 *
 * **Nunca lanza, y devuelve `null` cuando no pudo leer** — que no es lo mismo que "no ha decidido
 * nada". Un documento ausente sí es una decisión conocida (nadie ha tocado la pantalla, luego todo
 * encendido) y se contesta con los valores por defecto; un fallo de Firestore es una pregunta sin
 * respuesta, y `allowsChannel` la resuelve entregando. Confundir las dos habría hecho que un mal
 * segundo de la base de datos se leyera como "esta persona apagó sus correos".
 */
export async function readNotificationPreferences(
  uid: string,
): Promise<NotificationPreferences | null> {
  try {
    const snapshot = await settingsRef(uid).get();

    // Sin documento no hay nada apagado: es una cuenta que nunca abrió la pantalla.
    return normalizePreferences(snapshot.data());
  } catch (error) {
    console.error(`readNotificationPreferences failed for ${uid}:`, error);

    return null;
  }
}

/**
 * Guarda la tabla entera.
 *
 * `set` sin `merge`: lo que llega ya es el estado completo —ver el esquema— y un `merge` dejaría
 * viva una categoría retirada del dominio, que es exactamente el documento que `normalizePreferences`
 * tendría que seguir tolerando para siempre.
 */
export async function writeNotificationPreferences(
  uid: string,
  preferences: NotificationPreferences,
): Promise<void> {
  await settingsRef(uid).set(preferences);
}
