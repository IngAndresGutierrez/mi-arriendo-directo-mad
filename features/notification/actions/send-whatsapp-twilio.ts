import "server-only";

// Not `"use server"`: a module marked that way publishes every export as an endpoint, and this one
// sends WhatsApp messages, which cost money per message.

/**
 * One WhatsApp message, over **Twilio**.
 *
 * ## Why a second WhatsApp sender exists
 *
 * `send-whatsapp.ts` sends through **Meta's** Graph API and needs a WhatsApp Business account, a
 * phone number id, a token and a template approved by Meta. This one sends through Twilio, which is
 * the account this project actually has — and the same account `send-sms.ts` already uses, so the
 * collaborator's two channels are one provider, one bill and one set of credentials.
 *
 * The Meta sender is deliberately left alone rather than migrated. Its callers are the interview
 * reminders and the signature code, both of which are configured against templates that may already
 * be approved there; swapping the provider under them is a separate change with its own way of
 * failing silently. If Meta turns out never to have been configured, moving those callers here is
 * one import each — and that is the moment to delete one of the two files rather than now.
 *
 * ## The rule that catches everybody
 *
 * **A business-initiated WhatsApp message cannot be free text.** Outside the 24-hour window that a
 * person's own message opens, WhatsApp only delivers an approved template — this is WhatsApp's rule,
 * not Twilio's, so it holds whichever provider is used. Two consequences:
 *
 * - With `TWILIO_WHATSAPP_TEMPLATE_SID` set, this sends that template with its variables, which is
 *   what works for an encargo landing on somebody who has not written to us in days.
 * - Without it, this sends plain text, which is delivered **only** inside an open 24-hour window or
 *   from the Twilio sandbox to a number that joined it. That is enough to develop against and not
 *   enough to rely on, so it says so in the log rather than looking like it worked.
 *
 * Never throws, like the other three senders: the caller decides what a failure means, and here it
 * means the SMS is the one that has to arrive.
 */
export type WhatsAppMessage = {
  /** E.164, as this product stores every phone. The `whatsapp:` prefix is added here. */
  readonly to: string;
  /** Used when no template is configured, and as the SMS fallback's wording upstream. */
  readonly body: string;
  /**
   * Ordered template variables, when a template is configured. Twilio numbers them from "1".
   * Kept as a list rather than an object so the call site cannot silently reorder them.
   */
  readonly variables?: readonly string[];
};

/** `true` when Twilio accepted it. */
export async function sendWhatsAppTwilio(message: WhatsAppMessage): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim();

  if (!sid || !token || !from) {
    // The body is not logged: an encargo names a property and a person. Only that nothing was sent.
    console.info(`[whatsapp] Twilio is not configured, not sent. To: ${masked(message.to)}`);

    return false;
  }

  const template = process.env.TWILIO_WHATSAPP_TEMPLATE_SID?.trim();

  const form: Record<string, string> = {
    To: `whatsapp:${message.to}`,
    From: `whatsapp:${from}`,
  };

  if (template) {
    form.ContentSid = template;
    if (message.variables?.length) {
      form.ContentVariables = JSON.stringify(
        Object.fromEntries(message.variables.map((value, index) => [String(index + 1), value])),
      );
    }
  } else {
    form.Body = message.body;
    console.info(
      "[whatsapp] no TWILIO_WHATSAPP_TEMPLATE_SID: sending free text, which WhatsApp only delivers " +
        "inside an open 24-hour window or from the sandbox.",
    );
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          // Basic auth with the account SID as the user and the token as the password.
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(form).toString(),
      },
    );

    if (response.ok) return true;

    /*
     * Twilio's own message, never what we sent. A 63016 here means exactly the rule above — free
     * text outside the 24-hour window — and reading that code is how somebody finds out they need
     * the template, so it is worth keeping in the log.
     */
    console.error(
      `[whatsapp] Twilio answered ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );

    return false;
  } catch (error) {
    console.error("[whatsapp] could not reach Twilio:", error instanceof Error ? error.message : error);

    return false;
  }
}

/** Enough to tell two recipients apart in a log, not enough to be a phone number. */
function masked(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  return digits.length < 4 ? "•••" : `${"•".repeat(Math.max(3, digits.length - 4))}${digits.slice(-4)}`;
}
