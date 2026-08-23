/**
 * The WhatsApp message for a reminder, as a shape a test can read.
 *
 * WhatsApp does not let a business write whatever it likes: a message sent outside the 24-hour
 * window that a person's own message opens **has to be a template approved by Meta beforehand**,
 * with the variable parts passed as parameters. So this does not render prose — it renders the
 * arguments of a template, and the words themselves live in the WhatsApp Business account.
 *
 * That is also why the sender skips quietly when it is not configured: the template has to exist
 * on Meta's side before a single message can leave, and a product that cannot send email or
 * WhatsApp should still be able to run a rental process.
 */
export type WhatsAppTemplateMessage = {
  /** E.164, no `+` needed by the API but harmless. */
  readonly to: string;
  readonly template: string;
  readonly locale: string;
  /** In the order the template declares them. */
  readonly parameters: readonly string[];
};

/**
 * The reminder's parameters: what the call is about, and when it is.
 *
 * Two, in that order, so one template serves both reminders — the sentence around them is
 * Meta's, and asking a business to keep two approved templates in step for a difference of a few
 * hours is asking for the day they disagree.
 */
export function interviewReminderMessage({
  to,
  propertyTitle,
  when,
  template,
  locale,
}: {
  readonly to: string;
  readonly propertyTitle: string;
  readonly when: string;
  readonly template: string;
  readonly locale: string;
}): WhatsAppTemplateMessage {
  return {
    to,
    template,
    locale,
    // Trimmed and collapsed: WhatsApp rejects a parameter with a newline or a tab in it.
    parameters: [clean(propertyTitle), clean(when)],
  };
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
