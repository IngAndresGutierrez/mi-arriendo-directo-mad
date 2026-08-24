"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { notify } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { applicationRoute } from "@/shared/auth/routes";
import { adminDb } from "@/shared/firebase/admin";

import { getApplicationFor } from "../data/application";
import { canWaiveGuarantee, GUARANTEE_PROVIDER } from "../domain/guarantee";
import {
  guaranteePolicySchema,
  guaranteeProgressSchema,
  guaranteeRequestSchema,
  guaranteeWaiverSchema,
} from "../validations/guarantee";

export type GuaranteeActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/** Only the landlord, only while the process is open and on this stage. */
async function landlordOn(applicationId: string) {
  const user = await requireCompleteProfile();
  const application = await getApplicationFor(applicationId, user.uid);

  if (!application) return { ok: false, error: "Este proceso no existe o no es tuyo." } as const;
  if (application.status !== "open") return { ok: false, error: "Este proceso ya está cerrado." } as const;
  if (application.stage !== "guarantee") {
    return { ok: false, error: "El proceso ya no está en la etapa de la garantía." } as const;
  }
  if (application.landlordUid !== user.uid) {
    return { ok: false, error: "Solo el propietario registra la póliza." } as const;
  }

  return { ok: true, uid: user.uid, application } as const;
}

async function tell(
  application: { tenantUid: string; propertyTitle: string; id: string },
  landlordUid: string,
  type: "guarantee_requested" | "guarantee_active" | "guarantee_waived",
  detail: string,
): Promise<void> {
  const [landlord, tenant] = await Promise.all([
    getProfile(landlordUid),
    getProfile(application.tenantUid),
  ]);

  await notify({
    recipientUid: application.tenantUid,
    recipientEmail: tenant?.email ?? null,
    type,
    applicationId: application.id,
    stage: "guarantee",
    propertyTitle: application.propertyTitle,
    actorName: landlord?.fullName ?? "",
    detail,
  });
}

/**
 * The landlord says they applied for the policy.
 *
 * It changes nothing on Sura's side — the product has no account there and does not pretend to —
 * but it is the difference between a tenant seeing "sin garantía" and seeing that the wait has
 * started. Sura writes to them directly to complete the study, and this is where they learn to
 * expect that email.
 */
export async function recordGuaranteeRequested(
  applicationId: string,
  input: unknown,
): Promise<GuaranteeActionResult> {
  const context = await landlordOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = guaranteeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa la nota." };
  }

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      guarantee: {
        requestedAt: new Date().toISOString(),
        // Solicitarla **es** querer póliza: si estaba marcada como "sin seguro", eso queda deshecho
        // por el propio acto de pedirla. Escrito y no omitido: un `update` con un objeto que no
        // nombra el campo lo borraría igual, y entonces el borrado sería un accidente en vez de una
        // decisión.
        waivedAt: null,
        activeAt: null,
        policyNumber: "",
        tenantLink: parsed.data.tenantLink,
        note: parsed.data.note,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  await tell(
    { ...context.application, id: applicationId },
    context.uid,
    "guarantee_requested",
    `Es con ${GUARANTEE_PROVIDER.name}, sin codeudor. Puede que te escriban para completar el estudio.`,
  );

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}

/**
 * The policy exists, and here is its number.
 *
 * This is what unblocks the stage: "ya la solicité" is a wait, not a guarantee, and signing a
 * contract on a policy the insurer may still refuse leaves the landlord with nothing behind it.
 */
export async function recordGuaranteePolicy(
  applicationId: string,
  input: unknown,
): Promise<GuaranteeActionResult> {
  const context = await landlordOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = guaranteePolicySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el número." };
  }

  const current = context.application.guarantee;

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      guarantee: {
        // Kept if it was already there: when the policy was applied for is part of the record.
        requestedAt: current?.requestedAt ?? new Date().toISOString(),
        // Una póliza expedida gana a cualquier renuncia anterior — no se "des-compra" un seguro.
        waivedAt: null,
        activeAt: new Date().toISOString(),
        policyNumber: parsed.data.policyNumber,
        // Preserved: the tenant may still need it, and issuing the policy is not a reason to
        // take away the link they were sent.
        tenantLink: current?.tenantLink ?? "",
        note: parsed.data.note || current?.note || "",
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  await tell(
    { ...context.application, id: applicationId },
    context.uid,
    "guarantee_active",
    `Póliza ${parsed.data.policyNumber} de ${GUARANTEE_PROVIDER.name}.`,
  );

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}

/**
 * The link and the note, saved as they are typed.
 *
 * There is no button behind this: the panel had five, and two of them were a submit for a single
 * field. A field that saves itself is one control instead of two, and it cannot be left filled
 * but unsaved — which is the failure a submit button invites when the next thing you do is switch
 * to another tab to finish on Sura's site.
 *
 * Its own action, and not part of `recordGuaranteeRequested`, because of when it happens: the
 * quoter produces the link at the end, often after the landlord already said they had applied,
 * and reusing that action would overwrite `requestedAt` with a time later than the truth.
 *
 * **The notification is gated on the link appearing, not on the save.** An auto-saving field
 * fires as often as somebody edits a note, and a bell that rings on every keystroke is a bell
 * nobody reads by the time the one that matters arrives. What the tenant needs to know is that
 * they now have something to do; a landlord fixing a typo in a note is not that.
 */
