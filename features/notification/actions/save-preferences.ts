"use server";

import { revalidatePath } from "next/cache";

import { SETTINGS_ROUTE } from "@/shared/auth/routes";
import { requireUser } from "@/shared/auth/session";

import { notificationPreferencesSchema } from "../validations/preferences";
import { writeNotificationPreferences } from "../data/preferences";

export type SavePreferencesResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * Cambia qué avisos le salen a quien lo pide, por dónde.
 *
 * Escribe bajo el uid de la sesión, así que no hay forma de esta llamada que edite las preferencias
 * de otra persona: el `uid` no llega en el cuerpo y por eso no hay nada que autorizar contra los
 * datos — el propietario del documento *es* quien está pidiendo.
 *
 * Recibe un objeto y no un `FormData` porque lo que se manda es una tabla de ocho respuestas y no un
 * formulario: aplanarla a `process.email=on` y volverla a armar aquí sería inventar una serialización
 * para deshacerla dos líneas después. Sigue entrando como `unknown` y sale de Zod, que es la regla
 * que importa.
 */
export async function saveNotificationPreferences(input: unknown): Promise<SavePreferencesResult> {
  const user = await requireUser();

  const parsed = notificationPreferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "No pudimos guardar tus preferencias." };
  }

  try {
    await writeNotificationPreferences(user.uid, parsed.data);
  } catch (error) {
    console.error(`saveNotificationPreferences failed for ${user.uid}:`, error);

    return { ok: false, message: "No pudimos guardar tus preferencias. Inténtalo de nuevo." };
  }

  revalidatePath(SETTINGS_ROUTE);

  return { ok: true };
}
