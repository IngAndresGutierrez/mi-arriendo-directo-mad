import { z } from "zod";

import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
} from "../domain/preferences";

/**
 * Una respuesta por canal. Sin `.optional()`: la pantalla manda la tabla entera.
 */
const channelAnswers = z.object(
  Object.fromEntries(
    NOTIFICATION_CHANNELS.map((channel) => [channel, z.boolean({ error: "Respuesta inválida" })]),
  ) as Record<(typeof NOTIFICATION_CHANNELS)[number], z.ZodBoolean>,
);

/**
 * Lo que la pantalla de ajustes manda: la tabla completa, no el interruptor que se movió.
 *
 * **Se manda entera a propósito.** "Desactivar todo" es entonces una escritura y no ocho, y dos
 * pestañas abiertas sobre la misma cuenta no pueden dejar la mitad de una decisión: lo último que se
 * guarda es un estado completo y coherente, en lugar de la suma de parches que llegaron en un orden
 * que nadie eligió.
 *
 * El esquema se construye desde las constantes del dominio en vez de escribirse a mano, para que una
 * categoría nueva no pueda existir en la tabla y no aquí — que es la forma en que un interruptor
 * acaba dibujado, movido, y descartado en silencio por el `safeParse`.
 */
export const notificationPreferencesSchema = z.object(
  Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [category, channelAnswers]),
  ) as Record<(typeof NOTIFICATION_CATEGORIES)[number], typeof channelAnswers>,
);

export type NotificationPreferencesInput = z.output<typeof notificationPreferencesSchema>;
