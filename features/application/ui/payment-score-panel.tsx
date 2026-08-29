"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PaymentScoreCard, type PaymentScore } from "@/features/lease/client";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { PRIVACY_RIGHTS_ANCHOR } from "@/shared/auth/routes";
import { NewTabLink } from "@/shared/ui/new-tab-link";

import { authorizePaymentScore } from "../actions/authorize-score";

/**
 * El cumplimiento de pago del inquilino, dentro del proceso.
 *
 * **La nota sale de arriendos con OTROS propietarios**, así que enseñársela a este es una
 * comunicación de datos personales a un tercero y una finalidad distinta de la que se autorizó al
 * registrarse — aquella cubre gestionar *este* arriendo, no contarle a un desconocido cómo se pagó
 * otro. Por eso se pide aparte, en esta pantalla, por proceso y con fecha: la misma forma exacta que
 * `authorizeBackgroundChecks`, deliberadamente.
 *
 * **Y sin autorización el propietario no ve la nota, no una nota vacía.** La diferencia importa: un
 * componente que recibiera el `PaymentScore` y decidiera no pintarlo seguiría teniéndolo en la
 * carga RSC de la página, que es donde este producto ya se ha quemado dos veces. Aquí `score` llega
 * `null` desde el servidor cuando no hay permiso, así que no hay nada que filtrar.
 */
export function PaymentScorePanel({
  applicationId,
  score,
  authorized,
  isLandlord,
}: {
  readonly applicationId: string;
  /** `null` cuando el inquilino no lo ha autorizado: la página no lo manda, no es que no se pinte. */
  readonly score: PaymentScore | null;
  readonly authorized: boolean;
  readonly isLandlord: boolean;
}) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (authorized) {
    return (
      <div className="space-y-2">
        {score ? <PaymentScoreCard score={score} /> : null}
        {/*
          Al inquilino se le enseña **lo mismo que ve el propietario**, y se le dice que es eso.
          Enseñarle otra cosa —o nada— le dejaría adivinando qué compartió, que es justo lo que una
          autorización informada no puede permitirse.
        */}
        {!isLandlord ? (
          <p className="text-sm text-muted-foreground">
            Autorizaste compartir tu cumplimiento de pago con este propietario. Esto es exactamente
            lo que él ve: la nota y nada más.
          </p>
        ) : null}
      </div>
    );
  }

  if (isLandlord) {
    return (
      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
        Tu inquilino todavía no ha autorizado compartir su cumplimiento de pago. Se lo pedimos en
        esta misma pantalla; sin su permiso no lo verás, y no verlo no dice nada de él.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-4">
      <p className="text-sm text-muted-foreground">
        Si has arrendado por esta plataforma, tenemos una calificación de cumplimiento de pago
        construida con los cánones que otros propietarios confirmaron haber recibido. Puedes
        compartirla con este propietario: verá <strong className="text-foreground">solo la nota</strong>{" "}
        —de una a cinco estrellas— y nunca tus pagos, sus montos ni sus fechas.
      </p>
      <div className="flex items-start gap-2.5">
        <Checkbox
          id="authorize-score"
          checked={accepted}
          onCheckedChange={(checked) => setAccepted(checked === true)}
          disabled={pending}
          className="mt-0.5"
        />
        <Label htmlFor="authorize-score" className="block text-sm leading-relaxed font-normal">
          Autorizo a{" "}
          <strong className="font-medium text-foreground">el propietario de este inmueble</strong> a
          ver mi calificación de cumplimiento de pago para este proceso de arriendo. Puedo consultar
          mi calificación en Mi perfil y ejercer mis derechos en la{" "}
          <NewTabLink href={PRIVACY_RIGHTS_ANCHOR} className="underline underline-offset-4">
            política de tratamiento
          </NewTabLink>
          .
        </Label>
      </div>
      <Button
        type="button"
        variant="brand"
        size="xl"
        disabled={!accepted || pending}
        onClick={() =>
          start(async () => {
            const result = await authorizePaymentScore(applicationId);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            router.refresh();
          })
        }
      >
        {pending ? "Autorizando…" : "Compartir mi calificación"}
      </Button>
      {/*
        Y **compartirla es opcional**: el proceso no se bloquea por no hacerlo. Este producto existe
        para que un arriendo no se detenga en un requisito que la mitad de la gente no puede cumplir,
        y una nota obligatoria sería el codeudor otra vez con otro nombre.
      */}
      <p className="text-xs text-muted-foreground">
        Es opcional. Si no la compartes, el proceso sigue igual.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
