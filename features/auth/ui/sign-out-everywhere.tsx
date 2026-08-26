"use client";

import type { Dictionary } from "@/shared/i18n";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";

import { signOutUser } from "@/shared/auth/client";
import { LOGIN_ROUTE } from "@/shared/auth/routes";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";

/**
 * Cerrar la sesión en todos los dispositivos.
 *
 * Es `signOutUser()`, el mismo del menú, y no hace falta nada más: ese camino ya llama a
 * `DELETE /api/session`, que **revoca los refresh tokens** de la cuenta antes de borrar la cookie.
 * Revocarlos invalida toda sesión abierta en cualquier navegador, no solo esta.
 *
 * **Y por eso también cierra la de aquí, que es lo honesto y no un efecto secundario.** Firebase no
 * ofrece "revoca las otras y deja la mía": revocar es por cuenta. Podría volverse a sellar la cookie
 * de este navegador inmediatamente después, pero quien pulsa esto suele hacerlo porque cree que
 * alguien más entró — y en esa situación lo correcto es que no quede ninguna sesión en pie,
 * incluida la de un portátil que a lo mejor tampoco es suyo. El diálogo lo dice antes.
 */
export function SignOutEverywhere({
  copy,
}: {
  /**
   * The copy this renders, resolved by the page. A prop and not a dictionary import: this is a
   * Client Component, and importing `shared/i18n/dictionary` here would put **both** languages into
   * the browser bundle.
   */
  readonly copy: Dictionary["auth"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="xl" onClick={() => setOpen(true)}>
        <LogOutIcon aria-hidden="true" />
        {copy.signOutEverywhereButton}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={copy.signOutEverywhereTitle}
        description={copy.signOutEverywhereBody}
        confirmLabel={copy.signOutEverywhereConfirm}
        pendingLabel={copy.signOutEverywherePending}
        onConfirm={async () => {
          await signOutUser();
          router.replace(LOGIN_ROUTE);
          router.refresh();
        }}
      />
    </>
  );
}
