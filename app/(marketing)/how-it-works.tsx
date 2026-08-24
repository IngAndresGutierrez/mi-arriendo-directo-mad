import Link from "next/link";

import { PROPERTIES_ROUTE, PUBLISH_PROPERTY_ROUTE } from "@/shared/auth/routes";
import { Button } from "@/shared/ui/button";

import { HOW_IT_WORKS_ANCHOR } from "@/app/public-header";

/**
 * The process, told from both sides at once.
 *
 * **Two columns rather than a tab strip or a single "cómo funciona".** This is a two-sided market
 * and the two sides do different things at the same seven stages — the sentence that tells the
 * tenant to wait for a call is the sentence that tells the landlord to make it, which is exactly
 * why `STAGE_DESCRIPTIONS` and `STAGE_DESCRIPTIONS_LANDLORD` exist as two lists in the domain. A
 * tab would hide half of that behind a click, and the half it hides is the half that answers "and
 * what does the other person have to do?", which is the question keeping somebody from starting.
 *
 * The steps are a compression of the real stages, not a parallel invention: `submitted`,
 * `tenant_data`, `background_check`, `interview`, `guarantee`, `contract_signature` and
 * `first_payment`, with the tenancy that opens after the first canon. Nothing here promises a step
 * the product does not have.
 */
export function HowItWorks() {
  return (
    <section
      id={HOW_IT_WORKS_ANCHOR}
      /* The sticky header would otherwise land on top of this heading when the anchor is followed. */
      className="scroll-mt-20 py-16 sm:py-20"
    >
      <div className="mx-auto w-full max-w-6xl px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-primary sm:text-4xl dark:text-foreground">
          Cómo funciona
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          El mismo proceso, visto desde cada lado. Avanza etapa por etapa y las dos partes ven
          siempre en qué punto va.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Column
            eyebrow="Si buscas arriendo"
            title="Del inmueble a las llaves"
            steps={[
              "Busca en el catálogo y postúlate al inmueble que te sirve. Tu perfil se arma una sola vez y sirve para la siguiente postulación.",
              "Sube tus documentos e ingresos. El propietario los aprueba o te dice qué le falta, con el motivo escrito.",
              "Se acuerda una entrevista: el propietario propone día y canal, y tú confirmas. Sin confirmación no hay cita.",
              "Firmas el contrato con un código de un solo uso y transfieres el primer canon desde tu banco, con su soporte.",
            ]}
            action={{ href: PROPERTIES_ROUTE, label: "Ver inmuebles", variant: "brand" }}
          />

          <Column
            eyebrow="Si tienes un inmueble"
            title="De la publicación al primer canon"
            steps={[
              "Publica gratis. La dirección exacta y la matrícula inmobiliaria quedan privadas: el aviso muestra el barrio y una zona, nunca el punto.",
              "Recibe postulaciones con el perfil completo del inquilino y revísalo aquí mismo, documento por documento.",
              "Consulta los antecedentes con la autorización del inquilino, haz la entrevista y define si va con póliza de arrendamiento.",
              "Sube el contrato, ambos firman en línea y confirmas el primer canon cuando llegue a tu cuenta. Ahí empieza el arriendo.",
            ]}
            action={{ href: PUBLISH_PROPERTY_ROUTE, label: "Publicar inmueble", variant: "brand" }}
          />
        </div>

        <p className="mt-8 max-w-3xl text-sm text-muted-foreground">
          Después de la firma el arriendo sigue aquí: mes a mes, con el soporte de cada pago y los
          arreglos que el inquilino reporta. Esta plataforma no recibe ni transfiere el dinero —
          el pago va directo del inquilino al propietario y aquí queda el registro.
        </p>
      </div>
    </section>
  );
}

function Column({
  eyebrow,
  title,
  steps,
  action,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly steps: readonly string[];
  readonly action: { readonly href: string; readonly label: string; readonly variant: "brand" };
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-6 sm:p-8">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-xl font-semibold text-balance text-primary dark:text-foreground">
        {title}
      </h3>

      {/*
        An ordered list, because the order is the content: these are stages that happen one after
        another, and a screen reader announcing "list of 4 items" instead of "1 of 4" loses the one
        thing the numbers are carrying. The numeral is drawn rather than left to the marker so it
        can sit in the brand chip, and it is `aria-hidden` so it is not read twice.
      */}
      <ol className="mt-6 flex-1 space-y-5">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-4">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-primary dark:text-foreground"
            >
              {index + 1}
            </span>
            <p className="pt-1 text-sm leading-relaxed text-muted-foreground">{step}</p>
          </li>
        ))}
      </ol>

      <Button asChild variant={action.variant} size="xl" className="mt-8 w-full sm:w-fit">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    </div>
  );
}
