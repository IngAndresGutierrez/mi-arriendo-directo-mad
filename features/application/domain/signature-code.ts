/**
 * What the one-time code says, in each channel.
 *
 * Pure and here so it can be tested without sending anything: what somebody receives is decided
 * by a function with inputs and outputs, not by watching an inbox.
 */
import { OTP_LENGTH, OTP_TTL_MS } from "./contract";

const MINUTES = Math.round(OTP_TTL_MS / 60_000);

/**
 * The subject and body of the email carrying the code.
 *
 * **The code is the only thing in here that matters, so it is the only thing emphasised.** No
 * link: a signature request that arrives with a button to click is indistinguishable from the
 * phishing it would teach people to accept. The person is already on the page; the code goes to
 * the page, not the page to the code.
 */
export function signatureCodeEmail(input: {
  readonly code: string;
  readonly propertyTitle: string;
  readonly recipientName: string;
}): { readonly subject: string; readonly text: string; readonly html: string } {
  const subject = `Tu código para firmar: ${input.code}`;

  const text = [
    `Hola ${input.recipientName || "".trim()}`.trim() + ",",
    "",
    `Tu código para firmar el contrato de arrendamiento de ${input.propertyTitle} es:`,
    "",
    input.code,
    "",
    `Vence en ${MINUTES} minutos y solo sirve una vez. Escríbelo en la página donde lo pediste.`,
    "",
    "Si no fuiste tú, ignora este mensaje: sin el código nadie puede firmar por ti.",
  ].join("\n");

  const html = [
    `<p>Hola ${escapeHtml(input.recipientName)},</p>`,
    `<p>Tu código para firmar el contrato de arrendamiento de <strong>${escapeHtml(input.propertyTitle)}</strong> es:</p>`,
    `<p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:24px 0">${escapeHtml(input.code)}</p>`,
    `<p>Vence en ${MINUTES} minutos y solo sirve una vez. Escríbelo en la página donde lo pediste.</p>`,
    `<p style="color:#666">Si no fuiste tú, ignora este mensaje: sin el código nadie puede firmar por ti.</p>`,
  ].join("");

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The two parameters an approved WhatsApp template receives: the property and the code.
 *
 * Business-initiated WhatsApp messages outside the 24-hour window a person's own message opens
 * **cannot be free text**, so the wording lives in the WhatsApp Business account and this only
 * passes the values. Its own template — `WHATSAPP_OTP_TEMPLATE` — because Meta approves a
 * template for a purpose, and the interview reminder is a different purpose with different words.
 */
export function signatureCodeWhatsAppParameters(input: {
  readonly code: string;
  readonly propertyTitle: string;
}): readonly string[] {
  return [input.propertyTitle, input.code];
}

/** How long the code lasts, as the copy says it. One source for the number. */
export const OTP_MINUTES = MINUTES;

/** Digits only, exactly `OTP_LENGTH`, drawn from a cryptographic source by the caller. */
export function formatCode(value: number): string {
  return String(value % 10 ** OTP_LENGTH).padStart(OTP_LENGTH, "0");
}
