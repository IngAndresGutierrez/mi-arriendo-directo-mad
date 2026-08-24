"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { startLease } from "@/features/lease";
import { notify } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { applicationRoute, CONTRACTS_ROUTE, RENTALS_ROUTE } from "@/shared/auth/routes";
import { adminDb, adminStorage } from "@/shared/firebase/admin";

import { getApplicationFor } from "../data/application";
import { isCompleted } from "../domain/application";
import {
  payoutShape,
  receiptFileProblem,
  verdictApplies,
  PAYOUT_METHOD_LABELS,
  type Payout,
} from "../domain/payout";
import { payoutSchema, receiptSchema, receiptVerdictSchema } from "../validations/payout";

export type PayoutActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/** Either party, on the first-canon stage, on an open process. */
async function partyOn(applicationId: string) {
  const user = await requireCompleteProfile();
  const application = await getApplicationFor(applicationId, user.uid);

  if (!application) return { ok: false, error: "Este proceso no existe o no es tuyo." } as const;
  if (application.status !== "open") return { ok: false, error: "Este proceso ya está cerrado." } as const;
  if (application.stage !== "first_payment") {
    return { ok: false, error: "El proceso no está en la etapa del primer canon." } as const;
  }
  /*
   * Y no después de que termine. Confirmar el canon abre el arriendo, y a partir de ahí los pagos
   * viven en `/arriendos`: dejar subir aquí un comprobante más sería ofrecer una pantalla que ya no
   * lleva a ninguna parte, con el mes siguiente esperándolos en otra.
   */
  if (isCompleted(application)) {
    return { ok: false, error: "Este proceso ya terminó: el arriendo está en curso." } as const;
  }

  const isLandlord = application.landlordUid === user.uid;

  return { ok: true, uid: user.uid, application, isLandlord } as const;
}

/**
 * The landlord says where to receive the first canon.
 *
 * **Nothing here is verified against a bank**, and the screen says so: this product does not query
 * financial institutions and does not move money. What it does is put the details where the tenant
 * can read them instead of in a chat message that scrolls away — and keep them beside the receipt,
 * so the pair can be checked later.
 *
 * The stored shape is flat with empty strings where a field does not apply, because Firestore
 * rejects `undefined`. The union was already enforced by the schema; this only reshapes it.
 */
export async function savePayout(
  applicationId: string,
  input: unknown,
): Promise<PayoutActionResult> {
  const context = await partyOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };
  if (!context.isLandlord) {
    return { ok: false, message: "Solo el propietario indica por dónde recibir el canon." };
  }

  const parsed = payoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const data = parsed.data;
  const shape = payoutShape(data.method);
  const payout: Payout = {
    method: data.method,
    phone: shape.phone && "phone" in data ? data.phone : "",
    key: shape.key && "key" in data ? data.key : "",
    accountType: shape.account && "accountType" in data ? data.accountType : "",
    accountNumber: shape.account && "accountNumber" in data ? data.accountNumber : "",
    bankName: shape.bankName && "bankName" in data ? data.bankName : "",
    holderName: data.holderName,
    // Vacío donde no aplica, como el resto: el esquema ni siquiera lo acepta en esas ramas.
    holderDocument: shape.holderDocument && "holderDocument" in data ? data.holderDocument : "",
    note: data.note,
  };

  const current = context.application.firstPayment;
  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      firstPayment: {
        payout,
        // Cambiar la cuenta no borra un comprobante ya subido: el inquilino pagó a lo que había, y
        // borrar su prueba porque el propietario corrigió un dígito sería quitarle lo único que
        // tiene. El veredicto decide si ese pago vale.
        receipt: current?.receipt ?? null,
        verdict: current?.verdict ?? null,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  /*
   * **Los datos de la cuenta no salen en la notificación.** Un correo con el número de cuenta de
   * alguien es la forma exacta de toda estafa de pagos que existe, y además nuestro correo saldría
   * de un dominio en el que el inquilino confía. Se avisa de que ya hay por dónde pagar; el dónde
   * se lee en la página, detrás de la sesión.
   */
  const [landlord, tenant] = await Promise.all([
    getProfile(context.uid),
    getProfile(context.application.tenantUid),
  ]);

  await notify({
    recipientUid: context.application.tenantUid,
    recipientEmail: tenant?.email ?? null,
    type: "payout_ready",
    applicationId,
    stage: "first_payment",
    propertyTitle: context.application.propertyTitle,
    actorName: landlord?.fullName ?? "",
    detail: `Es por ${PAYOUT_METHOD_LABELS[payout.method]}.`,
  });

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}

/**
 * The tenant uploads proof of the transfer.
 *
 * Through the server, like the contract: `payments/**` is denied to every client by the explicit
 * closure in `storage.rules`, and the rule that has to hold — "the tenant *of this application*, on
 * *this* stage" — is not something Security Rules can ask without reading the application.
 *
 * The amount and the date are **what the tenant declares**. Nothing here reads a bank, which is
 * exactly why the landlord answers afterwards.
 */
