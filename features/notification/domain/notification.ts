import type { Stage } from "@/features/application/client";
import { dictionaryFor } from "@/shared/i18n/dictionary";
import type { Locale } from "@/shared/i18n/locale";
import { handoverAnchor, incidentAnchor, periodAnchor, periodLabel } from "@/features/lease/client";
import {
  ERRANDS_ROUTE,
  HOME_ROUTE,
  applicationRoute,
  rentalRoute,
} from "@/shared/auth/routes";

/**
 * What happened. One type per movement of a rental process, from the point of view of whoever
 * is being told about it.
 *
 * `documents_requested` and `application_approved` are stage movements that also arrive as
 * `stage_advanced` would — they are their own type because what they ask of the reader is
 * different. "Avanzaste a Datos y documentos" is a status line; "te piden tus documentos" is a
 * task, and a notification that does not say which of the two it is gets ignored.
 *
 * `application_approved` outlived the stage it was named after: `approved` is gone as a step, and
 * the sentence is now sent on landing on `contract_signature`, which is the same decision. The
 * words are what the tenant was waiting for and they did not stop being true.
 */
export const NOTIFICATION_TYPES = [
  "application_received",
  "stage_advanced",
  "documents_requested",
  "document_rejected",
  "check_findings",
  "visit_proposed",
  "visit_confirmed",
  "visit_declined",
  /*
   * Two types for one field, and the copy is why — the lesson the incidents already paid for.
   * "Le interesó el inmueble" is a task for the landlord (the process can move on) and "no le
   * interesó" is the end of it, and one `visit_answered` carrying the result inside would be a
   * notification nobody can act on without opening the page to find out which of the two it is.
   */
  "visit_interested",
  "visit_not_interested",
  /*
   * The collaborator's errand: somebody the landlord asked to show one of their properties.
   *
   * These four are the only notifications in the product that are **not about a process**, which is
   * why they carry `collaboration` instead of `applicationId` and why `notificationPath` has to
   * branch on the type before it reads either. Two of them land on the collaborator's own screen
   * and two on the landlord's roster — derivable from the type, like everything else here.
   */
  "collaborator_invited",
  "collaborator_accepted",
  "collaborator_declined",
  "collaborator_revoked",
  /*
   * Lo que el colaborador hace con un encargo, y va al **propietario**.
   *
   * Tres tipos y no un `errand_updated` con el resultado dentro, por la misma razón que las
   * visitas: la copia es el punto. "Confirmó que va" es una preocupación menos; "no puede" es una
   * tarea urgente —hay que buscar a otro antes del jueves—; "ya lo hizo" es un cierre. Un solo
   * tipo obligaría a leer el cuerpo para saber cuál de las tres cosas pasó, y una notificación que
   * no dice qué pasó es una que se ignora.
   */
  "errand_accepted",
  "errand_declined",
  "errand_completed",
  /*
   * A visit arranged by a collaborator rather than by the owner, and it is its own type because the
   * copy is the point: the tenant is being told a **stranger** will meet them at a door, and
   * "Carlos propone el jueves" without saying who Carlos is reads like a wrong number.
   */
  "visit_proposed_by_collaborator",
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
  /*
   * Los tres recordatorios de un canon, y son tres tipos y no un `canon_reminder` con los días
   * dentro por la razón de siempre: la copia es el punto. "Prepara el pago" es una nota, "vence
   * hoy" es una tarea y "estás en mora" es una mala noticia que además tiene que oír el
   * propietario. Un solo tipo obligaría a abrir la app para saber cuál de las tres es.
   *
   * A diferencia de los otros diez de esta lista, **nadie los provoca**: los dispara un cron.
   */
  "canon_due_soon",
  "canon_due_today",
  "canon_overdue",
  /*
   * El acta de entrega. Tres tipos y no un `handover_updated`, por lo de siempre: "revísala" es una
   * tarea del inquilino, "la aceptó" es un cierre para el propietario y "puso observaciones" es una
   * tarea urgente que además trae el motivo dentro. Un solo tipo obligaría a abrir la app para
   * saber cuál de las tres cosas pasó.
   */
  "handover_submitted",
  "handover_accepted",
  "handover_objected",
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
  /**
   * Which collaboration, on the four notifications that are about one.
   *
   * Here for the same reason `period` and `incident` are: it is what the link needs. And like both
   * of them it must be copied in `toNotification` — a field added to the document without a line in
   * that converter is a field the bell never sees, which is the bug that left every month's anchor
   * dead for as long as the anchors had existed.
   */
  readonly collaboration?: string;
  /**
   * Which acta, on the three notifications that are about one. `checkin` or `checkout`.
   *
   * Here for the same reason `period` and `incident` are: it is what the link needs, so an aviso
   * about the acta lands on the acta instead of at the top of a page with four tabs on it. And like
   * both of them it **must be copied in `toNotification`** — a field added to the document without a
   * line in that converter is a field the bell never sees, which is the bug that left every month's
   * anchor dead for as long as the anchors had existed.
   */
  readonly handover?: string;
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
/**
 * "entrega" o "devolución", según de cuál de las dos actas habla el aviso.
 *
 * Se lee del campo y no del tipo porque los tres tipos sirven a las dos actas: el corte está en de
 * qué acta se habla, no en qué pasó con ella. Un aviso viejo sin el campo dice "entrega", que es la
 * que existía primero — la misma dirección en la que fallan `localeFor` y `allowsChannel`.
 */
function actaWord(notification: { readonly handover?: string }): string {
  return notification.handover === "checkout" ? "devolución" : "entrega";
}

function sentence(text: string): string {
  const trimmed = text.trim();

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function notificationCopy(
  notification: Pick<Notification, "type" | "stage" | "propertyTitle" | "actorName"> & {
    readonly detail?: string;
    readonly period?: string;
    readonly handover?: string;
  },
  /**
   * Whose language this is written in.
   *
   * **The recipient's, never the request's.** A notification is read by the party that did *not*
   * cause it, so the locale of whoever pressed the button is the wrong one — the same rule the email
   * chrome around these words already follows. Callers resolve it from `users/{uid}.locale`.
   */
  locale: Locale,
): { readonly title: string; readonly body: string } {
  const stageLabels = dictionaryFor(locale).application.stageLabels;
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
    case "visit_proposed":
      /*
       * Cuándo, y **nunca dónde**. El punto de encuentro es el único campo del proceso que entrega
       * la dirección, y un correo se reenvía, se cita y se queda abierto en un portátil — la misma
       * regla que mantiene los datos de la cuenta fuera de las notificaciones del canon. Que hay
       * visita se avisa; dónde es se lee en la página, detrás de la sesión.
       */
      return {
        title: "Te proponen un día para conocer el inmueble",
        body: notification.detail
          ? `${who} propone ${notification.detail} para que conozcas ${property}. Confirma el día o pide otro; el punto de encuentro está en la etapa de la visita.`
          : `${who} propuso un día para que conozcas ${property}. Confirma el día o pide otro.`,
      };
    case "visit_confirmed":
      return {
        title: "La visita quedó confirmada",
        body: notification.detail
          ? `${who} confirmó ${notification.detail} para conocer ${property}.`
          : `${who} confirmó el día para conocer ${property}.`,
      };
    case "visit_declined":
      return {
        title: "Ese día no le sirve para la visita",
        body: notification.detail
          ? `${who} no puede el día propuesto para conocer ${property}. ${notification.detail}`
          : `${who} no puede el día propuesto para conocer ${property}. Propón otro.`,
      };
    case "visit_interested":
      return {
        title: "Al inquilino le interesó el inmueble",
        body: notification.detail
          ? `${sentence(`${who} visitó ${property} y le interesa: ${notification.detail}`)} Ya puedes continuar con el proceso.`
          : `${who} visitó ${property} y le interesa. Ya puedes continuar con el proceso.`,
      };
    case "visit_not_interested":
      /*
       * La que para el proceso, y se dice sin rodeos: el propietario está esperando en una página a
       * algo que ya pasó, y lo que necesita saber es que no va a pasar. Sin reproche —decidir que
       * un inmueble no es para uno después de verlo es exactamente para lo que existe la visita— y
       * diciendo qué queda por hacer, que es cerrar o volver a intentarlo.
       */
      return {
        title: "Al inquilino no le interesó el inmueble",
        body: notification.detail
          ? `${sentence(`${who} visitó ${property} y no le interesa: ${notification.detail}`)} El proceso no sigue: puedes rechazar la postulación o proponer otra visita.`
          : `${who} visitó ${property} y no le interesa. El proceso no sigue: puedes rechazar la postulación o proponer otra visita.`,
      };
    case "visit_proposed_by_collaborator":
      /*
       * Quién, y **en nombre de quién**. Al inquilino le va a abrir la puerta alguien que no es el
       * dueño, y un aviso que solo dice "Carlos propone el jueves" se lee como un número
       * equivocado. No nombra al propietario porque no hace falta —"en nombre del propietario"
       * dice la relación— y sigue sin decir dónde: eso se lee en la página.
       */
      return {
        title: "Te van a mostrar el inmueble",
        body: notification.detail
          ? `${who} propone ${notification.detail} para mostrarte ${property} en nombre del propietario. Confirma el día o pide otro; el punto de encuentro está en la etapa de la visita.`
          : `${who} propuso un día para mostrarte ${property} en nombre del propietario. Confirma el día o pide otro.`,
      };
    /*
     * Las tres del encargo. `detail` lleva el título —"Mostrar el apartamento"— porque el
     * propietario puede tener varios encargos abiertos a la vez y "Carlos aceptó" no dice cuál.
     *
     * En la de rechazo el motivo va **dentro del cuerpo**: es lo único que le permite decidir qué
     * hacer a continuación, y obligarle a abrir la pantalla para leerlo convierte un aviso en un
     * recado. Es la misma razón por la que un documento rechazado manda el motivo y uno aprobado no.
     */
    case "errand_accepted":
      return {
        title: "Confirmaron tu encargo",
        body: `${who} confirmó que va${notification.detail ? `: ${notification.detail}` : ""}.`,
      };
    case "errand_declined":
      return {
        title: "No pueden con el encargo",
        body: notification.detail
          ? `${who} no puede: ${notification.detail}. Busca a alguien más o cambia la fecha.`
          : `${who} no puede con el encargo. Busca a alguien más o cambia la fecha.`,
      };
    case "errand_completed":
      return {
        title: "Terminaron el encargo",
        body: `${who} marcó el encargo como terminado${notification.detail ? `: ${notification.detail}` : ""}.`,
      };
    case "collaborator_invited":
      /*
       * Lo que hay que decir es **qué le están pidiendo** y sobre qué inmueble: "te invitaron a
       * colaborar" no dice si va a abrir una puerta o a firmar algo. Y que hace falta aceptar,
       * porque sin eso la invitación no da acceso a nada.
       */
      return {
        title: "Te pidieron ayuda con un inmueble",
        body: `${who} te pidió ayuda para mostrar ${property}. Acéptalo en "Encargos" para poder agendar las visitas.`,
      };
    case "collaborator_accepted":
      return {
        title: "Aceptaron ayudarte",
        body: `${who} aceptó ayudarte a mostrar ${property}. Ya puede proponer las visitas.`,
      };
    case "collaborator_declined":
      return {
        title: "No aceptaron ayudarte",
        body: `${who} no va a ayudarte con ${property}. Puedes invitar a otra persona.`,
      };
    case "collaborator_revoked":
      /*
       * Sin reproche y sin adornos: retirar un acceso es una decisión normal del propietario, y
       * quien lo recibe necesita saber que ya no tiene que ir a ninguna puerta.
       */
      return {
        title: "Ya no colaboras en ese inmueble",
        body: `${who} retiró tu acceso a ${property}. No tienes que hacer nada más ahí.`,
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
      /*
       * **Ya no se manda**, y se queda: hay notificaciones con este tipo guardadas, y un tipo que
       * el switch no cubre es una campana con el cuerpo vacío. Lo que lo sustituyó es
       * `lease_started`, que dice lo mismo y además lleva al arriendo en vez de al proceso, que
       * desde ese momento no tiene nada que hacer.
       */
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
        body: `${who} no continuará con tu postulación a ${property}, en la etapa "${stageLabels[notification.stage]}".`,
      };
    case "application_withdrawn":
      return {
        title: "El inquilino retiró su postulación",
        body: `${who} retiró su postulación a ${property}, en la etapa "${stageLabels[notification.stage]}".`,
      };
    case "stage_advanced":
      return {
        title: `Avanzaste a "${stageLabels[notification.stage]}"`,
        body: `El proceso de ${property} pasó a la etapa "${stageLabels[notification.stage]}".`,
      };
    case "lease_started":
      /*
       * La confirmación del primer canon y el arranque del arriendo son un solo hecho desde que no
       * hay un botón entre los dos, así que se cuentan en una sola frase: quien la recibe necesita
       * saber que le confirmaron el pago *y* dónde va a vivir el arriendo a partir de ahora.
       */
      return {
        title: "Tu arriendo quedó en curso",
        body: `${who} confirmó que recibió el primer canon de ${property}. El proceso terminó: en "Arriendos" vas a ver mes a mes lo que se paga y lo que falta.`,
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
    /*
     * Los tres del canon. Ninguno nombra a nadie: no los causó una persona, los causó el
     * calendario — igual que los dos de la entrevista, y por eso `actorName` llega vacío y estas
     * frases no lo usan.
     *
     * **Ninguno lleva la cuenta bancaria**, que es la misma regla que ya sigue `payout_ready`: un
     * correo con el número de cuenta de alguien dentro es la forma de toda estafa de pagos, y el
     * nuestro llegaría desde un dominio que el inquilino se cree. Dónde pagar se lee en la página,
     * detrás de la sesión.
     */
    case "canon_due_soon":
      return {
        title: "Tu canon vence pronto",
        body: month
          ? `El canon de ${month} de ${property} vence en unos días. Puedes pagarlo y subir el comprobante desde el arriendo.`
          : `Se acerca el vencimiento de un canon de ${property}. Págalo y sube el comprobante desde el arriendo.`,
      };
    case "canon_due_today":
      return {
        title: "Tu canon vence hoy",
        body: month
          ? `Hoy vence el canon de ${month} de ${property}. Sube el comprobante cuando hagas la transferencia.`
          : `Hoy vence un canon de ${property}. Sube el comprobante cuando hagas la transferencia.`,
      };
    case "canon_overdue":
      return {
        title: "Hay un canon en mora",
        body: month
          ? `El canon de ${month} de ${property} está vencido y no se ha registrado el pago. Ábrelo en el arriendo.`
          : `Hay un canon vencido en ${property} sin pago registrado. Ábrelo en el arriendo.`,
      };
    /*
     * Las tres del acta de entrega. El acta dice en qué estado está la casa de alguien; lo que sale
     * del producto es lo mínimo que sigue llevando a la página, igual que con un incidente.
     */
    case "handover_submitted":
      return {
        title: `El propietario preparó el acta de ${actaWord(notification)}`,
        body: `Revisa espacio por espacio cómo quedó registrado ${property} y acéptala o deja tus observaciones.`,
      };
    case "handover_accepted":
      return {
        title: `El inquilino aceptó el acta de ${actaWord(notification)}`,
        body: `${who || "El inquilino"} confirmó que el acta de ${property} coincide con lo que ve.`,
      };
    case "handover_objected":
      /*
       * El motivo sí viaja, a diferencia de la descripción de un incidente: viene acotado a mil
       * caracteres y es lo único con lo que el propietario decide si corrige el acta o llama. Sin él
       * el aviso sería un mensaje diciendo que hay un mensaje.
       */
      return {
        title: `El inquilino puso observaciones al acta de ${actaWord(notification)}`,
        body: notification.detail
          ? sentence(`${who || "El inquilino"} respondió sobre ${property}: ${notification.detail}`)
          : `${who || "El inquilino"} dejó observaciones sobre el acta de ${property}. Ábrela para leerlas.`,
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
  "canon_due_soon",
  "canon_due_today",
  "canon_overdue",
  "handover_submitted",
  "handover_accepted",
  "handover_objected",
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
 * The notifications that are about a **collaboration** rather than about a process.
 *
 * They are the only ones in the product with no application behind them, so they carry an empty
 * `applicationId` and `notificationPath` has to answer before it reads it. Which of the two screens
 * they land on is derived from the type — invited and revoked reach the collaborator, accepted and
 * declined reach the landlord — because the recipient is not a field this function can see.
 */
const COLLABORATION_NOTIFICATION_TYPES: readonly NotificationType[] = [
  "collaborator_invited",
  "collaborator_accepted",
  "collaborator_declined",
  "collaborator_revoked",
  "errand_accepted",
  "errand_declined",
  "errand_completed",
];

/** Las tres que sí se emiten hoy, y todas llegan al propietario: su lista de encargos. */
const ERRAND_NOTIFICATION_TYPES: readonly NotificationType[] = [
  "errand_accepted",
  "errand_declined",
  "errand_completed",
];

export function isCollaborationNotification(type: NotificationType): boolean {
  return COLLABORATION_NOTIFICATION_TYPES.includes(type);
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
    readonly handover?: string;
  },
): string {
  /*
   * Checked first, and before anything reads `applicationId`: these four have none.
   *
   * **Nothing sends them any more** — the invitation flow they belonged to is gone, along with both
   * screens they used to point at. They stay in the union and keep their copy for the same reason
   * `canon_confirmed` does: there are stored notifications of these types, and a type the switch
   * does not cover is a bell with an empty body. What changed is where they land, because
   * `/encargos` and `/colaboradores` no longer exist and a bell that opens a 404 is worse than one
   * that opens the home screen.
   */
  if (isCollaborationNotification(notification.type)) {
    /*
     * Los tres de encargo llevan a la lista del propietario, que es donde se gestionan. Los cuatro
     * viejos ya no los emite nadie y sus dos pantallas no existen, así que caen en el inicio: una
     * campana que abre un 404 es peor que una que abre la portada.
     */
    return ERRAND_NOTIFICATION_TYPES.includes(notification.type) ? ERRANDS_ROUTE : HOME_ROUTE;
  }

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
        : notification.handover
          ? `#${handoverAnchor(notification.handover)}`
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
