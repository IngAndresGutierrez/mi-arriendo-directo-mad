import type { Metadata } from "next";

import { listPendingVerifications, VerificationQueue } from "@/features/property";
import { requireRole } from "@/shared/auth/session";
import { adminStorage } from "@/shared/firebase/admin";

export const metadata: Metadata = {
  title: "Verificaciones",
  /*
   * **Sin `robots` propio.** Está dentro de `(app)`, cuyo layout ya lo declara, y los metadatos se
   * fusionan **por campo**: un objeto aquí reemplazaría el del layout entero, que es exactamente
   * como dos pantallas de este producto perdieron el `nofollow` en silencio.
   */
};

/**
 * The reviewer's queue, and **the only administration screen in this product**.
 *
 * **Dentro de `(app)`, con el resto del portal**, y esa fue la segunda corrección: la primera versión
 * vivía fuera razonando que no es una sección del producto de nadie. Cierto — y con la entrada en el
 * menú se volvió una trampa: se entraba y el menú desaparecía, así que la única salida era el botón
 * atrás del navegador. Una entrada de menú que lleva a una pantalla sin menú es un callejón.
 *
 * `requireRole("admin")` la cierra entera, y la entrada solo se le enseña a quien puede abrirla
 * (`showVerifications` en `ProductChrome`), que es lo que hace que ofrecerla no sea anunciar un sitio
 * cerrado.
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
    <div className="mx-auto w-full max-w-3xl">
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
