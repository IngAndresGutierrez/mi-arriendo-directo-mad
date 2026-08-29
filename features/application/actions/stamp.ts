import "server-only";

// Not `"use server"`: a module marked that way publishes every export as an endpoint, and this
// one writes files to the bucket. It is called by a Server Action, never by a form.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { adminStorage } from "@/shared/firebase/admin";

import {
  canStamp,
  CONTRACT_PARTY_LABELS,
  SIGNATURE_CHANNEL_LABELS,
  SIGNATURE_CLAUSE,
  type Contract,
  type ContractSignature,
} from "../domain/contract";
import { drawableText, wrapText } from "@/shared/pdf/text";

/**
 * Builds the PDF the parties download: the original with each stroke drawn on the spot the
 * landlord marked, followed by a page of evidence.
 *
 * Every string that reaches a page goes through `drawableText` first: `pdf.save()` throws on a
 * character WinAnsi cannot encode — an emoji in a property title is enough — and it throws from the
 * line that writes the file, not from the one with the bad character.
 *
 * **It is derived, and its bytes are deliberately not what the signatures bind to.** Stamping
 * changes the file, so hashing this as the signed document would invalidate the very signatures it
 * displays. The original's hash stays the anchor; this one carries its own so a tampered copy is
 * still detectable.
 */
export type StampResult = { readonly path: string; readonly sha256: string } | null;

const A4 = { width: 595.28, height: 841.89 } as const;

export async function stampContract(input: {
  readonly applicationId: string;
  readonly contract: Contract;
  readonly signatures: readonly ContractSignature[];
}): Promise<StampResult> {
  const { applicationId, contract, signatures } = input;
  const document = contract.document;
  if (!document || !canStamp(document)) return null;

  const bucket = adminStorage().bucket();

  try {
    const [original] = await bucket.file(document.path).download();
    const pdf = await PDFDocument.load(original);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    for (const signature of signatures) {
      const spot = (contract.spots ?? []).find((each) => each.party === signature.party);
      if (!spot || !signature.strokePath) continue;

      const pages = pdf.getPages();
      const page = pages[spot.page];
      if (!page) continue;

      const [stroke] = await bucket.file(signature.strokePath).download();
      const image = await pdf.embedPng(stroke);

      const { width: pageWidth, height: pageHeight } = page.getSize();
      const boxWidth = spot.width * pageWidth;
      const boxHeight = spot.height * pageHeight;
      /*
       * The spot's origin is the top-left, because that is how the browser measured it. `pdf-lib`
       * measures from the bottom, and the conversion happens here — once, where the stamping is.
       */
      const bottom = pageHeight - (spot.y + spot.height) * pageHeight;

      // Fitted inside the box without distorting the handwriting: a stretched signature is not it.
      const scale = Math.min(boxWidth / image.width, boxHeight / image.height);

      page.drawImage(image, {
        x: spot.x * pageWidth + (boxWidth - image.width * scale) / 2,
        y: bottom,
        width: image.width * scale,
        height: image.height * scale,
      });

      // Who signed, under the stroke, so the page reads without the evidence sheet.
      page.drawText(drawableText(`${signature.fullName} · ${signature.documentId}`), {
        x: spot.x * pageWidth,
        y: Math.max(bottom - 10, 4),
        size: 7,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
    }

    stampEvidencePage({ pdf, document, signatures, font, bold });

    const bytes = await pdf.save();
    const path = `contracts/${applicationId}/firmado-${document.sha256.slice(0, 12)}.pdf`;

    await bucket.file(path).save(Buffer.from(bytes), {
      contentType: "application/pdf",
      resumable: false,
    });

    // `pdf-lib` devuelve un `Uint8Array` cuyo buffer TypeScript no acepta como `BufferSource`
    // directamente; el Buffer que ya se guardó es la misma memoria y sí encaja.
    const digest = await crypto.subtle.digest("SHA-256", Buffer.from(bytes));
    const sha256 = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    return { path, sha256 };
  } catch (error) {
    /*
     * A failed stamping must not undo two valid signatures. The contract is signed either way —
     * the code is what signs it — and this artefact can be generated again.
     */
    console.error("stampContract failed:", error instanceof Error ? error.message : error);

    return null;
  }
}

/**
 * The evidence sheet.
 *
 * This is the page that answers a challenge: the hash of what was signed, the clause each party
 * accepted, when, from where, and to which channel their code went. It exists because Decreto 2364
 * puts the burden of proving the method's reliability on whoever provides it — and that is us.
 */
function stampEvidencePage(input: {
  readonly pdf: PDFDocument;
  readonly document: NonNullable<Contract["document"]>;
  readonly signatures: readonly ContractSignature[];
  readonly font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  readonly bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
}): void {
  const { pdf, document, signatures, font, bold } = input;
  const page = pdf.addPage([A4.width, A4.height]);
  let y = A4.height - 60;

  const line = (text: string, options?: { readonly size?: number; readonly strong?: boolean }) => {
    const size = options?.size ?? 9;
    page.drawText(drawableText(text), {
      x: 50,
      y,
      size,
      font: options?.strong ? bold : font,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= size + 6;
  };

  line("Constancia de firma electronica", { size: 15, strong: true });
  y -= 8;
  line("Ley 527 de 1999 y Decreto 2364 de 2012 (Colombia)", { size: 8 });
  y -= 10;

  line("Documento firmado", { strong: true });
  line(`Archivo: ${document.fileName}`);
  line(`Huella SHA-256: ${document.sha256}`, { size: 7 });
  line("Cualquier cambio posterior al archivo altera esta huella y es detectable.", { size: 8 });
  y -= 10;

  for (const signature of signatures) {
    line(CONTRACT_PARTY_LABELS[signature.party], { strong: true });
    line(`Nombre: ${signature.fullName}`);
    line(`Documento: ${signature.documentId}`);
    line(`Firmo el: ${signature.signedAt}`);
    line(
      `Codigo enviado a su ${SIGNATURE_CHANNEL_LABELS[signature.channel]} verificado: ${signature.sentTo}`,
    );
    line(`Acepto el medio electronico el: ${signature.acceptedClauseAt} (v${signature.clauseVersion})`);
    if (signature.ip) line(`Direccion IP: ${signature.ip}`);
    if (signature.userAgent) line(`Navegador: ${signature.userAgent}`, { size: 7 });
    y -= 8;
  }

  line("Texto aceptado por ambas partes", { strong: true });
  /* Wrapped by hand: the clause is one long sentence and the page has no layout engine. */
  for (const chunk of wrapText(SIGNATURE_CLAUSE, 95)) line(chunk, { size: 8 });
}
