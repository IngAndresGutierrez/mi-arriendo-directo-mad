import "server-only";

// Not `"use server"`: a module marked that way publishes every export as an endpoint. These are
// called by two Route Handlers that have already checked who is asking.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { formatBogotaDateTime, formatLongDate } from "@/shared/format/date";
import { formatCOP } from "@/shared/format/money";
import { drawableText, wrapText } from "@/shared/pdf/text";

import type { Clearance, RentReceipt } from "../domain/certificate";

/**
 * The two documents, drawn.
 *
 * **The wording is here and not in a template**, because the wording is the whole legal weight of
 * the thing. Neither document says *el propietario certifica*: it says **según el registro de esta
 * plataforma, el propietario confirmó haber recibido**, which is true, checkable against the screen
 * both parties read, and not a claim this product is in a position to make on anybody's behalf.
 * A generated document that overstated what it knows would be worse than no document.
 *
 * Every string goes through `drawableText` first. `pdf.save()` throws on a character WinAnsi cannot
 * encode — an emoji in a property title is enough — and it throws from the line that writes the
 * file, not from the one with the bad character in it.
 */

const A4 = { width: 595.28, height: 841.89 } as const;
const MARGIN = 56;
const INK = rgb(0.15, 0.15, 0.15);
const FAINT = rgb(0.42, 0.4, 0.46);
/** `--brand-purple-900`, the one place a literal colour is right: a PDF has no stylesheet. */
const BRAND = rgb(0.176, 0.071, 0.302);

/** A page that draws top-down, because that is how the text reads and not how PDF measures. */
type Sheet = {
  readonly line: (text: string, options?: LineOptions) => void;
  readonly gap: (points: number) => void;
  readonly rule: () => void;
  readonly save: () => Promise<Uint8Array>;
};

type LineOptions = {
  readonly size?: number;
  readonly strong?: boolean;
  readonly faint?: boolean;
  readonly brand?: boolean;
};

async function sheet(): Promise<Sheet> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4.width, A4.height]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = A4.height - MARGIN;

  return {
    line(text, options) {
      const size = options?.size ?? 10;
      page.drawText(drawableText(text), {
        x: MARGIN,
        y,
        size,
        font: options?.strong ? bold : font,
        color: options?.brand ? BRAND : options?.faint ? FAINT : INK,
      });
      y -= size + 6;
    },
    gap(points) {
      y -= points;
    },
    rule() {
      y -= 4;
      page.drawRectangle({
        x: MARGIN,
        y,
        width: A4.width - MARGIN * 2,
        height: 0.8,
        color: rgb(0.85, 0.84, 0.88),
      });
      y -= 14;
    },
    save: () => pdf.save(),
  };
}

/**
 * The header both documents share: the brand, and what this piece of paper is.
 *
 * Shared so the two cannot drift into looking like they came from different products — which is
 * exactly what happens when a second document is added by copying the first.
 */
function header(page: Sheet, title: string, reference: string): void {
  page.line("miarriendoDIRECTO.com", { size: 11, strong: true, brand: true });
  page.gap(6);
  page.line(title, { size: 18, strong: true });
  page.line(`Referencia ${reference}`, { size: 9, faint: true });
  page.rule();
}

/**
 * The footer both documents share, and the sentence that keeps them honest.
 *
 * It says where the document comes from and what it is not. A generated certificate that did not
 * say so would invite being read as something a person signed.
 */
function footer(page: Sheet, issuedAt: string): void {
  page.gap(10);
  page.rule();
  for (const chunk of wrapText(DISCLAIMER, 96)) page.line(chunk, { size: 8, faint: true });
  page.gap(4);
  page.line(`Generado el ${formatBogotaDateTime(issuedAt)} (hora de Colombia).`, {
    size: 8,
    faint: true,
  });
}

/*
 * **Con tildes.** La primera versión las quitó "por si acaso", que es exactamente la superstición
 * que `drawableText` existe para no necesitar: WinAnsi **sí** codifica los acentos del español y
 * `shared/pdf/text.test.ts` lo fija contra `pdf-lib`. Lo que no codifica es un emoji, y de eso se
 * ocupa la función. Escribir mal el español de un documento que alguien le lleva a un tercero por
 * un miedo que ya está resuelto es la peor de las dos opciones.
 */
const DISCLAIMER =
  "Este documento lo genera miarriendoDIRECTO.com a partir del registro de la plataforma. " +
  "Recoge lo que el propietario confirmó dentro de ella y no constituye una declaración adicional " +
  "de ninguna de las partes ni un documento tributario.";

/**
 * The rent receipt: date, amount and the period it covers.
 *
 * Those three are not a design choice — they are what Ley 820 de 2003 requires the landlord to put
 * in the written receipt they owe the tenant for every payment. The page states the substance and
 * **cites no article**: the numeral deserves a lawyer's eye before this product prints it.
 */
