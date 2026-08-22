import "server-only";

// Not `"use server"`: a module marked that way publishes every export as an endpoint, and this
// one sends email. It is called by Server Actions, never by a form.
import type { Email } from "../domain/email";

/**
 * Where a notification email goes out through: **Resend**, over its REST API.
 *
 * No SDK. Sending is a `POST` with five JSON fields, and a dependency added for that is a
 * dependency to keep auditing for the rest of the project's life. The key comes from
 * `RESEND_API_KEY`, which the Vercel integration provisions.
 *
 * **Without a key nothing breaks.** The email is written to the log and the action carries on:
 * that is what lets the whole flow be exercised locally without mailing anyone, and what stops
 * a half-configured deploy from failing an application because it could not announce it.
 *
 * **It never throws.** By the time this runs the write is already saved. A failed email leaves
 * someone not yet informed — bad, but recoverable by opening the app — while an exception would
 * surface as if the action itself had failed and send whoever reads the logs looking for a bug
 * in the wrong place.
 */
const ENDPOINT = "https://api.resend.com/emails";

/**
 * Resend allows **2 requests per second**, and only the 429 is retried. That distinction is the
 * whole design: a 429 is the answer to a request the API refused without sending anything, so
 * repeating it cannot duplicate an email. A 500 or a dropped connection are ambiguous — the
 * email may well have gone out — and retrying there is how somebody gets told the same news
 * twice. It is also why no idempotency key is needed: the only retry there is cannot duplicate.
 */
const MAX_ATTEMPTS = 4;
const BACKOFF_MS = 600;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Who it comes from.
 *
 * `no-responder@` rather than `hola@`, because nobody reads what comes back: an address that
 * looks attended and is not is worse than one that says so.
 *
 * The domain is read from `RESEND_EMAIL_DOMAIN` — the variable the integration sets with the
 * domain it verified — and not written by hand. Resend answers **403** when the `from` domain
 * is not exactly one of the verified ones, and that is the failure that slips through most
 * easily: nothing errors until a real email fails to leave. Deriving it from the same variable
 * that provisions the domain makes them impossible to drift apart.
 */
function sender(): string {
  const configured = process.env.EMAIL_FROM?.trim();
  if (configured) return configured;

  const domain = process.env.RESEND_EMAIL_DOMAIN?.trim() || "miarriendodirecto.com";

  return `miarriendoDIRECTO <no-responder@${domain}>`;
}

/** `true` when Resend accepted it. Never throws; see the note above. */
export async function sendEmail(email: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();

  if (!key) {
    console.info(`[email] no RESEND_API_KEY, not sent. To: ${email.to} · Subject: ${email.subject}`);

    return false;
  }

  const body = JSON.stringify({
    from: sender(),
    to: [email.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body,
      });

      if (response.ok) return true;

      if (response.status === 429 && attempt < MAX_ATTEMPTS) {
        await wait(BACKOFF_MS * attempt);
        continue;
      }

      // The body names which of the usual failures it is — unverified domain, a `from` that
      // does not match, a revoked key — and every one of them is fixed outside this code.
      console.error(`[email] Resend answered ${response.status}: ${await response.text()}`);

      return false;
    } catch (error) {
      console.error("[email] could not send:", error);

      return false;
    }
  }

  console.error(`[email] gave up after repeated 429s. To: ${email.to}`);

  return false;
}
