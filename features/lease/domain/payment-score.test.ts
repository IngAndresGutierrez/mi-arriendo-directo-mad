/**
 * La calificación de cumplimiento de pago.
 *
 * Lo que se afirma aquí son las cuatro cosas que la regla de tres hace mal y una quinta que la
 * mataba: que la nota **es** el historial si se puede despejar. Todo el módulo existe para que
 * ninguna de las cinco vuelva.
 */
import { describe, expect, it } from "vitest";

import {
  GRACE_DAYS,
  MIN_RATED_MONTHS,
  historyBand,
  monthPunctuality,
  paidOnDate,
  paymentScoreDetail,
  recencyWeight,
  starsLabel,
  toDisclosedScore,
} from "./payment-score";
import type { Period, ScheduledMonth } from "./lease";

const HOY = "2026-12-20";

/** El mes `n` meses antes de hoy, con vencimiento el día 5. */
function mes(atras: number): ScheduledMonth {
  const base = new Date(Date.UTC(2026, 11 - atras, 5));
  const id = base.toISOString().slice(0, 7);

  return { id, ordinal: 1, dueDate: `${id}-05`, amount: 1_800_000 };
}

/** Un mes pagado el día `paidOn`, confirmado por el propietario. */
function pagado(paidOn: string, uploadedAt = `${paidOn}T10:00:00.000Z`): Period {
  return {
    id: paidOn.slice(0, 7),
    amount: 1_800_000,
    dueDate: `${paidOn.slice(0, 7)}-05`,
    receipt: {
      path: "canon/x/a.pdf",
      fileName: "comprobante.pdf",
      contentType: "application/pdf",
      bytes: 1000,
      amount: 1_800_000,
      paidOn,
      uploadedAt,
      note: "",
    },
    verdict: { status: "confirmed", at: `${paidOn}T12:00:00.000Z`, reason: "" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const sinConfirmar = (paidOn: string): Period => ({ ...pagado(paidOn), verdict: null });

/** `cuantos` meses seguidos, todos pagados el día indicado de su mes. */
function historial(cuantos: number, dia = "04") {
  return Array.from({ length: cuantos }, (_, i) => {
    const month = mes(i);
    return { month, stored: pagado(`${month.id}-${dia}`) };
  });
}

describe("paidOnDate", () => {
  /**
   * **La fecha que declara el inquilino, no la que confirma el propietario.** Uno que tarda una
   * semana en mirar su cuenta le arruinaría la nota a quien pagó el día uno: lo que se mide es lo
   * que hizo el inquilino.
   */
  it("usa la fecha declarada, que es la que el propietario confirmó", () => {
    expect(paidOnDate(pagado("2026-11-03"))).toBe("2026-11-03");
  });

  /** "Pagué mañana" es incoherente: entonces manda la fecha en que llegó el comprobante. */
  it("no acepta una fecha de pago posterior a la subida", () => {
    const raro = pagado("2026-11-30", "2026-11-04T10:00:00.000Z");

    expect(paidOnDate(raro)).toBe("2026-11-04");
  });

  it("es null cuando no hay comprobante", () => {
    expect(paidOnDate({ receipt: null })).toBeNull();
  });
});

describe("monthPunctuality", () => {
  const noviembre = mes(1);

  it("a tiempo dentro de la gracia", () => {
    expect(monthPunctuality(noviembre, pagado(`${noviembre.id}-05`), HOY)).toBe("on_time");
    expect(monthPunctuality(noviembre, pagado(`${noviembre.id}-10`), HOY)).toBe("on_time");
  });

  /** Cinco días de gracia porque pagar en los primeros días del mes es lo normal en Colombia. */
  it("la gracia son cinco días, no cero", () => {
    expect(GRACE_DAYS).toBe(5);
    expect(monthPunctuality(noviembre, pagado(`${noviembre.id}-11`), HOY)).toBe("late");
  });

  it("tarde y muy tarde son tramos distintos", () => {
    expect(monthPunctuality(noviembre, pagado(`${noviembre.id}-20`), HOY)).toBe("late");
    expect(monthPunctuality(noviembre, pagado(`${noviembre.id}-28`), HOY)).toBe("missed");
  });

  it("un mes vencido y sin pagar cuenta como incumplido", () => {
    expect(monthPunctuality(noviembre, null, HOY)).toBe("missed");
  });

  /**
   * **Un comprobante esperando confirmación no cuenta en contra.** Desde el lado del inquilino el
   * giro está hecho; contarlo como incumplido sería castigarlo por la demora del propietario. Es la
   * misma asimetría que el paz y salvo, al revés.
   */
  it("no castiga un mes que espera la confirmación del propietario", () => {
    expect(monthPunctuality(noviembre, sinConfirmar(`${noviembre.id}-03`), HOY)).toBe("pending");
  });

  /** Y un mes todavía dentro de su gracia no es evidencia de nada. */
  it("no juzga un mes que acaba de vencer", () => {
    const esteMes = mes(0);

    expect(monthPunctuality(esteMes, null, `${esteMes.id}-07`)).toBe("pending");
  });
});

describe("recencyWeight", () => {
  /** Cada mes pesa la mitad cada año y medio: es lo que permite recuperarse de un mal trimestre. */
  it("pesa la mitad a los dieciocho meses", () => {
    expect(recencyWeight(mes(0), HOY)).toBeCloseTo(1, 2);
    expect(recencyWeight(mes(18), HOY)).toBeCloseTo(0.5, 2);
    expect(recencyWeight(mes(36), HOY)).toBeCloseTo(0.25, 2);
  });

  it("nunca pesa más que un mes de hoy", () => {
    expect(recencyWeight({ dueDate: "2027-06-05" }, HOY)).toBeLessThanOrEqual(1);
  });
});

describe("paymentScoreDetail", () => {
  /**
   * **Sin historial no es una nota baja: es ninguna nota.** Este producto existe para que el
   * proceso no se pare en "consiga un codeudor", y una nota que castigara al que no tiene historial
   * reconstruiría esa barrera con otro nombre.
   */
  it("no califica por debajo del mínimo de historial", () => {
    const poco = paymentScoreDetail(historial(MIN_RATED_MONTHS - 1), HOY);

    expect(poco.stars).toBeNull();
    expect(poco.band).toBe("none");
  });

  /**
   * **El defecto que la regla de tres tiene en los bordes.** `1/1` a tiempo daría 5 estrellas y
   * `0/1` daría 0: un solo dato no puede producir ni el juicio máximo ni la condena.
   */
  it("un solo mes no produce ni cinco estrellas ni cero", () => {
    const unoBueno = paymentScoreDetail(historial(1), HOY);
    const unoMalo = paymentScoreDetail([{ month: mes(1), stored: null }], HOY);

    expect(unoBueno.stars).toBeNull();
    expect(unoMalo.stars).toBeNull();
  });

  it("un año perfecto son cinco estrellas", () => {
    expect(paymentScoreDetail(historial(12), HOY).stars).toBe(5);
  });

  /** Medio año perfecto no es un año perfecto, y la nota lo dice. */
  it("seis meses perfectos son cuatro, no cinco", () => {
    expect(paymentScoreDetail(historial(6), HOY).stars).toBe(4);
  });

  /**
   * **La respuesta a "si 12 a tiempo son 5, ¿cuántas son 10?"**: tres, no 4,2. Dos meses de mora en
   * un año es un riesgo distinto del que la proporción lineal sugiere.
   */
  it("diez de doce a tiempo, con dos en mora, son tres estrellas", () => {
    const entries = historial(12);
    const conMora = entries.map((entry, i) =>
      i < 2 ? { month: entry.month, stored: null } : entry,
    );

    expect(paymentScoreDetail(conMora, HOY).stars).toBe(3);
  });

  /** Y dos pagos con una semana de retraso no son dos meses de mora: la severidad los separa. */
  it("distingue dos atrasos leves de dos meses sin pagar", () => {
    const entries = historial(12);
    const conAtrasos = entries.map((entry, i) =>
      i < 2 ? { month: entry.month, stored: pagado(`${entry.month.id}-12`) } : entry,
    );

    expect(paymentScoreDetail(conAtrasos, HOY).stars).toBe(4);
  });

  /**
   * **Y se puede recuperar.** Tres meses malos hace dos años pesan la mitad que tres el trimestre
   * pasado, que es lo que hace que mejorar sirva de algo.
   */
  it("un mal año lejano pesa menos que un mal trimestre reciente", () => {
    const viejo = [
      ...Array.from({ length: 3 }, (_, i) => ({ month: mes(24 + i), stored: null })),
      ...historial(12),
    ];
    const reciente = [
      ...Array.from({ length: 3 }, (_, i) => ({ month: mes(i), stored: null })),
      ...historial(12).slice(3),
      ...Array.from({ length: 3 }, (_, i) => {
        const month = mes(24 + i);
        return { month, stored: pagado(`${month.id}-04`) };
      }),
    ];

    expect(paymentScoreDetail(viejo, HOY).stars ?? 0).toBeGreaterThan(
      paymentScoreDetail(reciente, HOY).stars ?? 0,
    );
  });
});

describe("lo que sale hacia el propietario", () => {
  /**
   * **La aserción que sostiene la promesa entera: la nota no puede despejarse.**
   *
   * Con la regla de tres, "4,2 estrellas" y "12 meses" dan 10 a tiempo y 2 tarde con una división.
   * Es el mismo razonamiento que el mapa —*una coordenada con cinco decimales **es** la
   * dirección*— y la respuesta es la misma: cuantizar. Lo que cruza no tiene los conteos **dentro**,
   * así que no hay forma de filtrarlos por descuido.
   */
  it("no lleva los conteos ni el denominador", () => {
    const detalle = paymentScoreDetail(historial(12), HOY);
    const publicado = toDisclosedScore(detalle);

    expect(Object.keys(publicado).toSorted()).toEqual(["band", "stars"]);
    expect(JSON.stringify(publicado)).not.toContain("12");
  });

  /** Estrellas enteras, nunca un decimal: un decimal se despeja. */
  it("da estrellas enteras", () => {
    for (const meses of [6, 8, 10, 12, 18, 24]) {
      const { stars } = paymentScoreDetail(historial(meses), HOY);
      if (stars !== null) expect(Number.isInteger(stars)).toBe(true);
    }
  });

  /** Y el historial se dice en grueso, nunca con el número de meses. */
  it("dice el historial por franjas y no por meses", () => {
    expect(historyBand(3)).toBe("none");
    expect(historyBand(8)).toBe("some");
    expect(historyBand(14)).toBe("a_year_or_more");
  });

  /** Quien escucha la página necesita la nota en palabras, no cinco iconos. */
  it("dice la nota en palabras", () => {
    expect(starsLabel(null)).toContain("Sin historial");
    expect(starsLabel(4)).toContain("4 de 5");
  });
});
