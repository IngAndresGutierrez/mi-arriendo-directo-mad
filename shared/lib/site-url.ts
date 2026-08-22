/**
 * Where the links inside an email point.
 *
 * An inbox has no origin of its own, so every link in a notification has to be absolute — and
 * absolute to the *right* place: a link to production in an email produced while testing on
 * localhost is a link nobody can follow, and a link to localhost in production is worse.
 *
 * The origin is taken from the request itself, which is the only thing that actually knows
 * where the person is. That means the `Host` header, and a `Host` header is written by whoever
 * is calling — so it is checked against a list of hosts this product answers on. Without that
 * check, anyone able to reach the server could make it send *its own users* an email whose
 * button points at a domain they chose, signed by the domain they trust. It is a known attack
 * with a boring name (host header poisoning) and this is the boring defence.
 */

/** Where a link goes when nothing better is known. */
export const PRODUCTION_ORIGIN = "https://www.miarriendodirecto.com";

/** The hosts this product answers on. Anything else is not us, whatever the header says. */
function isKnownHost(host: string): boolean {
  const [name] = host.split(":");
  if (!name) return false;

  // Any port: `next dev` picks another one when 3000 is taken.
  if (name === "localhost" || name === "127.0.0.1" || name === "[::1]") return true;
  if (name === "miarriendodirecto.com" || name.endsWith(".miarriendodirecto.com")) return true;
  // Vercel's per-deployment domains, which is what a preview build is reached on.
  if (name.endsWith(".vercel.app")) return true;

  return false;
}

/**
 * The origin to build links with.
 *
 * `NEXT_PUBLIC_SITE_URL` wins when it is set, because someone setting it is saying something
 * deliberate. Otherwise the request's own origin, if it comes from a host we recognise. Failing
 * both, production — the one answer that is never a dead end.
 */
export function resolveSiteUrl(request: {
  readonly host?: string | null;
  readonly proto?: string | null;
  readonly configured?: string | null;
}): string {
  const configured = request.configured?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const host = request.host?.trim();
  if (host && isKnownHost(host)) {
    // A local host is plain HTTP; anything else this product answers on is HTTPS. The header is
    // only trusted to say "http" for a host that could not be anything else.
    const local = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
    const proto = local ? (request.proto === "https" ? "https" : "http") : "https";

    return `${proto}://${host}`;
  }

  return PRODUCTION_ORIGIN;
}