export async function receiptPdf(receipt: RentReceipt): Promise<Uint8Array> {
  const page = await sheet();

  header(page, "Recibo de pago de arrendamiento", receipt.reference);

  page.line("Periodo", { strong: true });
  page.line(receipt.periodLabel, { size: 13 });
  page.gap(8);

  page.line("Valor recibido", { strong: true });
  page.line(formatCOP(receipt.amount), { size: 20, strong: true, brand: true });
  page.gap(10);

  page.line("Inmueble", { strong: true });
  page.line(`${receipt.propertyTitle} - ${receipt.propertyCity}`);
  page.gap(8);

  page.line("Partes", { strong: true });
  page.line(`Arrendador: ${receipt.landlordName}`);
  page.line(`Arrendatario: ${receipt.tenantName}`);
  page.gap(8);

  page.line("Fechas", { strong: true });
  /*
   * Two dates and never one, because they are different facts and the gap between them is the thing
   * a disagreement is usually about: when the tenant says they transferred, and when the landlord
   * said it arrived.
   */
  if (receipt.paidOn) page.line(`Pago declarado por el arrendatario: ${formatLongDate(receipt.paidOn)}`);
  /*
   * Las dos con el mismo formato. La primera versión mezclaba `formatLongDate` con
   * `formatBogotaDateTime`, así que salían "4 de mayo de 2026" y "5 de **may** de 2026" una debajo
   * de la otra — el mes abreviado se lee como un fallo en un papel que alguien archiva. Un recibo
   * dice el día; el instante exacto vive en el registro, que es donde se puede consultar.
   */
  if (receipt.confirmedAt) {
    page.line(
      `Confirmado como recibido por el arrendador: ${formatLongDate(receipt.confirmedAt.slice(0, 10))}`,
    );
  }
  page.gap(10);

  for (const chunk of wrapText(
    `Según el registro de esta plataforma, ${receipt.landlordName} confirmó haber recibido de ` +
      `${receipt.tenantName} el canon de ${receipt.periodLabel} correspondiente al inmueble ` +
      `indicado arriba.`,
    92,
  )) {
    page.line(chunk, { size: 9 });
  }

  footer(page, receipt.issuedAt);

  return page.save();
}

/**
 * The paz y salvo: every month the landlord has confirmed, and nothing owed today.
 *
 * **It says "a la fecha" and never "el contrato termino".** Under Ley 820 a residential lease renews
 * for an equal term unless a party gives notice in the form and within the time the law sets out, so
 * a certificate claiming the tenancy is over would be asserting something the law denies —
 * `leaseTermState` refuses the same claim one level up.
 */
export async function clearancePdf(record: Clearance): Promise<Uint8Array> {
  const page = await sheet();

  header(page, "Paz y salvo de arrendamiento", record.reference);

  for (const chunk of wrapText(
    `Según el registro de esta plataforma, ${record.landlordName} confirmó haber recibido de ` +
      `${record.tenantName} los cánones del inmueble ${record.propertyTitle} (${record.propertyCity}) ` +
      `que se relacionan a continuación. A la fecha de emisión no hay cánones vencidos ni pendientes ` +
      `de confirmación.`,
    92,
  )) {
    page.line(chunk, { size: 9 });
  }
  page.gap(10);

  page.line(`Al día hasta ${record.through}`, { size: 13, strong: true, brand: true });
  page.gap(10);

  page.line("Cánones confirmados", { strong: true });
  page.gap(2);
  for (const month of record.months) {
    page.line(
      `${month.periodLabel.padEnd(24, " ")} ${formatCOP(month.amount).padStart(14, " ")}` +
        (month.confirmedAt ? `   confirmado el ${formatLongDate(month.confirmedAt.slice(0, 10))}` : ""),
      { size: 9 },
    );
  }
  page.gap(6);
  page.line(`Total confirmado: ${formatCOP(record.totalPaid)}`, { strong: true });
  page.gap(10);

  page.line("Partes", { strong: true });
  page.line(`Arrendador: ${record.landlordName}`);
  page.line(`Arrendatario: ${record.tenantName}`);
  page.gap(6);

  for (const chunk of wrapText(
    "Este paz y salvo se refiere únicamente a los cánones confirmados en la plataforma a la fecha " +
      "de emisión. No declara terminado el contrato de arrendamiento ni se pronuncia sobre servicios " +
      "públicos, administración, reparaciones u otras obligaciones entre las partes.",
    92,
  )) {
    page.line(chunk, { size: 8, faint: true });
  }

  footer(page, record.issuedAt);

  return page.save();
}
