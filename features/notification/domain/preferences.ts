/**
 * Qué avisos quiere recibir una persona, y por dónde.
 *
 * **La campana no es una preferencia, y esa es la decisión que da forma a todo lo demás.** Lo que
 * `notify()` escribe en `notifications/{id}` es el registro dentro del producto: es lo que la
 * pantalla del proceso lee, lo que la suscripción en vivo despierta y lo que queda cuando alguien
 * entra tres días después a ver qué pasó. Una preferencia que pudiera apagarla no silenciaría un
 * aviso, borraría un hecho — y dejaría a las dos partes mirando páginas distintas de la misma
 * negociación. Así que lo que se puede apagar son los canales que **salen** del producto: el correo
 * y el WhatsApp.
 *
 * Esto tampoco alcanza a los correos de Firebase —verificar la dirección, restablecer la
 * contraseña—, que no pasan por `notify()` y no deben pasar: son credenciales para volver a entrar,
 * no noticias, y una preferencia que dejara a alguien sin poder recuperar su cuenta sería una
 * preferencia mal puesta.
 *
 * Módulo puro: sin `server-only` y sin Firestore, porque lo leen tanto la acción que decide si
 * manda el correo como la pantalla que dibuja los interruptores.
 */
import { NOTIFICATION_TYPES, type NotificationType } from "./notification";

/**
 * Los cuatro asuntos por los que este producto escribe.
 *
 * Son categorías y no tipos sueltos a propósito: cuarenta y seis interruptores no son una pantalla
 * de ajustes, son una hoja de cálculo. Lo que alguien decide de verdad es "avísame de mi proceso" o
 * "no me llenes el correo con encargos", y agrupar por asunto es lo que convierte cuarenta y seis
 * decisiones en cuatro.
 */
export const NOTIFICATION_CATEGORIES = ["process", "lease", "reminders", "errands"] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/**
 * Por dónde sale un aviso, aparte de la campana.
 *
 * `whatsapp` está aquí porque `notify()` ya lo manda —basta con pasarle un teléfono— y hoy solo lo
 * usa el recordatorio de una entrevista. Ver `CATEGORY_CHANNELS`: en las categorías que nunca salen
 * por ahí no se pinta un interruptor apagado, se dice que ese canal no aplica. Un control que no
 * hace nada es peor que uno ausente, que es la misma regla por la que el canal de WhatsApp de la
 * firma no aparece hasta que hay plantilla aprobada.
 */
export const NOTIFICATION_CHANNELS = ["email", "whatsapp"] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * A qué asunto pertenece cada tipo.
 *
 * **Un `Record` completo y no un `switch` con `default`**: así, el día que alguien añada un tipo a
 * `NOTIFICATION_TYPES` sin decidir de qué habla, el error sale en `pnpm typecheck` y no en forma de
 * un correo que se mandó pese a que la persona lo había apagado. Un `default` habría contestado
 * "process" a todo lo nuevo, en silencio y para siempre.
 */
const CATEGORY_OF: Readonly<Record<NotificationType, NotificationCategory>> = {
  application_received: "process",
  stage_advanced: "process",
  documents_requested: "process",
  document_rejected: "process",
  check_findings: "process",
  visit_proposed: "process",
  visit_confirmed: "process",
  visit_declined: "process",
  visit_interested: "process",
  visit_not_interested: "process",
  visit_proposed_by_collaborator: "process",
  interview_proposed: "process",
  interview_confirmed: "process",
  interview_declined: "process",
  guarantee_requested: "process",
  guarantee_active: "process",
  guarantee_waived: "process",
  contract_ready: "process",
  contract_signed: "process",
  payout_ready: "process",
  receipt_uploaded: "process",
  receipt_rejected: "process",
  canon_confirmed: "process",
  application_approved: "process",
  application_rejected: "process",
  application_withdrawn: "process",

  lease_started: "lease",
  canon_payout_changed: "lease",
  canon_receipt_uploaded: "lease",
  canon_receipt_rejected: "lease",
  canon_paid: "lease",
  incident_reported: "lease",
  incident_in_progress: "lease",
  incident_awaiting_confirmation: "lease",
  incident_resolved: "lease",
  incident_withdrawn: "lease",
  incident_comment: "lease",
  /*
   * El acta va con el arriendo y no con los recordatorios: no avisa de algo que va a pasar, avisa
   * de que la otra parte hizo algo — que es la definición de esta categoría.
   */
  handover_submitted: "lease",
  handover_accepted: "lease",
  handover_objected: "lease",

  /*
   * Los dos recordatorios de una entrevista, y son categoría propia por lo que piden: no son la
   * noticia de que algo pasó, son el aviso de que algo va a pasar en diez minutos. Quien apaga los
   * correos de su proceso porque ya está encima de él sigue queriendo que le suene el de la llamada.
   */
  interview_reminder_day: "reminders",
  interview_reminder_soon: "reminders",
  /*
   * Los tres del canon son recordatorios y no `lease`, por lo mismo que los de la entrevista: no
   * son la noticia de que algo pasó, son el aviso de que algo va a pasar. Y la consecuencia
   * importa — quien apaga los correos de su arriendo porque ya está encima de él sigue queriendo
   * el que le dice que el canon vence el jueves.
   */
  canon_due_soon: "reminders",
  canon_due_today: "reminders",
  canon_overdue: "reminders",

  collaborator_invited: "errands",
  collaborator_accepted: "errands",
  collaborator_declined: "errands",
  collaborator_revoked: "errands",
  errand_accepted: "errands",
  errand_declined: "errands",
  errand_completed: "errands",
};

