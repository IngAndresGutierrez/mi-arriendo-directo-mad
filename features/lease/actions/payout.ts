"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import {
  payoutSchema,
  payoutShape,
  PAYOUT_METHOD_LABELS,
  type Payout,
} from "@/features/application/client";
import { notify } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { rentalRoute } from "@/shared/auth/routes";
import { adminDb } from "@/shared/firebase/admin";

import { getLeaseFor } from "../data/lease";

export type LeasePayoutResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * The landlord changes where the canon arrives.
 *
 * The tenancy starts with whatever the first canon used, so this is not day-one setup — it is the
 * landlord who switched banks in month seven. It matters because the alternative is telling the
 * tenant the new account over WhatsApp, which is the one message in this whole product that a
 * stranger would most like to send in somebody else's name.
 *
 * **Changing the account changes nothing about the months already paid.** Their receipts name what
 * the screen said at the time, which is what makes them checkable later.
 */
export async function saveLeasePayout(
  leaseId: string,
  input: unknown,
): Promise<LeasePayoutResult> {
  const user = await requireCompleteProfile();

  const lease = await getLeaseFor(leaseId, user.uid);
  if (!lease) return { ok: false, message: "Este arriendo no existe o no es tuyo." };
  if (lease.landlordUid !== user.uid) {
    return { ok: false, message: "Solo el propietario indica por dónde recibir el canon." };
  }

  const parsed = payoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const data = parsed.data;
  const shape = payoutShape(data.method);
  /*
   * Stored **flat, with an empty string where a field does not apply**, because Firestore rejects
   * `undefined` and because a document whose keys change with the method is a document every reader
   * has to narrow before touching. The union was already enforced by the schema; this only reshapes
   * it, exactly as the first canon does.
   */
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

  await adminDb()
    .collection("leases")
    .doc(leaseId)
    .update({ payout, updatedAt: FieldValue.serverTimestamp() });

  /*
   * **Los datos de la cuenta no salen en la notificación.** Un correo con el número de cuenta de
   * alguien es la forma exacta de toda estafa de pagos que existe, y el nuestro saldría de un
   * dominio en el que el inquilino confía — el peor sitio posible para aprender un número de cuenta
   * nuevo. Se avisa de que cambiaron; cuáles son se lee en la página, detrás de la sesión.
   */
  const [landlord, tenant] = await Promise.all([
    getProfile(user.uid),
    getProfile(lease.tenantUid),
  ]);

  await notify({
    recipientUid: lease.tenantUid,
    recipientEmail: tenant?.email ?? null,
    type: "canon_payout_changed",
    applicationId: leaseId,
    // La última etapa del proceso; en una notificación de arrendamiento el destino sale del tipo.
    stage: "first_payment",
    propertyTitle: lease.propertyTitle,
    actorName: landlord?.fullName ?? "",
    detail: `Ahora es por ${PAYOUT_METHOD_LABELS[payout.method]}.`,
  });

  revalidatePath(rentalRoute(leaseId));

  return { ok: true };
}
