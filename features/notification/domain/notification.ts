import { STAGE_LABELS, type Stage } from "@/features/application/client";
import { incidentAnchor, periodAnchor, periodLabel } from "@/features/lease/client";
import { applicationRoute, rentalRoute } from "@/shared/auth/routes";

/**
 * What happened. One type per movement of a rental process, from the point of view of whoever
 * is being told about it.
 *
 * `documents_requested` and `application_approved` are stages that also arrive as
 * `stage_advanced` would — they are their own type because what they ask of the reader is
 * different. "Avanzaste a Datos y documentos" is a status line; "te piden tus documentos" is a
 * task, and a notification that does not say which of the two it is gets ignored.
 */
export const NOTIFICATION_TYPES = [
  "application_received",
  "stage_advanced",
  "documents_requested",
  "document_rejected",
  "check_findings",
  "interview_proposed",
  "interview_confirmed",
  "interview_declined",
  "interview_reminder_day",
  "interview_reminder_soon",
  "guarantee_requested",
  "guarantee_active",
  "guarantee_waived",
  "contract_ready",
  "contract_signed",
  "payout_ready",
  "receipt_uploaded",
  "receipt_rejected",
  "canon_confirmed",
  "application_approved",
  "application_rejected",
  "application_withdrawn",
  /*
   * The tenancy, which is a different place: these point at `/arriendos/<id>`, not at the
   * nine-stage process. See `LEASE_NOTIFICATION_TYPES` — the destination is derived from the type
   * for the same reason the words are, so a notification written last month lands where that
   * screen lives today.
   */
  "lease_started",
  "canon_payout_changed",
  "canon_receipt_uploaded",
  "canon_receipt_rejected",
  "canon_paid",
  "incident_reported",
  "incident_in_progress",
  "incident_awaiting_confirmation",
  "incident_resolved",
  "incident_withdrawn",
  "incident_comment",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Shape persisted in `notifications/{id}`. */
export type NotificationDoc = {
  readonly recipientUid: string;
  readonly type: NotificationType;
  readonly applicationId: string;
  readonly stage: Stage;
  readonly propertyTitle: string;
  /** Who caused it, so the text can name them: "Ana se postuló…". */
  readonly actorName: string;
  /**
   * The bit that only makes sense for some types — which document was rejected, and why.
   *
   * One optional field instead of a shape per type: the alternative is a union that every
   * reader has to narrow, for a sentence that differs by a clause.
   */
  readonly detail?: string;
  /**
   * Which month, `YYYY-MM`, on the notifications that are about one.
   *
   * It is here rather than parsed out of `detail` because it is what the link needs: the anchor of
   * one month inside a page with twelve of them. Optional, like `detail`, and absent on every
   * notification about the process rather than the tenancy.
   */
  readonly period?: string;
  /**
   * Which incident, on the notifications that are about one.
   *
   * Here for the same reason `period` is: it is what the link needs. A report of a leak has to land
   * on the leak, not at the top of a page with a year of months and four other reports on it.
   */
  readonly incident?: string;
  /** ISO 8601, or `null` while unread. */
  readonly readAt: string | null;
  readonly createdAt: unknown;
};

/** Shape that crosses to components: serializable. */
export type Notification = Omit<NotificationDoc, "createdAt"> & {
  readonly id: string;
  readonly createdAt: string;
};

/**
 * The words, derived from the type rather than stored with it.
 *
 * A notification written a month ago renders with today's copy: fixing a confusing sentence
 * fixes every notification that already went out, instead of only the next one.
 */
/**
 * Ends a sentence without doubling the full stop.
 *
 * Spanish abbreviates times as "3:00 p. m." — with the period — so a body that appends its own
 * lands on "3:00 p. m..", which reads like a typo because it is one.
 */
function sentence(text: string): string {
  const trimmed = text.trim();

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function notificationCopy(
  notification: Pick<Notification, "type" | "stage" | "propertyTitle" | "actorName"> & {
    readonly detail?: string;
    readonly period?: string;
  },
): { readonly title: string; readonly body: string } {
  const who = notification.actorName || "Alguien";
  const property = notification.propertyTitle;
  // `septiembre de 2026`, on the notifications that are about one month. Empty on the rest.
  const month = notification.period ? periodLabel(notification.period) : "";

  switch (notification.type) {
    case "application_received":
      return {
        title: "Nueva postulación",
        body: `${who} se postuló a ${property}. Revisa sus datos y decide si continúan.`,
      };
    case "document_rejected":
      return {
        title: "Tienes que corregir un documento",
        body: notification.detail
          ? `${who} rechazó un documento de tu postulación a ${property}. ${notification.detail}`
          : `${who} rechazó un documento de tu postulación a ${property}. Súbelo otra vez.`,
      };
    case "check_findings":
      return {
        title: "Hay un hallazgo en tus antecedentes",
        body: notification.detail
          ? `${who} registró un hallazgo al revisar tus antecedentes para ${property}. ${notification.detail}`
          : `${who} registró un hallazgo al revisar tus antecedentes para ${property}.`,
      };
    case "interview_proposed":
      return {
        title: "Te proponen una hora para la entrevista",
        body: notification.detail
          ? `${who} propone ${notification.detail} para hablar sobre ${property}. Confírmala o pide otro horario.`
          : `${who} propuso una hora para la entrevista de ${property}. Confírmala o pide otro horario.`,
      };
    case "interview_confirmed":
      return {
        title: "La entrevista quedó confirmada",
        body: notification.detail
          ? `${who} confirmó ${notification.detail} para la entrevista de ${property}.`
          : `${who} confirmó la hora de la entrevista de ${property}.`,
      };
    case "interview_declined":
      return {
        title: "Ese horario no le sirve",
        body: notification.detail
          ? `${who} no puede en la hora propuesta para ${property}. ${notification.detail}`
          : `${who} no puede en la hora propuesta para ${property}. Propón otra.`,
      };
    case "interview_reminder_day":
      return {
        title: "Mañana tienes la entrevista",
        body: notification.detail
          ? sentence(`Recuerda: la entrevista de ${property} es ${notification.detail}`)
          : `Recuerda que mañana es la entrevista de ${property}.`,
      };
    case "interview_reminder_soon":
      return {
        title: "Tu entrevista empieza en 10 minutos",
        body: notification.detail
          ? `${sentence(`La entrevista de ${property} es ${notification.detail}`)} Ten el enlace a mano.`
          : `La entrevista de ${property} empieza en 10 minutos. Ten el enlace a mano.`,
      };
    case "guarantee_requested":
      return {
        title: "Están tramitando la póliza de arrendamiento",
        body: notification.detail
          ? `${who} solicitó la póliza que respalda el arriendo de ${property}. ${notification.detail}`
          : `${who} solicitó la póliza que respalda el arriendo de ${property}.`,
      };
    case "guarantee_active":
      return {
        title: "La póliza quedó activa",
        body: notification.detail
          ? `${sentence(`El arriendo de ${property} ya tiene su garantía: ${notification.detail}`)} Sigue la firma del contrato.`
          : `El arriendo de ${property} ya tiene su póliza. Sigue la firma del contrato.`,
      };
    case "guarantee_waived":
      /*
       * Para el inquilino esto es sobre todo **una cosa menos que hacer**: nadie va a estudiar su
       * perfil y Sura no le va a escribir, que es justo lo que la otra notificación de esta etapa le
       * había dicho que esperara. Se dice sin adornos y sin opinar sobre la decisión del propietario:
       * la ley no exige póliza, así que no hay nada que reprochar ni nada que celebrar.
       */
      return {
        title: "Este arriendo va sin póliza de arrendamiento",
        body: `${who} decidió no pedir póliza para ${property}. No tienes que hacer nada por el seguro.`,
      };
    case "contract_ready":
      return {
        title: "Hay un contrato para firmar",
        body: notification.detail
          ? `${sentence(`${who} subió el contrato del arriendo de ${property}: ${notification.detail}`)} Léelo y fírmalo desde la etapa de la firma.`
          : `${who} subió el contrato del arriendo de ${property}. Léelo y fírmalo desde la etapa de la firma.`,
      };
    case "contract_signed":
      return {
        title: "El contrato quedó firmado",
        body: `El contrato del arriendo de ${property} ya está firmado por las dos partes. Sigue el primer canon.`,
      };
    case "payout_ready":
      /*
       * Sin datos de la cuenta. Un correo con el número de cuenta de alguien es la forma exacta de
       * toda estafa de pagos que existe, y saldría de un dominio en el que el inquilino confía.
       */
      return {
        title: "Ya puedes pagar el primer canon",
        body: `${who} indicó por dónde recibir el primer canon del arriendo de ${property}. Los datos están en la etapa del primer canon.`,
      };
    case "receipt_uploaded":
      return {
        title: "Llegó el comprobante del primer canon",
        body: notification.detail
          ? `${sentence(`${who} subió el comprobante del primer canon de ${property}: ${notification.detail}`)} Revísalo y confirma si el dinero llegó.`
          : `${who} subió el comprobante del primer canon de ${property}. Revísalo y confirma si el dinero llegó.`,
      };
    case "receipt_rejected":
      return {
        title: "Rechazaron el comprobante",
        body: notification.detail
          ? `${sentence(`${who} rechazó el comprobante del primer canon de ${property}: ${notification.detail}`)} Sube otro corrigiendo eso.`
          : `${who} rechazó el comprobante del primer canon de ${property}. Sube otro.`,
      };
    case "canon_confirmed":
      return {
        title: "El propietario confirmó el primer canon",
        body: `${who} confirmó que recibió el primer canon del arriendo de ${property}. Con eso el arriendo queda en curso.`,
      };
    case "documents_requested":
      return {
        title: "Te piden tus documentos",
        body: `Para seguir con ${property} necesitas subir tu documento de identidad y el soporte de tus ingresos.`,
      };
    case "application_approved":
      return {
        title: "Tu postulación fue aprobada",
        body: `${who} aceptó tu postulación a ${property}. El siguiente paso es firmar el contrato.`,
      };
    case "application_rejected":
      return {
        title: "Tu postulación fue rechazada",
        body: `${who} no continuará con tu postulación a ${property}, en la etapa "${STAGE_LABELS[notification.stage]}".`,
      };
    case "application_withdrawn":
      return {
        title: "El inquilino retiró su postulación",
        body: `${who} retiró su postulación a ${property}, en la etapa "${STAGE_LABELS[notification.stage]}".`,
      };
    case "stage_advanced":
      return {
        title: `Avanzaste a "${STAGE_LABELS[notification.stage]}"`,
        body: `El proceso de ${property} pasó a la etapa "${STAGE_LABELS[notification.stage]}".`,
      };
    case "lease_started":
      return {
        title: "Tu arriendo quedó en curso",
        body: `El arriendo de ${property} ya está andando. En "Arriendos" vas a ver mes a mes lo que se paga y lo que falta.`,
      };
    case "canon_payout_changed":
      /*
       * Sin los datos de la cuenta, por lo mismo que el primer canon: un correo con el número de
       * cuenta de alguien es la forma exacta de toda estafa de pagos que existe, y saldría de un
       * dominio en el que el inquilino confía. Que hay datos nuevos se avisa; cuáles son se lee en
       * la página, detrás de la sesión.
       */
      return {
        title: "Cambiaron los datos para pagar el canon",
        body: `${who} cambió por dónde recibe el canon de ${property}. Míralos en el arriendo antes de transferir el próximo mes.`,
      };
    case "canon_receipt_uploaded":
      return {
        title: "Llegó el comprobante del canon",
        body: month
          ? `${who} subió el comprobante del canon de ${month} de ${property}. Revísalo y confirma si el dinero llegó.`
          : `${who} subió el comprobante de un canon de ${property}. Revísalo y confirma si el dinero llegó.`,
      };
    case "canon_receipt_rejected":
      return {
        title: "Rechazaron el comprobante del canon",
        body: notification.detail
          ? `${sentence(`${who} rechazó el comprobante del canon de ${month || property}: ${notification.detail}`)} Sube otro corrigiendo eso.`
          : `${who} rechazó el comprobante del canon de ${month || property}. Sube otro.`,
      };
    case "canon_paid":
      return {
        title: "El propietario confirmó el canon",
        body: month
          ? `${who} confirmó que recibió el canon de ${month} de ${property}.`
          : `${who} confirmó que recibió el canon de ${property}.`,
      };
    case "incident_reported":
      /*
       * El título, que es el `detail`, y nunca la descripción ni un adjunto. Lo que sale del
       * producto en un correo es lo mínimo que sigue llevando a alguien a la página: la descripción
       * es lo que el inquilino escribió sobre su casa con algo roto dentro, y un correo se reenvía
       * y se queda abierto en un portátil.
       */
      return {
        title: "El inquilino reportó un incidente",
        body: notification.detail
          ? `${sentence(`${who} reportó un incidente en ${property}: ${notification.detail}`)} Ábrelo en el arriendo para ver la descripción y los archivos.`
          : `${who} reportó un incidente en ${property}. Ábrelo en el arriendo para ver qué pasó.`,
      };
    case "incident_in_progress":
      return {
        title: "Están arreglando el incidente",
        body: notification.detail
          ? `${sentence(`${who} puso en arreglo un incidente de ${property}: ${notification.detail}`)}`
          : `${who} puso en arreglo un incidente de ${property}.`,
      };
    case "incident_awaiting_confirmation":
      /*
       * La única de las cinco que es una **tarea**, y por eso es la que dice qué hacer: sin la
       * confirmación del inquilino el incidente no se cierra, porque si la ducha funciona lo sabe
       * quien se ducha. Un aviso que no distingue una tarea de una noticia se ignora.
       */
      return {
        title: "Dicen que ya arreglaron lo que reportaste",
        body: notification.detail
          ? `${sentence(`${who} dice que arregló el incidente de ${property}: ${notification.detail}`)} Revísalo y confirma si de verdad quedó bien.`
          : `${who} dice que arregló el incidente de ${property}. Revísalo y confirma si de verdad quedó bien.`,
      };
    case "incident_resolved":
      return {
        title: "El incidente quedó resuelto",
        body: `${who} confirmó que el incidente de ${property} quedó arreglado.`,
      };
    case "incident_withdrawn":
      return {
        title: "El inquilino cerró el incidente",
        body: notification.detail
          ? `${sentence(`${who} cerró un incidente de ${property}: ${notification.detail}`)}`
          : `${who} cerró un incidente que había reportado en ${property}.`,
      };
    case "incident_comment":
      return {
        title: "Hay un mensaje nuevo en un incidente",
        body: notification.detail
          ? `${sentence(`${who} escribió sobre un incidente de ${property}: ${notification.detail}`)}`
          : `${who} escribió sobre un incidente de ${property}.`,
      };
  }
}

/**
 * The anchor of one stage inside the process page.
 *
 * It is what makes a notification land *on the step it is about* instead of at the top of a
 * page with nine of them — which is the difference between an email you act on and an email you
 * have to go looking inside.
 */
export function stageAnchor(stage: Stage): string {
  return `etapa-${stage.replace(/_/g, "-")}`;
}

/**
 * The notifications that are about the tenancy rather than about the process that produced it.
 *
 * **Derived from the type, not stored beside it** — the same choice the words already make. A
 * notification written a month ago points wherever that screen lives today, and there is no second
 * field that could disagree with the first about which of the two pages this one is about.
 */
const LEASE_NOTIFICATION_TYPES: readonly NotificationType[] = [
  "lease_started",
  "canon_payout_changed",
  "canon_receipt_uploaded",
  "canon_receipt_rejected",
  "canon_paid",
  "incident_reported",
  "incident_in_progress",
  "incident_awaiting_confirmation",
  "incident_resolved",
  "incident_withdrawn",
  "incident_comment",
];

export function isLeaseNotification(type: NotificationType): boolean {
  return LEASE_NOTIFICATION_TYPES.includes(type);
}

/**
 * Where a notification takes you.
 *
 * The process, at the stage it is about — or the tenancy, at the month it is about. Both ids are
 * the same string: a lease id **is** its application id, so nothing extra has to be stored to know
 * which document to open, only which page shows it.
 */
export function notificationPath(
  notification: Pick<Notification, "applicationId" | "stage" | "type"> & {
    readonly period?: string;
    readonly incident?: string;
  },
): string {
  if (isLeaseNotification(notification.type)) {
    /*
     * A month or a report, and never both: the two are different sections of the tenancy, and a
     * notification is about one thing. The incident is checked first only because a report has no
     * month — if a future notification ever carried the two, the one it is *about* would have to be
     * decided from the type, as everything else here already is.
     */
    const anchor = notification.incident
      ? `#${incidentAnchor(notification.incident)}`
      : notification.period
        ? `#${periodAnchor(notification.period)}`
        : "";

    return `${rentalRoute(notification.applicationId)}${anchor}`;
  }

  return `${applicationRoute(notification.applicationId)}#${stageAnchor(notification.stage)}`;
}

/** `hace 5 minutos`, in words a person reads without doing arithmetic. */
export function relativeTime(iso: string, now: Date): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(elapsed / 60_000);

  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`;

  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} ${days === 1 ? "día" : "días"}`;

  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}
