import type { Metadata } from "next";

import { listPendingVerifications, VerificationQueue } from "@/features/property";
import { requireRole } from "@/shared/auth/session";
import { adminStorage } from "@/shared/firebase/admin";

export const metadata: Metadata = {
  title: "Verificaciones",
  /* Behind an admin guard, but the crawler never gets that far — say it anyway, like `(app)`. */
  robots: { index: false, follow: false },
};

/**
 * The reviewer's queue, and **the only administration screen in this product**.
 *
 * It sits outside `(app)` on purpose: it is not a section of anybody's portal. `requireRole("admin")`
 * closes it entirely, and putting it in the menu would announce a place two of the three roles
 * cannot enter — the same reason `/colaborador` lives outside the portal rather than as a section
 * of it.
 *
 * **The signing happens here and not in the component.** A certificado de tradición carries the full
 * street address and the owner's identity, so the file is denied to every client by `storage.rules`
 * and reachable only through a URL the server signs for an hour. What the component receives is the
 * record plus a map of links — the fourth time this module draws that line, and for the same reason:
 * a URL that could not be signed must cost the file, not the row.
 */
export default async function VerificationsPage() {
  await requireRole("admin");

  const rows = await listPendingVerifications();

  const signed = await Promise.all(
    rows.flatMap((row) =>
      row.documents.map(async (document) => [document.path, await sign(document.path)] as const),
    ),
  );
  const links = Object.fromEntries(
    signed.filter((one): one is [string, string] => one[1] !== null),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        Verificaciones
      </h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Cada solicitud trae el certificado de tradición y libertad del inmueble. Se aprueba cuando
        quien publica figura en él como propietario, y solo eso: la insignia no dice nada del estado
        del inmueble ni responde por el arriendo.
      </p>

      <VerificationQueue rows={rows} links={links} />
    </div>
  );
}

const LINK_TTL_MS = 60 * 60 * 1000;

async function sign(path: string): Promise<string | null> {
  try {
    const [url] = await adminStorage()
      .bucket()
      .file(path)
      .getSignedUrl({ action: "read", expires: Date.now() + LINK_TTL_MS });

    return url;
  } catch (error) {
    // One unreadable certificate must not take the whole queue down.
    console.error(`could not sign ${path}:`, error);

    return null;
  }
}
