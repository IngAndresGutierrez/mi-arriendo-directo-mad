/**
 * Cumplimiento de pago: doce meses de historial convertidos en una nota de cinco estrellas.
 *
 * **El problema que resuelve es el requisito que frena la mitad de los arriendos en Colombia**: el
 * codeudor con finca raíz. Un inquilino que pagó doce meses a tiempo tiene una prueba de que es
 * buen pagador y hoy no tiene forma de enseñarla; este producto sí tiene el registro, porque cada
 * mes confirmado es un acto que el propietario ya hizo.
 *
 * ## La regla de tres no sirve, y aquí está por qué
 *
 * `10/12 × 5 = 4,2` parece razonable hasta que se mira lo que hace en los bordes:
 *
 * - **`1/1` a tiempo daría 5 estrellas y `0/1` daría 0.** Un solo dato no puede producir ni el
 *   juicio máximo ni la condena. Lo arregla la **suavización**: la nota parte de una expectativa
 *   previa (`PRIOR_RATE`) con un peso de `PRIOR_WEIGHT` meses imaginarios, y los meses reales la
 *   van moviendo. Con pocos datos la nota se parece a la expectativa; con muchos, al historial.
 * - **No tiene memoria del tiempo.** Tres atrasos en 2024 pesarían igual que tres el trimestre
 *   pasado, así que nadie se recupera nunca — y quien no puede recuperarse tampoco tiene incentivo
 *   para mejorar. Lo arregla el **decaimiento**: cada mes pesa la mitad cada `HALF_LIFE_MONTHS`.
 * - **Es binaria.** Dos días tarde y cuarenta días tarde contarían igual. Lo arregla la
 *   **severidad**: tres tramos, no dos.
 *
 * ## Y el defecto que la mataba: la nota **es** el historial
 *
 * Con la regla de tres, un propietario que ve "4,2 estrellas" y sabe que hay 12 meses despeja
 * `4,2/5 × 12 = 10,08` y ya sabe que fueron 10 a tiempo y 2 tarde. El objetivo —"nunca verán los
 * pagos"— lo rompe una división.
 *
 * Es exactamente el razonamiento que este producto ya paga en el mapa: *una coordenada con cinco
 * decimales **es** la dirección*, y por eso existe `approximateLocation()`. La respuesta es la
 * misma, **cuantizar a propósito**:
 *
 * - **estrellas enteras**, nunca un decimal;
 * - y **jamás el denominador**: lo que sale hacia el propietario es `PaymentScore`, que lleva la
 *   nota y una franja gruesa de historial ("más de un año") y **no tiene los conteos dentro**. No
 *   es una convención: es que el tipo que cruza no los contiene, así que no hay forma de filtrarlos
 *   por descuido. Los conteos viven en `PaymentScoreDetail`, que es lo que ve el propio inquilino.
 *
 * ## Sin historial no es una nota baja
 *
 * Por debajo de `MIN_RATED_MONTHS` meses con evidencia no hay nota, y eso es un estado neutro y no
 * un cero. Este producto existe **precisamente** para que el proceso no se detenga en "consiga un
 * codeudor"; una nota que castigara al que no tiene historial reconstruiría esa barrera con otro
 * nombre.
 */
import { daysFromDue } from "./canon-reminder";
import { monthsBetween, periodState, type Period, type ScheduledMonth } from "./lease";

/**
 * Cinco días de gracia, y no son un regalo: en Colombia pagar en los primeros días del mes es lo
 * normal. Sin gracia casi nadie tendría cinco estrellas, y una nota que nadie saca es una nota en la
 * que nadie cree.
 */
export const GRACE_DAYS = 5;

/** Hasta aquí es "tarde"; más allá, el mes cuenta como no pagado a efectos de la nota. */
export const LATE_WINDOW_DAYS = 20;

/** Cada mes pesa la mitad cada año y medio. Es lo que permite recuperarse de un mal trimestre. */
export const HALF_LIFE_MONTHS = 18;

