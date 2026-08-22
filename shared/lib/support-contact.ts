/**
 * How to reach support.
 *
 * The two channels live here rather than inside the card that renders them: the number and
 * the address are the kind of thing that changes once and has to change everywhere, and the
 * URLs that carry them have their own rules — `wa.me` takes digits with no `+` and no
 * separators, and both the WhatsApp text and the mail subject have to be percent-encoded or
 * the first accent in "¿Tienes una duda?" truncates the parameter.
 *
 * Pure and client-safe: these are public contact details, not secrets, and the card that uses
 * them renders on the server.
 */

/** Support WhatsApp, in E.164 — the same shape a user's phone is stored in. */
export const SUPPORT_WHATSAPP_E164 = "+34656724435";

/** Support inbox. Written out because someone on a desktop wants to copy it, not click it. */
export const SUPPORT_EMAIL = "miarriendodirecto@gmail.com";

/**
 * What the WhatsApp chat opens with.
 *
 * Short on purpose: it is a draft the person is about to edit, and a long one gets deleted
 * before it gets read. It names the product because this number answers for it and a bare
 * "Hola" tells whoever picks up nothing.
 */
const WHATSAPP_GREETING = "Hola, tengo una duda sobre miarriendoDIRECTO.";

/** The subject an empty email would otherwise arrive with. */
const EMAIL_SUBJECT = "Soporte miarriendoDIRECTO";

/** `wa.me` wants the country code and the number, digits only: no `+`, no spaces. */
function digitsOf(e164: string): string {
  return e164.replace(/\D/g, "");
}

/**
 * A `wa.me` link, which opens the native app when there is one and WhatsApp Web when there
 * is not — the one form that works on a phone and on a desktop without asking which.
 */
export function supportWhatsAppUrl(message: string = WHATSAPP_GREETING): string {
  return `https://wa.me/${digitsOf(SUPPORT_WHATSAPP_E164)}?text=${encodeURIComponent(message)}`;
}

/** A `mailto:` with the subject already filled in, so support sees what it is before opening it. */
export function supportEmailUrl(subject: string = EMAIL_SUBJECT): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

/**
 * The number as a person reads it: `+34 656 724 435`.
 *
 * Grouped by the Spanish convention (3-3-3 after the country code), because that is the
 * country this number belongs to. It is display only — every link uses the E.164 form.
 */
export function supportWhatsAppDisplay(): string {
  const digits = digitsOf(SUPPORT_WHATSAPP_E164);
  const country = digits.slice(0, 2);
  const national = digits.slice(2);

  return `+${country} ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}
