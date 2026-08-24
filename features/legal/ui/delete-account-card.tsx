"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon } from "lucide-react";

import { LOGIN_ROUTE } from "@/shared/auth/routes";
import { FormAlert } from "@/shared/form/form-alert";
import { TextField } from "@/shared/form/text-field";
import { Button } from "@/shared/ui/button";

import { deleteAccount } from "../actions/delete-account";
import { erasureBlockerMessage, erasureDeletions, erasureRetentions } from "../domain/erasure";
import type { ErasureBlocker } from "../domain/erasure";
import { ERASURE_CONFIRMATION } from "../validations/erasure";

/**
 * Deleting your own account — the derecho de supresión, as a control rather than as a paragraph.
 *
 * **It says what survives before it asks for anything.** Ley 1581 art. 9 and Decreto 1074 art.
 * 2.2.2.25.2.11 mean the right is not absolute: a signed lease belongs to two people, and erasing
 * one of them destroys the other's evidence. Somebody discovering that *after* pressing the button
 * would rightly feel misled, so the two lists are on screen and the retentions carry their reasons.
 *
 * `variant="destructive"`, never `accent`: this is the opposite of the one action a page invites.
 * And a typed word rather than `ConfirmDialog`, which every other delete in the product uses — a
 * listing can be published again, this cannot, and a dialog is dismissible by muscle memory.
 */
export function DeleteAccountCard({
  blocker,
}: {
  /** Why it cannot happen right now, computed on the server. `null` when nothing is in the way. */
  readonly blocker: ErasureBlocker | { readonly reason: "unknown" } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const blockedMessage = blocker
    ? blocker.reason === "unknown"
      ? "No pudimos revisar si tienes procesos o arriendos abiertos. Vuelve a intentarlo en un momento."
      : erasureBlockerMessage(blocker)
    : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData();
    formData.set("confirmation", confirmation);

    const result = await deleteAccount(formData);

    if (!result.ok) {
      setError(result.message ?? result.fieldErrors?.confirmation?.[0] ?? "No pudimos eliminarla.");
      setPending(false);
      return;
    }

    // The session is gone, so there is nothing behind this screen any more.
    router.replace(LOGIN_ROUTE);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-destructive/30 bg-card p-5">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Eliminar mi cuenta
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Borramos tus datos y cierras tu cuenta para siempre. No se puede deshacer.
          </p>

          {blockedMessage ? (
            <p className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
              {blockedMessage}
            </p>
          ) : !open ? (
            <Button
              type="button"
              variant="destructive"
              size="xl"
              className="mt-4"
              onClick={() => setOpen(true)}
            >
              Eliminar mi cuenta
            </Button>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Se borra</h3>
                  <ul role="list" className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                    {erasureDeletions().map((item) => (
                      <li key={item.what}>· {item.what}</li>
                    ))}
                  </ul>
                </div>

                {/*
                  Each retention with its reason. A list of exceptions to somebody's rights that
                  does not say why is a list they cannot argue with, which is the point of writing
                  them down.
                */}
                <div>
                  <h3 className="text-sm font-medium text-foreground">Se conserva</h3>
                  <ul role="list" className="mt-1.5 space-y-2 text-sm text-muted-foreground">
                    {erasureRetentions().map((item) => (
                      <li key={item.what}>
                        · {item.what}
                        <span className="mt-0.5 block text-xs">{item.why}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* `post`, though JS submits it: before hydration a form with no method is a GET. */}
              <form method="post" onSubmit={submit} noValidate className="space-y-3">
                {error ? <FormAlert>{error}</FormAlert> : null}

                <TextField
                  id="confirmation"
                  label={`Escribe ${ERASURE_CONFIRMATION} para confirmar`}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={pending}
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="xl"
                    disabled={pending}
                    onClick={() => {
                      setOpen(false);
                      setConfirmation("");
                      setError(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="destructive" size="xl" disabled={pending}>
                    {pending ? "Eliminando…" : "Eliminar definitivamente"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