/**
 * La expectativa previa y su peso, en "meses imaginarios".
 *
 * `PRIOR_RATE` es lo que se supone de alguien de quien no se sabe nada, y `PRIOR_WEIGHT` cuánta
 * evidencia hace falta para moverla. **Los dos son una conjetura hasta que haya datos reales**, y
 * decirlo forma parte de tenerlos: calibrarlos es mirar la distribución de cumplimiento del
 * producto cuando exista, no afinar el número hasta que la curva "se vea bien".
 */
export const PRIOR_RATE = 0.85;
export const PRIOR_WEIGHT = 6;

/** Meses con evidencia antes de que haya nota. Por debajo, "sin historial" — que es neutro. */
export const MIN_RATED_MONTHS = 6;

/** Qué pasó con un mes, a efectos de la nota. */
export const PUNCTUALITY = ["on_time", "late", "missed", "pending"] as const;
export type Punctuality = (typeof PUNCTUALITY)[number];

/** Cuánto suma cada tramo. `pending` no suma ni resta: todavía no es evidencia de nada. */
const WEIGHT: Readonly<Record<Exclude<Punctuality, "pending">, number>> = {
  on_time: 1,
  late: 0.5,
  missed: 0,
};

/**
 * Cuándo se pagó de verdad un mes, o `null`.
 *
 * **La fecha que declara el inquilino, no la que confirma el propietario**, y esa es la decisión que
 * hace la nota justa. El propietario confirma cuando le da la gana: uno que tarda una semana en
 * mirar su cuenta le arruinaría la nota a quien pagó el día uno. Lo que se mide es lo que hizo el
 * inquilino.
 *
 * Y `paidOn` no es la palabra del inquilino a secas: el propietario confirmó **ese** comprobante,
 * con esa fecha y ese monto a la vista, así que es el único dato del registro que las dos partes
 * respaldaron. Cuando la fecha declarada es posterior a la subida —"pagué mañana"— es incoherente y
 * manda la subida.
 */
export function paidOnDate(stored: Pick<Period, "receipt">): string | null {
  const receipt = stored.receipt;
  if (!receipt) return null;

  const uploaded = receipt.uploadedAt.slice(0, 10);
  if (!receipt.paidOn) return uploaded;

  return receipt.paidOn <= uploaded ? receipt.paidOn : uploaded;
}

/**
 * Qué fue de un mes.
 *
 * `pending` cubre dos casos y los dos son deliberados: un mes que todavía está dentro de su gracia
 * —no es evidencia de nada— y uno con el comprobante subido esperando confirmación. El segundo
 * importa: desde el lado del inquilino el giro está hecho, y contarlo como incumplido sería
 * castigarlo por la demora del propietario. Es la misma asimetría que el paz y salvo.
 */
export function monthPunctuality(
  month: Pick<ScheduledMonth, "dueDate">,
  stored: Pick<Period, "receipt" | "verdict"> | null,
  today: string,
): Punctuality {
  const state = periodState(month, stored, today);

  if (state === "paid") {
    const paid = stored ? paidOnDate(stored) : null;
    if (!paid) return "on_time";

    const late = daysFromDue(month.dueDate, paid);
    if (late <= GRACE_DAYS) return "on_time";

    return late <= LATE_WINDOW_DAYS ? "late" : "missed";
  }

  // Todavía dentro de la gracia: no dice nada de nadie.
  if (daysFromDue(month.dueDate, today) <= GRACE_DAYS) return "pending";
  // Subido y sin respuesta: la pelota la tiene el propietario.
  if (state === "in_review") return "pending";

  return "missed";
}

/** Cuánto pesa un mes según lo lejos que quede. Reciente pesa 1; año y medio atrás, la mitad. */
export function recencyWeight(month: Pick<ScheduledMonth, "dueDate">, today: string): number {
  const ago = Math.max(0, monthsBetween(month.dueDate, today));

  return 0.5 ** (ago / HALF_LIFE_MONTHS);
}

/** Cuánto historial hay, en grueso. **Nunca el número**: ver la nota de arriba. */
export const HISTORY_BANDS = ["none", "some", "a_year_or_more"] as const;
export type HistoryBand = (typeof HISTORY_BANDS)[number];

export const HISTORY_BAND_LABELS: Readonly<Record<HistoryBand, string>> = {
  none: "Sin historial suficiente",
  some: "Con algunos meses de historial",
  a_year_or_more: "Con más de un año de historial",
};

