import { STAGE_LABELS, type Stage } from "@/features/application/client";

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
  "application_approved",
  "application_rejected",
  "application_withdrawn",
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
export function notificationCopy(
  notification: Pick<Notification, "type" | "stage" | "propertyTitle" | "actorName"> & {
    readonly detail?: string;
  },
): { readonly title: string; readonly body: string } {
  const who = notification.actorName || "Alguien";
  const property = notification.propertyTitle;

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

/** Where a notification takes you: the process, at the stage it is about. */
export function notificationPath(
  notification: Pick<Notification, "applicationId" | "stage">,
): string {
  return `/contrato/${notification.applicationId}#${stageAnchor(notification.stage)}`;
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