/** De qué habla un aviso. */
export function categoryOf(type: NotificationType): NotificationCategory {
  return CATEGORY_OF[type];
}

/**
 * Qué canales tiene sentido ofrecer en cada categoría.
 *
 * WhatsApp solo sale por `notify()` cuando quien llama pasa un teléfono, y hoy el único que lo pasa
 * es el barrido de recordatorios. Los mensajes de un encargo salen por Twilio desde su propio
 * módulo y no por aquí, así que un interruptor de WhatsApp en `errands` sería un control sobre algo
 * que este camino no manda.
 */
export const CATEGORY_CHANNELS: Readonly<
  Record<NotificationCategory, readonly NotificationChannel[]>
> = {
  process: ["email"],
  lease: ["email"],
  reminders: ["email", "whatsapp"],
  errands: ["email"],
};

/** Si esa casilla de la tabla es un interruptor o un "no aplica". */
export function channelApplies(
  category: NotificationCategory,
  channel: NotificationChannel,
): boolean {
  return CATEGORY_CHANNELS[category].includes(channel);
}

/** Lo que se guarda: una respuesta por categoría y canal. */
export type NotificationPreferences = Readonly<
  Record<NotificationCategory, Readonly<Record<NotificationChannel, boolean>>>
>;

/**
 * Todo encendido.
 *
 * **Es el valor de quien nunca ha entrado aquí**, que son todas las cuentas creadas hasta hoy, y
 * también el que se usa cuando la lectura falla: ver `allowsChannel`. Estrenar la pantalla no puede
 * cambiar lo que a nadie le llega.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  process: { email: true, whatsapp: true },
  lease: { email: true, whatsapp: true },
  reminders: { email: true, whatsapp: true },
  errands: { email: true, whatsapp: true },
};

/** `true` salvo que la respuesta guardada diga explícitamente que no. */
function storedAnswer(value: unknown): boolean {
  return value === false ? false : true;
}

/**
 * Lee lo que hay en Firestore sin confiar en su forma.
 *
 * Un documento escrito por una versión anterior, uno a medias o uno vacío tienen que dar una
 * respuesta completa, y la respuesta que falta es **sí**: un campo que todavía no existe no es
 * alguien que apagó algo. Es la misma tolerancia que `updates` en una incidencia — una función pura
 * que solo es total porque su único llamador es cuidadoso es una función esperando al segundo.
 */
export function normalizePreferences(value: unknown): NotificationPreferences {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => {
      const stored = source[category];
      const answers =
        typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {};

      return [
        category,
        Object.fromEntries(
          NOTIFICATION_CHANNELS.map((channel) => [channel, storedAnswer(answers[channel])]),
        ),
      ];
    }),
  ) as NotificationPreferences;
}

/**
 * ¿Sale este aviso por este canal?
 *
 * `preferences` puede ser `null` — la lectura falló, o no hay documento — y entonces la respuesta es
 * que sí. **Falla hacia entregar**, deliberadamente: no mandarle a alguien el correo que dice que le
 * rechazaron un documento porque Firestore tuvo un mal segundo es un daño mayor que mandarle uno que
 * había apagado. La campana, que es el registro, sale de todas formas en los dos casos.
 */
export function allowsChannel(
  preferences: NotificationPreferences | null,
  type: NotificationType,
  channel: NotificationChannel,
): boolean {
  const category = categoryOf(type);

  // Un canal que esta categoría no usa nunca salió por aquí: la respuesta no depende de nadie.
  if (!channelApplies(category, channel)) return false;
  if (!preferences) return true;

  return preferences[category][channel];
}

/** Los tipos que caen en una categoría. Lo usa la prueba que fija los grupos. */
export function typesIn(category: NotificationCategory): readonly NotificationType[] {
  return NOTIFICATION_TYPES.filter((type) => categoryOf(type) === category);
}

/**
 * Cómo se llama cada asunto y qué entra en él, en es-CO.
 *
 * Vive aquí y no en el componente por lo mismo que `STAGE_LABELS`: es la descripción de una
 * categoría del dominio, y una segunda copia en la pantalla es la que se queda vieja el día que un
 * tipo cambia de grupo. La frase de `covers` es lo que hace que un interruptor se pueda decidir sin
 * abrir el código — "avisos del proceso" no le dice a nadie si incluye el rechazo de un documento.
 */
export const CATEGORY_COPY: Readonly<
  Record<NotificationCategory, { readonly label: string; readonly covers: string }>
> = {
  process: {
    label: "Tu proceso de arriendo",
    covers:
      "Postulaciones, visitas, documentos, entrevista, póliza, firma del contrato y el primer canon.",
  },
  lease: {
    label: "Tu arriendo en curso",
    covers: "Los meses del canon, los comprobantes y las incidencias que se reportan.",
  },
  reminders: {
    label: "Recordatorios de citas",
    covers: "El día antes y diez minutos antes de una entrevista confirmada.",
  },
  errands: {
    label: "Encargos que repartes",
    covers: "Cuando quien iba a mostrar tu inmueble acepta, no puede o ya lo hizo.",
  },
};

/** Cómo se llama cada canal. La campana no está: no es una preferencia. */
export const CHANNEL_LABELS: Readonly<Record<NotificationChannel, string>> = {
  email: "Correo",
  whatsapp: "WhatsApp",
};
