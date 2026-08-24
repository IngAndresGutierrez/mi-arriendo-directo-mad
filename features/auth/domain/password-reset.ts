/**
 * Recovering a password: how often it may be asked for, and what the email says.
 *
 * Pure, like the rest of `domain/` — the Admin SDK call and the Firestore counter live in the
 * action. Both rules here are the kind that are easy to get subtly wrong and impossible to notice
 * afterwards, which is why they are separated out and tested rather than written inline.
 */
import type { Email } from "@/features/notification";

const BRAND = "miarriendoDIRECTO.com";

/**
 * Three requests per quarter of an hour, per address.
 *
 * **This exists because the endpoint sends an email to an address the caller chooses**, which is
 * the shape of two different abuses: filling somebody's inbox with password resets they did not
 * ask for, and burning the Resend quota. The second is not hypothetical here — this project's free
 * tier is **100 emails a day** and a driver run has already exhausted it once, which took real
 * notifications down with it.
 *
 * Three rather than one: a person who does not see the email checks spam, then asks again, and a
 * limit that punishes that is a limit that looks like the product is broken.
 */
export const RESET_WINDOW_MS = 15 * 60_000;
export const RESET_MAX_PER_WINDOW = 3;

/** What the counter holds between requests. `null` the first time an address is ever seen. */
export type ResetAttempts = {
  readonly count: number;
  /** Epoch millis. The window is fixed from the first request, not sliding. */
  readonly windowStartedAt: number;
};

export type ResetDecision = {
  readonly allowed: boolean;
  /** What to store afterwards. Written **whether or not it was allowed** — see the note. */
  readonly next: ResetAttempts;
};

/**
 * May this address be sent another reset email?
 *
 * A **fixed** window rather than a sliding one, and deliberately the cheaper of the two: a sliding
 * window needs the timestamp of every attempt, so the document grows with the abuse it is there to
 * stop. The cost is the usual one — six emails can straddle a boundary — which for a password reset
 * is nothing.
 *
 * **The refusal still counts.** `next` comes back with the attempt recorded even when `allowed` is
 * false, so hammering the endpoint keeps the window shut instead of letting it expire while the
 * requests keep landing. A counter that only advances on success is not a limit.
 */
export function resetThrottle(previous: ResetAttempts | null, now: number): ResetDecision {
  const expired = previous === null || now - previous.windowStartedAt >= RESET_WINDOW_MS;

  if (expired) {
    return { allowed: true, next: { count: 1, windowStartedAt: now } };
  }

  return {
    allowed: previous.count < RESET_MAX_PER_WINDOW,
    next: { count: previous.count + 1, windowStartedAt: previous.windowStartedAt },
  };
}

/**
 * The email carrying the reset link.
 *
 * **Its own template rather than `renderNotificationEmail`.** That one ends with "recibes este
 * correo porque haces parte de un proceso de arriendo", which is false here — the whole point is
 * that somebody who may have no process at all asked to get back into their account — and it links
 * to a stage of a process. What they share is the brand shell, which is what makes an email look
 * like it came from us.
 *
 * Three things in the copy are security, not tone:
 *
 * - **It says the link expires and can only be used once**, because that is what makes a forwarded
 *   screenshot of it harmless later.
 * - **It tells somebody who did not ask to ignore it**, and explicitly that their password has not
 *   changed. An unexplained reset email reads as "you have been hacked", and the panicked response
 *   is to click the link in it — which is precisely the behaviour phishing relies on.
 * - **It never says whether the account exists.** It cannot: this email is only sent when it does.
 *   The screen is where that silence has to be kept, and it is kept there.
 */
export function passwordResetEmail(to: string, link: string): Email {
  const subject = "Restablece tu contraseña";
  const intro =
    "Recibimos una solicitud para restablecer la contraseña de tu cuenta. Abre el enlace y elige una nueva.";
  const warning =
    "El enlace vence en una hora y solo sirve una vez. Si no fuiste tú, ignora este correo: tu contraseña no ha cambiado y nadie puede entrar con este mensaje.";

  const text = `${subject}

${intro}

Elegir una contraseña nueva: ${link}

${warning}

—
${BRAND}`;

  const html = `<!doctype html>
<html lang="es-CO">
  <body style="margin:0;padding:24px;background:#F8F9FA;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f2430">
    <table role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e6e8eb">
      <tr>
        <td style="padding:28px 28px 8px">
          <p style="margin:0;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#6b7280">${escapeHtml(BRAND)}</p>
          <h1 style="margin:8px 0 0;font-size:20px;line-height:1.3;color:#2D124D">${escapeHtml(subject)}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 0">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#374151">${escapeHtml(intro)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 8px">
          <a href="${escapeHtml(link)}" style="display:inline-block;background:#00E5FF;color:#08202b;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px">Elegir una contraseña nueva</a>
          <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#6b7280">
            Si el botón no funciona, copia este enlace:<br />
            <span style="color:#374151">${escapeHtml(link)}</span>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280">${escapeHtml(warning)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { to, subject, text, html };
}

/** The link goes into an `href`; everything else here is ours, but escaping is not selective. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
