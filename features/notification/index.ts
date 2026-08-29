/**
 * Public API of the notification module. Anything not exported here is internal.
 */
export {
  isLeaseNotification,
  notificationCopy,
  notificationPath,
  relativeTime,
  stageAnchor,
  NOTIFICATION_TYPES,
  type Notification,
  type NotificationType,
} from "./domain/notification";
export { renderNotificationEmail, type Email } from "./domain/email";
export { listNotifications, NOTIFICATION_PAGE_SIZE } from "./data/notification";
export { notify, type NotifyInput } from "./actions/notify";
export { markNotificationsRead } from "./actions/mark-read";
/*
 * Los dos canales, expuestos porque otra etapa los necesita: el código de firma se manda por
 * correo o por WhatsApp, y `notify()` no sirve para eso — es para dar noticias, no para entregar
 * una credencial que bloquea a quien no la recibe.
 */
export { sendEmail } from "./actions/send-email";
export { sendSms } from "./actions/send-sms";
export { sendWhatsApp } from "./actions/send-whatsapp";
/*
 * El de Twilio, que es otro proveedor y no un reemplazo: ver la nota en el módulo. Lo usa el
 * colaborador, cuyos dos canales —SMS y WhatsApp— salen de la misma cuenta.
 */
export { sendWhatsAppTwilio, type WhatsAppMessage } from "./actions/send-whatsapp-twilio";
export { type WhatsAppTemplateMessage } from "./domain/whatsapp";
export { NotificationBell } from "./ui/notification-bell";
/*
 * Las preferencias de avisos. El dominio es puro y también sale por `client.ts`; la lectura y la
 * pantalla se exponen aquí porque quien las compone es un Server Component.
 */
export {
  CATEGORY_COPY,
  CHANNEL_LABELS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  allowsChannel,
  categoryOf,
  channelApplies,
  normalizePreferences,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPreferences,
} from "./domain/preferences";
export { readNotificationPreferences } from "./data/preferences";
export { saveNotificationPreferences } from "./actions/save-preferences";
export { NotificationPreferencesCard } from "./ui/notification-preferences";

/**
 * Ley 2300 de 2023, for the callers that send collection contact.
 *
 * It lives in this module because the WhatsApp sender already guards itself with it — "the guard
 * is in the sender, not at each call site" — and the canon sweep needs the same answer for the
 * email half, which has no sender to hide it in.
 */
export {
  canContactForCollection,
  collectionContactBlocker,
  type ContactBlocker,
} from "./domain/contact-window";
