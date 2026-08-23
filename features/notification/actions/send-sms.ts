import "server-only";

// Not `"use server"`: a module marked that way publishes every export as an endpoint, and this
// one sends SMS to phone numbers, which costs money per call.

/**
 * One SMS, over Twilio's REST API.
 *
 * ## Why Twilio, and why no SDK
 *
 * **The Vercel Marketplace has no SMS provider** — its `messaging` category offers Resend, which is
 * email — so this cannot be provisioned the way the rest of this product's integrations are: no
 * automatic env vars, no unified billing, and the account is the user's to create. Twilio is the
 * direct choice; nothing here is Twilio-shaped beyond three env vars, so replacing it is one file.
 *
 * No SDK, for the same reason `send-email.ts` has none: sending is a `POST` with three fields, and
 * a dependency that wraps `fetch` is a dependency to keep upgraded.
 *
 * ## What this is not
 *
 * An SMS one-time code is **the weakest of the three channels** and was added on request after that
 * was said plainly: SIM swap is the standard attack against exactly this, deliverability in Colombia
 * is worse than WhatsApp's, and every message has a price. It is offered only when configured, and
 * the panel never presents it as the recommended option.
 */
export type Sms = {
  /** E.164, as this product stores every phone. */
  readonly to: string;
  readonly body: string;
};

/**
 * `true` when Twilio accepted it. **Never throws**, like the other two senders: the caller decides
 * what a failure means, and here it means telling the person to use another channel.
 */
export async function sendSms(message: Sms): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();

  if (!sid || !token || !from) {
    /*
     * The body is **not** logged: it carries the one-time code. That is the difference from the
     * email sender, which logs its subject so the flow can be exercised locally — a subject is a
     * line of copy, and this is a credential. What gets logged is that nothing was sent.
     */
    console.info(`[sms] Twilio is not configured, not sent. To: ${masked(message.to)}`);

    return false;
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
        body: new URLSearchParams({ To: message.to, From: from, Body: message.body }).toString(),
      },
    );

    if (response.ok) return true;

    /*
     * The status and Twilio's own message, never the body we sent. A 400 here is usually a number
     * that cannot receive SMS or a sender not permitted for the destination country — both of which
     * are worth reading, and neither of which needs the code in the log to be understood.
     */
    console.error(`[sms] Twilio answered ${response.status}: ${(await response.text()).slice(0, 200)}`);

    return false;
  } catch (error) {
    console.error("[sms] could not reach Twilio:", error instanceof Error ? error.message : error);

    return false;
  }
}

/** Enough to tell two recipients apart in a log, not enough to be a phone number. */
function masked(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  return digits.length < 4 ? "•••" : `${"•".repeat(Math.max(3, digits.length - 4))}${digits.slice(-4)}`;
}
