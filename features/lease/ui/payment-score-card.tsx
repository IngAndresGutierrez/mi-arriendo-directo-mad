import { StarIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import {
  HISTORY_BAND_LABELS,
  MIN_RATED_MONTHS,
  starsLabel,
  type PaymentScore,
  type PaymentScoreDetail,
} from "../domain/payment-score";

/**
 * Las estrellas.
 *
 * **Cinco iconos no son un mensaje para quien no los ve**, así que la nota va también en palabras
 * como nombre accesible del grupo. Es la misma regla que ya sigue el contador de la campana: lo que
 * nunca falla es el texto.
 */
function Stars({ stars, size = "size-5" }: { readonly stars: number; readonly size?: string }) {
  return (
    <span role="img" aria-label={starsLabel(stars)} className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((position) => (
        <StarIcon
          key={position}
          aria-hidden="true"
          className={cn(
            size,
            position <= stars
              ? "fill-brand-panel text-brand-panel"
              : "fill-transparent text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

/**
 * Lo que ve **el propietario**, en una postulación cuyo inquilino lo autorizó.
 *
 * Toma un `PaymentScore` y no un `PaymentScoreDetail`: el tipo recortado no **contiene** los
 * conteos, así que este componente no puede publicarlos ni por descuido. Es la mitad estructural de
 * la promesa "nunca verán los pagos" — la otra mitad son las estrellas enteras, porque un decimal
 * sobre un número de meses conocido se despeja.
 */
export function PaymentScoreCard({ score }: { readonly score: PaymentScore }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-semibold text-foreground">Cumplimiento de pago</h3>

      {score.stars === null ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {HISTORY_BAND_LABELS.none}. Esta persona todavía no ha arrendado {MIN_RATED_MONTHS} meses
          por esta plataforma, así que no hay nada que calificar.{" "}
          <span className="text-foreground">No es una nota baja: es ninguna nota.</span>
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Stars stars={score.stars} />
            <span className="text-sm text-muted-foreground">
              {HISTORY_BAND_LABELS[score.band].toLowerCase()}
            </span>
          </div>
          {/*
            Qué es la nota, y qué **no**. Sin esta frase la insignia significa lo que cada quien
            quiera — la misma disciplina que la de propietario verificado.
          */}
          <p className="mt-3 text-sm text-muted-foreground">
            Sale de los cánones que otros propietarios confirmaron haber recibido dentro de la
            plataforma, dando más peso a los meses recientes.{" "}
            <span className="text-foreground">
              No verás los pagos ni las fechas: eso es de tu inquilino, no tuyo.
            </span>
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Lo que ve **el inquilino sobre sí mismo**, con los conteos.
 *
 * **Que pueda verla no es una cortesía, es la Ley 1581**: una nota que la persona calificada no
 * puede consultar ni controvertir es precisamente lo que el hábeas data regula. Aquí sí van los
 * números, porque son su propio dato — la ironía del diseño es que se le pueden ocultar los pagos
 * al propietario y **no** se le puede ocultar la nota al inquilino.
 */
export function OwnPaymentScoreCard({ score }: { readonly score: PaymentScoreDetail }) {
  return (
    <section
      aria-labelledby="cumplimiento-heading"
      className="rounded-2xl border border-border bg-card p-5"
    >
      <h2 id="cumplimiento-heading" className="font-semibold text-primary dark:text-foreground">
        Tu cumplimiento de pago
      </h2>

      {score.stars === null ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Todavía no tienes {MIN_RATED_MONTHS} meses de arriendo pagados por esta plataforma, así que
          no hay nota.{" "}
          <span className="text-foreground">
            Eso no cuenta en tu contra: sin historial, no se muestra ninguna nota.
          </span>
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Stars stars={score.stars} size="size-6" />
            <span className="text-sm text-muted-foreground">
              {HISTORY_BAND_LABELS[score.band].toLowerCase()}
            </span>
          </div>

          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">A tiempo</dt>
              <dd className="mt-0.5 font-medium text-foreground">{score.onTime}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Con retraso</dt>
              <dd className="mt-0.5 font-medium text-foreground">{score.late}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Sin pagar</dt>
              <dd className="mt-0.5 font-medium text-foreground">{score.missed}</dd>
            </div>
          </dl>
        </>
      )}

      <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
        Un propietario solo la ve si tú lo autorizas en esa postulación, y nunca ve los pagos ni las
        fechas. Cuentan los meses que el propietario confirmó haber recibido; los que están
        esperando su confirmación no cuentan en tu contra. Si algo aquí no cuadra con lo que pasó,
        escríbenos y lo revisamos.
      </p>
    </section>
  );
}
