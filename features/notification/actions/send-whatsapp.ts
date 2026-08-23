import "server-only";

// Not `"use server"`: a module marked that way publishes every export as an endpoint, and this
// one sends messages to phone numbers.
import type { WhatsAppTemplateMessage } from "../domain/whatsapp";

/**
 * WhatsApp, through Meta's **Cloud API**.
 *
 * No SDK: it is a `POST` with a JSON body, and the alternative is a dependency to audit for the
 * rest of the project's life — the same reasoning as Resend.
 *
 * **It needs three things that only exist outside this repository**: a WhatsApp Business phone
 * number (`WHATSAPP_PHONE_NUMBER_ID`), a token for it (`WHATSAPP_TOKEN`) and a **message
 * template approved by Meta** (`WHATSAPP_TEMPLATE`). Business-initiated messages cannot be free
 * text: outside the 24-hour window a person's own message opens, only an approved template
 * leaves. Until those exist the message is logged and the sweep carries on, exactly like email
 * without a key — a reminder that cannot go out must not stop the other two channels.
 *
 * **It never throws**, for the same reason `notify` does not: by the time it runs, what mattered
 * is already written.
 */
const VERSION = "v21.0";

export async function sendWhatsApp(message: WhatsAppTemplateMessage): Promise<boolean> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const token = process.env.WHATSAPP_TOKEN?.trim();

  if (!phoneNumberId || !token) {
    console.info(
      `[whatsapp] sin credenciales, no se envió. Para: ${message.to} · plantilla: ${message.template} · ${message.parameters.join(" | ")}`,
    );
    return false;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/${VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: message.to,
        type: "template",
        template: {
          name: message.template,
          language: { code: message.locale },
          components: [
            {
              type: "body",
              parameters: message.parameters.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      // The body carries Meta's reason — a template not approved, a number not opted in — and
      // without it every failure looks the same from the logs.
      console.error(`[whatsapp] Meta respondió ${response.status}: ${await response.text()}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[whatsapp] no se pudo enviar:", error instanceof Error ? error.message : error);
    return false;
  }
}

/** The template to use, and the language it was approved in. */
export function whatsAppTemplate(): { readonly template: string; readonly locale: string } {
  return {
    template: process.env.WHATSAPP_TEMPLATE?.trim() || "interview_reminder",
    locale: process.env.WHATSAPP_TEMPLATE_LOCALE?.trim() || "es_CO",
  };
}
