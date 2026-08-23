import {
  isLeaseNotification,
  notificationCopy,
  notificationPath,
  type Notification,
} from "./notification";

/**
 * One email, in the shape the `mail` collection takes.
 *
 * The rendering is pure and lives here so it can be tested without sending anything: what a
 * landlord receives is decided by a function with inputs and outputs, not by watching an inbox.
 */
export type Email = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
};

const BRAND = "miarriendoDIRECTO.com";

/** Escapes what goes into the HTML body. Titles and names are user input. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The email for a notification.
 *
 * Same words as the bell, plus the one thing an email has to carry that an in-app notice does
 * not: an absolute link straight to the stage it is about. Someone reading this on their phone
 * at a bus stop should be one tap from the thing they have to do.
 *
 * Plain text as well as HTML, always: a client that shows only the text part is not an edge
 * case, and an email that arrives blank is worse than one that arrives ugly.
 */
export function renderNotificationEmail(
  notification: Pick<
    Notification,
    "type" | "stage" | "propertyTitle" | "actorName" | "applicationId"
  > & { readonly detail?: string; readonly period?: string },
  to: string,
  baseUrl: string,
): Email {
  const { title, body } = notificationCopy(notification);
  const link = `${baseUrl.replace(/\/$/, "")}${notificationPath(notification)}`;
  /*
   * "Ver el proceso" y "Ver el arriendo" son dos pantallas distintas, y el botón tiene que decir a
   * cuál va: quien recibe un correo sobre el canon de octubre no está en un proceso de nueve
   * etapas, está en una tenencia que lleva meses andando.
   */
  const cta = isLeaseNotification(notification.type) ? "Ver el arriendo" : "Ver el proceso";

  const text = `${title}

${body}

${cta}: ${link}

—
${BRAND}
Recibes este correo porque haces parte de un proceso de arriendo en ${BRAND}.`;

  const html = `<!doctype html>
<html lang="es-CO">
  <body style="margin:0;padding:24px;background:#F8F9FA;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f2430">
    <table role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e6e8eb">
      <tr>
        <td style="padding:28px 28px 8px">
          <p style="margin:0;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#6b7280">${escapeHtml(BRAND)}</p>
          <h1 style="margin:8px 0 0;font-size:20px;line-height:1.3;color:#2D124D">${escapeHtml(title)}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 0">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#374151">${escapeHtml(body)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 28px">
          <a href="${escapeHtml(link)}" style="display:inline-block;background:#00E5FF;color:#08202b;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px">${cta}</a>
          <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#6b7280">
            Si el botón no funciona, copia este enlace:<br />
            <span style="color:#374151">${escapeHtml(link)}</span>
          </p>
        </td>
      </tr>
    </table>
    <p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center">
      Recibes este correo porque haces parte de un proceso de arriendo en ${escapeHtml(BRAND)}.
    </p>
  </body>
</html>`;

  return { to, subject: title, text, html };
}
