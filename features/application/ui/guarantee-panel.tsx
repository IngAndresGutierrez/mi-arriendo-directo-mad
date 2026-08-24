"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  CheckIcon,
  ClipboardListIcon,
  CopyIcon,
  ExternalLinkIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { useRouter } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { formatCOP } from "@/shared/format/money";

import {
  recordGuaranteePolicy,
  saveGuaranteeProgress,
  setGuaranteeRequirement,
} from "../actions/guarantee";
import {
  canWaiveGuarantee,
  guaranteeState,
  isProviderLink,
  GUARANTEE_COVERAGES,
  GUARANTEE_PLAN,
  GUARANTEE_LIMIT_NOTE,
  GUARANTEE_PROVIDER,
  GUARANTEE_WAIVED_NOTE,
  GUARANTEE_WAIVED_TENANT_NOTE,
  type Guarantee,
} from "../domain/guarantee";

/**
 * The guarantee stage: a rental insurance policy instead of a co-signer.
 *
 * The policy is bought on Sura's site — this product does not sell insurance and takes nothing
 * for pointing at it — so what the panel does is the part that is actually its job: say what the
 * policy answers for, hand over the two pieces of data their form asks for (both already on this
 * screen), and keep the record of what was taken out.
 *
 * The tenant sees the same coverages and the same state. It is their default the policy insures
 * and their inbox Sura writes to, so learning about it from the landlord's phone call would be
 * finding out last about something that is about them.
 */
