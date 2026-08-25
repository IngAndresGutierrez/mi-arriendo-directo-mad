/**
 * The half of the notification module a Client Component may import: the copy and the links,
 * with none of the writing.
 */
export {
  notificationCopy,
  notificationPath,
  relativeTime,
  stageAnchor,
  type Notification,
  type NotificationType,
} from "./domain/notification";
export {
  CATEGORY_COPY,
  CHANNEL_LABELS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  channelApplies,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPreferences,
} from "./domain/preferences";