export async function saveGuaranteeProgress(
  applicationId: string,
  input: unknown,
): Promise<GuaranteeActionResult> {
  const context = await landlordOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = guaranteeProgressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el enlace." };
  }

  const current = context.application.guarantee;
  /*
   * Se avisa en las **transiciones**, no en los guardados. Un campo que se guarda solo escribe
   * tantas veces como alguien corrija una nota, y una campana que suena en cada tecla es una
   * campana que nadie lee cuando llega la que importa. Las dos transiciones que sí son noticia
   * ocurren una sola vez cada una: que la póliza pasó a estar solicitada, y que ya hay un enlace
   * con el que el inquilino puede hacer su parte.
   */
  const becameRequested = !current?.requestedAt;
  const linkIsNew = Boolean(parsed.data.tenantLink) && parsed.data.tenantLink !== current?.tenantLink;

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      guarantee: {
        /*
         * Guardar cualquiera de los dos es decir que la póliza ya se solicitó: sin esto, un
         * propietario que pega el enlace primero dejaría la etapa en "sin solicitar" mientras el
         * inquilino ya tiene algo que hacer.
         */
        requestedAt: current?.requestedAt ?? new Date().toISOString(),
        /*
         * **Se conserva**, al contrario que en las otras dos acciones, y la diferencia importa: esto
         * es un autoguardado. Un propietario que marcó "sin seguro" y luego corrige una palabra de la
         * nota no está pidiendo la póliza, y un `waivedAt: null` aquí habría desmarcado el interruptor
         * al escribir — sin que nadie pulsara nada y sin nada en pantalla que lo explicara.
         */
        waivedAt: current?.waivedAt ?? null,
        activeAt: current?.activeAt ?? null,
        policyNumber: current?.policyNumber ?? "",
        // Un guardado que solo trae nota no debe borrar el enlace, ni al revés.
        tenantLink: parsed.data.tenantLink || current?.tenantLink || "",
        note: parsed.data.note || current?.note || "",
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  /*
   * El enlace nunca va en la notificación: es una credencial, el correo lo llevaría a una bandeja
   * que no controlamos, y el inquilino llega en un clic desde la página.
   */
  if (linkIsNew) {
    await tell(
      { ...context.application, id: applicationId },
      context.uid,
      "guarantee_requested",
      `Ya puedes continuar tu parte del seguro con ${GUARANTEE_PROVIDER.name} desde la etapa de la garantía.`,
    );
  } else if (becameRequested) {
    await tell(
      { ...context.application, id: applicationId },
      context.uid,
      "guarantee_requested",
      parsed.data.note ||
        `Es con ${GUARANTEE_PROVIDER.name}, sin codeudor. Puede que te escriban para completar el estudio.`,
    );
  }

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}

/**
 * The landlord says whether this rental needs a policy at all.
 *
 * **The stage was written as if the policy were compulsory, and it is not.** Nothing in Colombian law
 * requires rental insurance; the landlord who is renting to a relative, or to a tenant of six years,
 * had no way past this stage but to buy something they did not want. So the requirement is theirs to
 * set, and what the product owes them in exchange is the consequence stated plainly —
 * `GUARANTEE_WAIVED_NOTE` sits above the switch, not in a tooltip.
 *
 * Two rules that are not obvious from the signature:
 *
 * - **A policy that exists cannot be waived.** `canWaiveGuarantee` is checked here and not only in
 *   the panel: what the switch would otherwise do is hide a policy the tenant has already been told
 *   about, which is a worse thing than a control that is missing.
 * - **Only waiving notifies.** Turning the requirement back *on* asks the tenant for nothing — the
 *   landlord goes off to Sura, and applying for it is what notifies, as it already did. A switch that
 *   rang the tenant's bell in both directions would ring it twice for a landlord who flipped it while
 *   making up their mind, and the second message would contradict the first.
 */
export async function setGuaranteeRequirement(
  applicationId: string,
  input: unknown,
): Promise<GuaranteeActionResult> {
  const context = await landlordOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = guaranteeWaiverSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa la opción." };
  }

  const current = context.application.guarantee;

  if (parsed.data.waived && !canWaiveGuarantee(current)) {
    return {
      ok: false,
      message: "Ya hay una póliza registrada para este arriendo, así que no se puede quitar el seguro.",
    };
  }

  const waivedAt = parsed.data.waived ? (current?.waivedAt ?? new Date().toISOString()) : null;

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      guarantee: {
        // Todo lo demás se conserva: quitar el seguro no borra que se hubiera solicitado antes, ni el
        // enlace que el inquilino ya recibió, ni la nota. Es una decisión más en el expediente.
        requestedAt: current?.requestedAt ?? null,
        waivedAt,
        activeAt: current?.activeAt ?? null,
        policyNumber: current?.policyNumber ?? "",
        tenantLink: current?.tenantLink ?? "",
        note: current?.note ?? "",
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  /*
   * Sólo al quitarlo, y sólo la primera vez: `waivedAt` se conserva si ya estaba, así que volver a
   * pulsar el mismo lado del interruptor no vuelve a avisar. Es la misma regla que el autoguardado de
   * esta etapa ya sigue — se avisa en las transiciones, no en los guardados.
   */
  if (parsed.data.waived && !current?.waivedAt) {
    await tell(
      { ...context.application, id: applicationId },
      context.uid,
      "guarantee_waived",
      "",
    );
  }

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}