export function historyBand(decided: number): HistoryBand {
  if (decided < MIN_RATED_MONTHS) return "none";

  return decided >= 12 ? "a_year_or_more" : "some";
}

/**
 * Lo que puede ver un propietario.
 *
 * **No lleva los conteos, y eso es estructural y no una convención.** Si el tipo los llevara, un
 * componente que renderizara el objeto entero publicaría el historial de pagos que este diseño
 * existe para no publicar — y sería el tipo de fallo que compila, pasa la revisión y solo se nota
 * cuando alguien despeja una división.
 */
export type PaymentScore = {
  /** 1 a 5, entera. `null` cuando no hay historial suficiente, que es un estado y no un cero. */
  readonly stars: number | null;
  readonly band: HistoryBand;
};

/** Lo que ve el propio inquilino, que es su dato y tiene derecho a mirarlo entero. */
export type PaymentScoreDetail = PaymentScore & {
  readonly onTime: number;
  readonly late: number;
  readonly missed: number;
  readonly decided: number;
};

/** Los cortes. Ver `paymentScoreDetail` para de dónde salen los números de la curva. */
const BANDS: readonly { readonly from: number; readonly stars: number }[] = [
  { from: 0.94, stars: 5 },
  { from: 0.87, stars: 4 },
  { from: 0.78, stars: 3 },
  { from: 0.65, stars: 2 },
  { from: 0, stars: 1 },
];

/**
 * La nota, con sus conteos: `(Σ wᵢ·dᵢ + W·P) / (Σ dᵢ + W)`.
 *
 * `wᵢ` es la severidad del mes, `dᵢ` cuánto pesa por antigüedad, `W` y `P` la expectativa previa.
 * Con pocos meses el resultado se parece a `P`; con muchos, al historial. Redondeada a estrella
 * entera **hacia abajo por tramos**, nunca a un decimal: un decimal se puede despejar.
 *
 * Un año perfecto compra las cinco estrellas; seis meses perfectos, cuatro. Es intencional —
 * la evidencia de medio año no es la de un año, y una nota que no distinguiera las dos cosas
 * estaría diciendo que sí.
 */
export function paymentScoreDetail(
  entries: readonly {
    readonly month: Pick<ScheduledMonth, "dueDate">;
    readonly stored: Pick<Period, "receipt" | "verdict"> | null;
  }[],
  today: string,
): PaymentScoreDetail {
  let weighted = 0;
  let total = 0;
  const counts = { on_time: 0, late: 0, missed: 0 };

  for (const entry of entries) {
    const punctuality = monthPunctuality(entry.month, entry.stored, today);
    if (punctuality === "pending") continue;

    const weight = recencyWeight(entry.month, today);
    weighted += WEIGHT[punctuality] * weight;
    total += weight;
    counts[punctuality] += 1;
  }

  const decided = counts.on_time + counts.late + counts.missed;
  const band = historyBand(decided);

  if (band === "none") {
    return { stars: null, band, onTime: counts.on_time, late: counts.late, missed: counts.missed, decided };
  }

  const rate = (weighted + PRIOR_WEIGHT * PRIOR_RATE) / (total + PRIOR_WEIGHT);
  const stars = BANDS.find((one) => rate >= one.from)?.stars ?? 1;

  return { stars, band, onTime: counts.on_time, late: counts.late, missed: counts.missed, decided };
}

/**
 * La misma nota, recortada a lo que puede salir hacia un propietario.
 *
 * Una función y no un `pick` en el sitio de uso: recortar en cada llamada es recordar recortar, y el
 * día que alguien no se acuerde el objeto entero cruza. Aquí la única forma de obtener un
 * `PaymentScore` es pasar por este recorte.
 */
export function toDisclosedScore(detail: PaymentScoreDetail): PaymentScore {
  return { stars: detail.stars, band: detail.band };
}

/** Cómo se dice una nota en palabras, para quien escucha la página en vez de mirar las estrellas. */
export function starsLabel(stars: number | null): string {
  return stars === null
    ? "Sin historial suficiente para calificar"
    : `${stars} de 5 estrellas en cumplimiento de pago`;
}