export function GuaranteePanel({
  applicationId,
  guarantee,
  isLandlord,
  tenantEmail,
  registryNumber,
  quote,
  readOnly = false,
}: {
  readonly applicationId: string;
  readonly guarantee: Guarantee | null;
  readonly isLandlord: boolean;
  /** The landlord's copy of what Sura asks for. Never rendered on the tenant's side. */
  readonly tenantEmail?: string;
  readonly registryNumber?: string;
  /**
   * Everything else Sura's quoter asks for, resolved on the server.
   *
   * Plain strings and numbers rather than the `Property` and `TenantDossier` objects: this is a
   * Client Component, only nine values of those two are needed, and the document type arrives as
   * its Spanish label so this module does not have to import the tenant profile's domain to
   * render one word. Absent on the tenant's side, where none of it is shown.
   */
  readonly quote?: {
    readonly rent: number;
    readonly adminFee: number;
    readonly leaseMonths: number;
    readonly department: string;
    readonly city: string;
    readonly address: string;
    readonly tenantName: string;
    readonly tenantDocumentType: string;
    readonly tenantDocumentNumber: string;
  };
  readonly readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [policyNumber, setPolicyNumber] = useState(guarantee?.policyNumber ?? "");
  const [note, setNote] = useState(guarantee?.note ?? "");
  const [tenantLink, setTenantLink] = useState(guarantee?.tenantLink ?? "");
  /** Para que el guardado sin botón sea visible. Tipado: `useState("idle")` inferiría `string` y
      dejaría pasar un `"saveed"` sin que el compilador dijera nada. */
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saved = useRef({ tenantLink: guarantee?.tenantLink ?? "", note: guarantee?.note ?? "" });
  const state = guaranteeState(guarantee);
  const waived = state === "waived";
  /*
   * El interruptor desaparece cuando ya hay póliza: ofrecerlo entonces sería ofrecer "des-comprar"
   * un seguro, y lo que de verdad haría es esconderle al inquilino una póliza de la que ya se le
   * avisó. La acción lo comprueba igual — esto es lo que evita el control, no la regla.
   */
  const canWaive = canWaiveGuarantee(guarantee);
  /*
   * Quién tiene el interruptor delante. Se calcula una vez porque lo leen dos sitios, y el segundo es
   * el que decide si repetir la consecuencia o no: la primera versión la pintaba en los dos y la
   * etapa decía dos veces la misma frase, una debajo de la otra. Es el mismo fallo que el panel de
   * documentos tuvo con su encabezado, en pequeño.
   */
  const showsSwitch = isLandlord && !readOnly && canWaive;

  /*
   * El guardado sin botón. Se dispara cuando el valor deja de cambiar, no en cada tecla: pegar un
   * enlace de seiscientos caracteres serían seiscientas escrituras. Y solo si hay algo distinto de
   * lo ya guardado y el enlace es válido — un enlace a medio pegar no se manda al servidor.
   *
   * `readOnly` lo apaga: una etapa pasada es un registro, y un efecto que escribe en una pantalla
   * que ya no se edita es un cambio que nadie pidió.
   */
  useEffect(() => {
    if (!isLandlord || readOnly) return;

    const linkChanged = tenantLink.trim() !== saved.current.tenantLink;
    const noteChanged = note.trim() !== saved.current.note;
    if (!linkChanged && !noteChanged) return;
    // Un enlace escrito a medias no es un error todavía: se espera a que esté completo.
    if (tenantLink.trim() !== "" && !isProviderLink(tenantLink)) return;
    if (tenantLink.trim() === "" && note.trim() === "") return;

    const timer = setTimeout(() => {
      setError(null);
      setSaveState("saving");
      startTransition(async () => {
        const result = await saveGuaranteeProgress(applicationId, {
          tenantLink: tenantLink.trim(),
          note: note.trim(),
        });
        if (!result.ok) {
          setSaveState("idle");
          setError(result.message ?? "No pudimos guardar el cambio.");
          return;
        }
        saved.current = { tenantLink: tenantLink.trim(), note: note.trim() };
        setSaveState("saved");
        router.refresh();
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [applicationId, isLandlord, note, readOnly, router, tenantLink]);

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "No pudimos guardar el cambio.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/*
        El interruptor va **arriba de todo**, porque es la pregunta anterior a la etapa: si este
        arriendo lleva seguro o no. Debajo de la tarjeta de coberturas se leería como una opción sobre
        la póliza que se está describiendo, y no es eso — es si hay póliza.
      */}
      {showsSwitch ? (
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {/*
                `id` + `aria-labelledby` on the switch, because `htmlFor` alone does not name it:
                a Radix `Switch` is a `<button role="switch">` and a button takes its accessible
                name from its own subtree, so this control was announced as an unnamed switch —
                on the one screen where the landlord decides whether the lease has a policy.
              */}
              <Label
                id="guarantee-required-label"
                htmlFor="guarantee-required"
                className="block text-sm font-medium"
              >
                Este arriendo lleva póliza de arrendamiento
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                La ley no exige seguro. Si vas a arrendar sin él, apágalo y el proceso sigue sin
                pedirte póliza.
              </p>
            </div>
            <Switch
              id="guarantee-required"
              aria-labelledby="guarantee-required-label"
              checked={!waived}
              disabled={pending}
              aria-describedby={waived ? "guarantee-waived-note" : undefined}
              onCheckedChange={(next) =>
                run(() => setGuaranteeRequirement(applicationId, { waived: !next }))
              }
            />
          </div>

          {/*
            La consecuencia, y sólo cuando está apagado. Es la mitad que un interruptor hace fácil
            saltarse: sin póliza no hay nada detrás del arriendo, porque la ley prohíbe el depósito
            en efectivo. No es un error, así que no va en rojo — va en morado de marca, que es como
            este producto dice "esto importa" sin decir "esto está mal".
          */}
          {waived ? (
            <p
              id="guarantee-waived-note"
              className="mt-3 rounded-lg border border-brand-panel/25 bg-brand-panel/[0.04] px-3 py-2 text-sm text-brand-panel dark:border-brand-panel-muted/30 dark:bg-brand-panel-muted/10 dark:text-brand-panel-muted"
            >
              {GUARANTEE_WAIVED_NOTE}
            </p>
          ) : null}
        </div>
      ) : null}

      {/*
        Sin póliza no se pinta el aparato de Sura: coberturas, cotizador, enlace y número de póliza
        son controles que ya no hacen nada, y un control que no cambia nada es la misma mentira que un
        "Continuar" que no continúa. Lo que queda es el registro de la decisión.
      */}
      {waived ? (
        /*
          La tarjeta del registro, **para quien no tiene el interruptor**: el inquilino, y el
          propietario cuando la etapa ya pasó. Con el interruptor delante esta tarjeta repetía palabra
          por palabra la consecuencia que ya está dentro de él, dos párrafos seguidos diciendo lo
          mismo.
        */
        showsSwitch ? null : (
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-sm font-medium text-foreground">Sin póliza de arrendamiento</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLandlord
                ? "Este arriendo va sin póliza de arrendamiento, por tu decisión en esta etapa."
                : GUARANTEE_WAIVED_TENANT_NOTE}
            </p>
            {guarantee?.note ? (
              <p className="mt-2 text-sm text-muted-foreground">{guarantee.note}</p>
            ) : null}
          </div>
        )
      ) : (
      <>
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
              state === "active"
                ? "bg-status-approved-bg text-status-approved"
                : state === "requested"
                  ? "bg-status-current-bg text-status-current"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {state === "active" && <CheckIcon className="size-3" aria-hidden="true" />}
            {GUARANTEE_PROVIDER.product} · {GUARANTEE_PROVIDER.name}
          </span>
          <span className="text-xs font-medium text-foreground">Sin codeudor</span>
        </div>

        <ul className="mt-3 space-y-1.5">
          {GUARANTEE_COVERAGES.map((coverage) => (
            <li key={coverage} className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-status-approved" aria-hidden="true" />
              <span>{coverage}</span>
            </li>
          ))}
        </ul>

        <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
          {GUARANTEE_LIMIT_NOTE}
        </p>

        {guarantee?.policyNumber && (
          <p className="mt-3 text-sm">
            <span className="text-muted-foreground">Póliza </span>
            <span className="font-medium text-foreground">{guarantee.policyNumber}</span>
          </p>
        )}
        {guarantee?.note && <p className="mt-1 text-sm text-muted-foreground">{guarantee.note}</p>}

      </div>

      {isLandlord && !readOnly ? (
        <div className="space-y-4">
          {/*
            La hoja de datos del cotizador, lista para copiar. Todo esto ya está en el sistema —
            el arriendo y la dirección con el anuncio, el documento con lo que el inquilino
            declaró, el correo con su cuenta — así que describirlo en prosa sería mandar al
            propietario a buscar en tres pantallas lo que puede leer en una.
          */}
          {/*
            La hoja va en un diálogo y no en la página: son diez filas que sólo hacen falta
            durante los minutos que el propietario está llenando el formulario de Sura, y
            dejarlas fijas empujaba fuera de la vista lo que sí se usa siempre — el botón de
            cotizar y el campo del enlace. Copiar dentro del diálogo no lo cierra, así que se
            abre una vez y se copia fila por fila.
          */}
          <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
            {/*
              El plan se queda a la vista, fuera del diálogo: es una decisión que se toma dentro
              del flujo de Sura y esconder detrás de un clic la única instrucción de la etapa es
              como no darla.
            */}
            {/*
              En morado, no en `status-current`: ese token es cian y la nota quedaba pegada encima
              del botón cian, formando un bloque donde el ojo no distingue la instrucción del CTA.
              Además esto no es un estado del proceso — es una instrucción — así que tomar
              prestado el color de "en curso" también decía algo falso.
            */}
            <p className="rounded-lg border border-brand-panel/25 bg-brand-panel/[0.04] px-3 py-2 text-sm text-brand-panel dark:border-brand-panel-muted/30 dark:bg-brand-panel-muted/10 dark:text-brand-panel-muted">
              <span className="font-semibold">Elige siempre el plan {GUARANTEE_PLAN}.</span> Es el
              que cubre la administración y la asistencia domiciliaria.
            </p>

            <div className="flex flex-wrap gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="brand" size="xl">
                    <ClipboardListIcon aria-hidden="true" />
                    Ver los datos del cotizador
                  </Button>
                </DialogTrigger>
                {/*
                  `sm:max-w-lg` porque el ancho por defecto del diálogo es `sm:max-w-sm` y una
                  dirección en una fila estrecha se trunca hasta ser inútil. El alto se limita y
                  se desplaza por dentro: a 390px estas filas no caben en la pantalla.
                */}
                <DialogContent className="sm:max-w-lg max-h-[85svh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Lo que te va a pedir el cotizador</DialogTitle>
                    <DialogDescription>
                      Cópialo de aquí. Los montos se copian sin puntos ni signo, como los pide el
                      formulario.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Del inmueble
              </p>
              <CopyRow
                label="Valor mensual del arrendamiento"
                value={quote ? formatCOP(quote.rent) : ""}
                copyValue={quote ? String(quote.rent) : ""}
              />
              <CopyRow
                label="Valor de la administración"
                value={quote ? formatCOP(quote.adminFee) : ""}
                copyValue={quote ? String(quote.adminFee) : ""}
              />
              <CopyRow
                label="Duración del contrato"
                value={quote ? `${quote.leaseMonths} meses` : ""}
                copyValue={quote ? String(quote.leaseMonths) : ""}
              />
              {/* Departamento y ciudad van por separado: son dos campos, y pegar "Caldas
                  Manizales" en el de ciudad no es lo que el formulario espera. */}
              <CopyRow label="Departamento" value={quote?.department ?? ""} />
              <CopyRow label="Ciudad" value={quote?.city ?? ""} />
              <CopyRow label="Dirección" value={quote?.address ?? ""} />
              <CopyRow label="Matrícula inmobiliaria" value={registryNumber ?? ""} />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Del inquilino
              </p>
              <CopyRow label="Nombre completo" value={quote?.tenantName ?? ""} />
              <CopyRow label="Tipo de documento" value={quote?.tenantDocumentType ?? ""} />
              <CopyRow label="Número de documento" value={quote?.tenantDocumentNumber ?? ""} />
                    <CopyRow label="Correo electrónico" value={tenantEmail ?? ""} />
                  </div>
                </DialogContent>
              </Dialog>

              {/*
                El único cian de este panel. Los demás controles de la etapa van en `brand`
                (morado) a propósito: son reales, pero ninguno es esto. Tres botones cian en una
                pantalla es no tener ninguno.
              */}
              <Button asChild variant="accent" size="xl">
                <a href={GUARANTEE_PROVIDER.quoteUrl} target="_blank" rel="noopener noreferrer">
                  Cotizar en {GUARANTEE_PROVIDER.name}
                  <ExternalLinkIcon aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>

          {/*
            El enlace con el que sigue el inquilino. El cotizador lo entrega al final y Sura se lo
            manda también por correo, pero un correo es algo que se pierde: pegándolo aquí queda en
            la página del arriendo, donde el inquilino lo va a buscar.
          */}
          <div className="space-y-2">
            <Label htmlFor="guarantee-tenant-link">Enlace de Sura para el inquilino</Label>
            <Input
              id="guarantee-tenant-link"
              type="url"
              inputMode="url"
              className="h-11"
              placeholder="https://ecomm.sura.co/seguros/hogar/arriendo/inquilino/…"
              value={tenantLink}
              maxLength={600}
              onChange={(event) => setTenantLink(event.target.value)}
            />

            <Label htmlFor="guarantee-request-note" className="block pt-2">
              Nota para el inquilino (opcional)
            </Label>
            <Input
              id="guarantee-request-note"
              className="h-11"
              placeholder="Ya la solicité, están estudiando el caso."
              value={note}
              maxLength={300}
              onChange={(event) => setNote(event.target.value)}
            />

            {/*
              Sin botón: los dos campos se guardan solos al dejar de escribir. Antes había un
              submit para cada uno, que es dos controles para un cambio y, peor, un campo que se
              puede quedar lleno y sin guardar justo cuando lo siguiente que haces es irte a la
              pestaña de Sura. Lo que sí hace falta es decir que se guardó, porque sin botón nada
              lo confirmaría.
            */}
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {saveState === "saving"
                ? "Guardando…"
                : saveState === "saved"
                  ? "Guardado. El inquilino ya lo ve."
                  : `Al terminar la cotización, ${GUARANTEE_PROVIDER.name} te da un enlace para el inquilino. Pégalo aquí: se guarda solo y le avisamos.`}
            </p>
          </div>

          {state !== "active" && (
            <div className="space-y-2">
              <Label htmlFor="guarantee-policy">Número de la póliza</Label>
              <Input
                id="guarantee-policy"
                className="h-11"
                placeholder="AR-99123"
                value={policyNumber}
                maxLength={40}
                onChange={(event) => setPolicyNumber(event.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Regístralo cuando {GUARANTEE_PROVIDER.name} expida la póliza. Sin eso el proceso no
                puede avanzar: una solicitud en estudio todavía no es una garantía.
              </p>
              <Button
                type="button"
                variant="brand"
                size="xl"
                disabled={pending || policyNumber.trim().length < 4}
                onClick={() => run(() => recordGuaranteePolicy(applicationId, { policyNumber, note }))}
              >
                {pending ? "Guardando…" : "Registrar la póliza"}
              </Button>
            </div>
          )}
        </div>
      ) : isLandlord ? (
        /*
          El propietario con la etapa ya pasada: el enlace es parte del registro y buscar con qué
          se hizo el seguro tres etapas después es una cosa normal de querer. Va aquí, en la rama
          que antes no renderizaba nada para él, y no en la tarjeta de arriba: ahí se duplicaba
          con el botón del inquilino y con el propio campo mientras la etapa estaba abierta.
        */
        guarantee?.tenantLink && (
          <a
            className="inline-flex text-sm font-medium text-brand-panel underline underline-offset-4 dark:text-brand-panel-muted"
            href={guarantee.tenantLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Proceso del inquilino en {GUARANTEE_PROVIDER.name}
          </a>
        )
      ) : (
        !isLandlord && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {state === "none"
                ? `El propietario tomará una póliza de arrendamiento con ${GUARANTEE_PROVIDER.name}. No necesitas codeudor.`
                : state === "requested"
                  ? `La póliza está en estudio. Puede que ${GUARANTEE_PROVIDER.name} te escriba a tu correo para completarlo.`
                  : "La póliza quedó activa. El siguiente paso es la firma del contrato."}
            </p>

            {/*
              Su parte del seguro. Es el único paso de esta etapa que depende del inquilino, así
              que va como acción y no como una frase: `readOnly` la deja como enlace simple,
              porque una etapa pasada es un registro y no algo que seguir haciendo.
            */}
            {guarantee?.tenantLink && (
              <div className="space-y-2 rounded-xl border border-dashed border-border p-4">
                <p className="text-sm font-medium text-foreground">Tu parte del seguro</p>
                <p className="text-sm text-muted-foreground">
                  {GUARANTEE_PROVIDER.name} también te mandó este enlace por correo. Desde aquí
                  entras directo, sin buscarlo.
                </p>
                {readOnly ? (
                  <a
                    className="inline-flex text-sm font-medium text-accent-foreground underline underline-offset-4"
                    href={guarantee.tenantLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver el proceso en {GUARANTEE_PROVIDER.name}
                  </a>
                ) : (
                  <Button asChild variant="accent" size="xl">
                    <a href={guarantee.tenantLink} target="_blank" rel="noopener noreferrer">
                      Continuar en {GUARANTEE_PROVIDER.name}
                      <ExternalLinkIcon aria-hidden="true" />
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        )
      )}

      </>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * One line of the sheet the landlord transcribes into Sura's quoter.
 *
 * `copyValue` exists because what reads well and what pastes well are not the same string: an
 * amount is shown as `$ 1.800.000` and copied as `1800000`, because Sura's field is numeric and
 * rejects the separators. When it is absent the two are the same.
 */
function CopyRow({
  label,
  value,
  copyValue,
}: {
  readonly label: string;
  readonly value: string;
  readonly copyValue?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue ?? value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // El portapapeles puede negarse (origen inseguro, permiso denegado): entonces el valor
      // queda a la vista para copiarlo a mano, que es lo que ya se ve arriba.
      setFailed(true);
    }
  }

  return (
    <div
      /* Asidero estable para la fila: sin él, apuntar a "la fila del arriendo" desde fuera
         obliga a adivinar el orden del DOM o a colgarse de una clase de Tailwind. */
      data-slot="copy-row"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2"
    >
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value || "—"}</p>
      </div>
      {value && (
        <Button type="button" variant="ghost" size="sm" onClick={copy}>
          {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
          {copied ? "Copiado" : failed ? "Cópialo a mano" : "Copiar"}
        </Button>
      )}
    </div>
  );
}
