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