export async function uploadReceipt(
  applicationId: string,
  formData: FormData,
): Promise<PayoutActionResult> {
  const context = await partyOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };
  if (context.isLandlord) {
    return { ok: false, message: "El comprobante lo sube el inquilino." };
  }
  if (!context.application.firstPayment?.payout) {
    return { ok: false, message: "El propietario todavía no ha indicado por dónde pagar." };
  }

  const file = formData.get("receipt");
  if (!(file instanceof File)) return { ok: false, message: "Adjunta el comprobante." };

  const problem = receiptFileProblem({ type: file.type, size: file.size });
  if (problem) return { ok: false, message: problem };

  const parsed = receiptSchema.safeParse({
    amount: formData.get("amount") ?? "",
    paidOn: formData.get("paidOn") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos del pago." };
  }

  const safeName = file.name.replace(/[^\w.-]/g, "-").slice(-80) || "comprobante";
  const path = `payments/${applicationId}/${crypto.randomUUID()}-${safeName}`;

  try {
    await adminStorage()
      .bucket()
      .file(path)
      .save(Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        resumable: false,
      });
  } catch (error) {
    console.error("uploadReceipt failed:", error instanceof Error ? error.message : error);

    return { ok: false, message: "No pudimos guardar el comprobante. Inténtalo de nuevo." };
  }

  const current = context.application.firstPayment;
  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      firstPayment: {
        payout: current.payout,
        receipt: {
          path,
          fileName: file.name.slice(-120),
          contentType: file.type,
          bytes: file.size,
          uploadedAt: new Date().toISOString(),
          amount: parsed.data.amount,
          paidOn: parsed.data.paidOn,
          note: parsed.data.note,
        },
        /*
         * El veredicto anterior se conserva tal cual y **deja de aplicar solo**, porque es más
         * antiguo que este comprobante — `verdictApplies` lo compara por fecha. Borrarlo perdería el
         * registro de que hubo un rechazo, que es justo lo que explica por qué hay un segundo
         * comprobante.
         */
        verdict: current.verdict ?? null,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  const [tenant, landlord] = await Promise.all([
    getProfile(context.uid),
    getProfile(context.application.landlordUid),
  ]);

  await notify({
    recipientUid: context.application.landlordUid,
    recipientEmail: landlord?.email ?? null,
    type: "receipt_uploaded",
    applicationId,
    stage: "first_payment",
    propertyTitle: context.application.propertyTitle,
    actorName: tenant?.fullName ?? "",
    detail: parsed.data.note,
  });

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}

/**
 * The landlord says whether the money arrived — and a "yes" is what **ends the process**.
 *
 * This is what the stage exists for. A receipt is what the tenant can prove; whether the money
 * landed is something only the person whose account it is can say, and no screenshot substitutes
 * for it — a transfer can be reversed, mistyped or sent to the wrong key and still photograph well.
 *
 * A rejection **needs a reason**, and the tenant reads it: it is the only thing that tells them what
 * to fix before uploading another one.
 *
 * **Confirming closes the seven stages and opens the tenancy, in one movement.** There used to be
 * two stages after this — "Postulación aprobada" was already behind it, and "Arriendo en curso" was
 * ahead — and reaching the second of them was a button the landlord pressed *after* confirming the
 * canon, which recorded nothing the confirmation had not already recorded. A step whose only content
 * is repeating the previous one is a step everybody clicks through without reading, and here it was
 * worse than that: until it was pressed, the tenant had paid, the landlord had confirmed, and the
 * page with the months on it still did not exist.
 *
 * So this is the one place in the product where something moves without the landlord moving it, and
 * it is the same decision, not an extra one. The order matters: the verdict is written first, then
 * the tenancy is opened, then the bell rings. `startLease` never throws and is idempotent through
 * the tenancy's id — a tenancy that failed to open is a screen the next attempt fixes, while a
 * rolled-back confirmation is not.
 */
export async function recordReceiptVerdict(
  applicationId: string,
  input: unknown,
): Promise<PayoutActionResult> {
  const context = await partyOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };
  if (!context.isLandlord) {
    return { ok: false, message: "Solo el propietario confirma que recibió el canon." };
  }

  const current = context.application.firstPayment;
  if (!current?.receipt) return { ok: false, message: "Todavía no hay comprobante que revisar." };
  if (verdictApplies(current)) {
    return { ok: false, message: "Ya respondiste a este comprobante." };
  }

  const parsed = receiptVerdictSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el motivo." };
  }

  const verdict = {
    status: parsed.data.status,
    at: new Date().toISOString(),
    reason: parsed.data.status === "rejected" ? parsed.data.reason : "",
  };
  const confirmed = verdict.status === "confirmed";
  const completedAt = new Date();

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      "firstPayment.verdict": verdict,
      /*
       * Un instante, no un booleano: *cuándo* terminó es parte del registro que leen las dos
       * partes, y una bandera responde "no" igual el día que se acabó que estando en la etapa tres.
       * Se guarda como marca de tiempo del servidor, como `checksAuthorizedAt`, porque es el
       * convertidor el que las pasa a ISO al leerlas.
       */
      ...(confirmed ? { completedAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });

  if (confirmed) {
    await startLease({
      ...context.application,
      completedAt: completedAt.toISOString(),
      firstPayment: { ...current, verdict },
    });
  }

  const [landlord, tenant] = await Promise.all([
    getProfile(context.uid),
    getProfile(context.application.tenantUid),
  ]);

  /*
   * Una sola noticia, y la que sirve: `lease_started` es una notificación del arriendo, así que
   * lleva a `/arriendos/<id>` — que es donde está a partir de ahora todo lo que sigue. Mandar
   * además "confirmó el canon", que apunta al proceso, sería sonar dos veces por una decisión y
   * dejar el segundo enlace en la página que acaba de quedarse sin nada que hacer.
   */
  await notify({
    recipientUid: context.application.tenantUid,
    recipientEmail: tenant?.email ?? null,
    type: confirmed ? "lease_started" : "receipt_rejected",
    applicationId,
    stage: "first_payment",
    propertyTitle: context.application.propertyTitle,
    actorName: landlord?.fullName ?? "",
    detail: verdict.reason,
  });

  revalidatePath(applicationRoute(applicationId));
  if (confirmed) {
    revalidatePath(CONTRACTS_ROUTE);
    revalidatePath(RENTALS_ROUTE);
  }

  return { ok: true };
}
