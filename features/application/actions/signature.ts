"use server";

import { FieldValue } from "firebase-admin/firestore";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { notify, sendEmail, sendSms, sendWhatsApp } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { applicationRoute } from "@/shared/auth/routes";
import { adminDb, adminStorage } from "@/shared/firebase/admin";

import { getApplicationFor } from "../data/application";
import {
  challengeProblem,
  challengeProblemMessage,
  canStamp,
  contractState,
  hasSigned,
  maskChannel,
  CONTRACT_PARTY_LABELS,
  OTP_LENGTH,
  SIGNATURE_CHANNEL_LABELS,
  OTP_MAX_ATTEMPTS,
  SIGNATURE_CLAUSE_VERSION,
  strokeRequired,
  type ContractParty,
  type ContractSignature,
  type SignatureChannel,
} from "../domain/contract";
import {
  signatureCodeEmail,
  signatureCodeWhatsAppParameters,
  OTP_MINUTES,
} from "../domain/signature-code";
import { signatureConfirmSchema, signatureRequestSchema } from "../validations/contract";
import { stampContract } from "./stamp";

export type SignatureActionResult =
  | { readonly ok: true; readonly sentTo?: string }
  | { readonly ok: false; readonly message: string };

/**
 * Where a challenge in flight is kept: **its own collection, which no client can read.**
 *
 * Not on the application document, and this is the whole point. Both parties may read that
 * document, and a SHA-256 of six digits falls to a million guesses on a laptop — so storing the
 * hash there would let the tenant recover the landlord's code and sign as them. `firestore.rules`
 * ends in an explicit closure that denies every undeclared path, so this collection is unreachable
 * from any client by construction; a test in `tests/rules/` pins that.
 */
const CHALLENGES = "signatureChallenges";

const challengeId = (applicationId: string, party: ContractParty) => `${applicationId}_${party}`;

/** Hex SHA-256 of the salted code. The code itself is never written anywhere. */
async function hashCode(code: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Compares in time that does not depend on where the strings differ.
 *
 * A six-digit code behind five attempts is not realistically broken by timing, but a comparison
 * that leaks its progress is the kind of thing that stops being harmless the day the code gets
 * longer or the cap gets looser.
 */
function equalInConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return difference === 0;
}

/** `OTP_LENGTH` digits from a cryptographic source, never `Math.random`. */
function newCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);

  return String(bytes[0] % 10 ** OTP_LENGTH).padStart(OTP_LENGTH, "0");
}

function newSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Either party, on this stage, on an open process, with a contract to sign. */
async function partyOn(applicationId: string) {
  const user = await requireCompleteProfile();
  const application = await getApplicationFor(applicationId, user.uid);

  if (!application) return { ok: false, error: "Este proceso no existe o no es tuyo." } as const;
  if (application.status !== "open") return { ok: false, error: "Este proceso ya está cerrado." } as const;
  if (application.stage !== "contract_signature") {
    return { ok: false, error: "El proceso no está en la etapa de la firma." } as const;
  }

  const hash = application.contract?.document?.sha256;
  if (!hash) return { ok: false, error: "Todavía no hay contrato que firmar." } as const;

  const party: ContractParty = application.landlordUid === user.uid ? "landlord" : "tenant";

  return { ok: true, uid: user.uid, application, party, hash } as const;
}

/**
 * Which channels can actually deliver a code right now.
 *
 * **Lives beside `deliver`, on purpose.** The panel must not offer a channel that will answer "no
 * pudimos enviar el código": offering a control that fails is worse than not offering it. But if the
 * screen decided availability on its own, the two would drift — so the one rule is here, in the same
 * module that does the sending, and both the page and `deliver` read it.
 *
 * Email always works: with no `RESEND_API_KEY` the code is written to the server log, which is how
 * this flow is exercised locally. WhatsApp needs **its own template approved by Meta** in the
 * AUTHENTICATION category — a business-initiated message outside the 24-hour window cannot be free
 * text — so it appears only once `WHATSAPP_OTP_TEMPLATE` names one.
 */
export async function availableSignatureChannels(): Promise<readonly SignatureChannel[]> {
  const channels: SignatureChannel[] = ["email"];

  if (process.env.WHATSAPP_OTP_TEMPLATE?.trim()) channels.push("whatsapp");
  /*
   * SMS necesita las tres, no una: sin el número de origen Twilio no sabe de parte de quién manda, y
   * un canal a medio configurar es el que falla justo cuando alguien lo elige.
   */
  if (
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    process.env.TWILIO_FROM_NUMBER?.trim()
  ) {
    channels.push("sms");
  }

  return channels;
}

/**
 * Sends the code that will act as this party's signature.
 *
 * **The clause is accepted here, not when the code is entered.** Decreto 2364's presumption rests
 * on the method having been agreed, so the agreement has to come before the mechanism runs.
 *
 * Unlike `notify()`, which never throws because news can wait, **a failed delivery is reported**:
 * somebody who cannot receive the code cannot sign, and telling them nothing would leave them
 * staring at a form that will never accept anything.
 */
export async function requestSignatureCode(
  applicationId: string,
  input: unknown,
): Promise<SignatureActionResult> {
  const context = await partyOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };

  if (hasSigned(context.application.contract, context.party)) {
    return { ok: false, message: "Ya firmaste este contrato." };
  }

  const parsed = signatureRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  /*
   * The destination comes from the profile, never from the request. A code sent to an address
   * typed at signing time would prove the signer controls *that address*, which is not the same as
   * being the party — and it is exactly the substitution this check exists to prevent.
   */
  const profile = await getProfile(context.uid);
  const channel: SignatureChannel = parsed.data.channel;

  /*
   * Otra vez aquí, y no solo en la pantalla: lo que llega es una petición, no una promesa sobre lo
   * que el formulario ofrecía. Un cliente que manda `whatsapp` sin plantilla configurada recibe una
   * frase clara en vez de un envío que se pierde.
   */
  if (!(await availableSignatureChannels()).includes(channel)) {
    return {
      ok: false,
      message: "Ese canal no está disponible todavía. Pide el código por correo.",
    };
  }
  const destination = channel === "email" ? profile?.email : profile?.phone;

  if (!destination) {
    return {
      ok: false,
      message:
        channel === "whatsapp"
          ? "No tenemos un teléfono en tu perfil. Elige el correo o agrégalo en tu perfil."
          : "No tenemos tu correo.",
    };
  }

  const code = newCode();
  const salt = newSalt();
  const now = new Date().toISOString();
  const sentTo = maskChannel(channel, destination);

  /*
   * Written before sending. A code that reached somebody and was not recorded is a code that
   * cannot be used, which is the worse of the two failures — and asking for another one overwrites
   * this document, so the attempt counter resets with the new code, which is correct.
   */
  await adminDb()
    .collection(CHALLENGES)
    .doc(challengeId(applicationId, context.party))
    .set({
      applicationId,
      party: context.party,
      uid: context.uid,
      codeHash: await hashCode(code, salt),
      salt,
      channel,
      sentTo,
      issuedAt: now,
      attempts: 0,
      documentHash: context.hash,
      acceptedClauseAt: now,
      clauseVersion: SIGNATURE_CLAUSE_VERSION,
      createdAt: FieldValue.serverTimestamp(),
    });

  const copy = signatureCodeEmail({
    code,
    propertyTitle: context.application.propertyTitle,
    recipientName: profile?.fullName ?? "",
  });

  const outcome = await deliver(channel, destination, copy, {
    code,
    propertyTitle: context.application.propertyTitle,
  });

  /*
   * `logged` no es un fallo: es este proyecto sin proveedor configurado, que es como se ejercita el
   * flujo en local sin escribirle a nadie — el mismo contrato que Resend y WhatsApp tienen en el
   * resto del producto. Un `failed`, en cambio, sí lo es: hay credenciales y el envío no salió, así
   * que esa persona no va a recibir nada y decírselo es la diferencia entre reintentar y quedarse
   * mirando un formulario que no va a aceptar nada.
   */
  if (outcome === "failed") {
    return {
      ok: false,
      message:
        channel === "email"
          ? "No pudimos enviar el código. Inténtalo de nuevo en un momento."
          : `No pudimos enviar el código por ${SIGNATURE_CHANNEL_LABELS[channel]}. Intenta por correo.`,
    };
  }

  return { ok: true, sentTo };
}

/**
 * Hands the code to whichever channel was asked for.
 *
 * Three outcomes, not two, and the middle one is the point: **`logged` is what happens with no
 * provider configured**, which is how this flow is exercised locally without writing to anybody —
 * the same contract Resend and WhatsApp have everywhere else in the product. `failed` means there
 * *are* credentials and the send did not go out, which is a different thing and has to be said.
 *
 * WhatsApp needs **its own template approved by Meta** (`WHATSAPP_OTP_TEMPLATE`): a
 * business-initiated message outside the 24-hour window cannot be free text, and Meta approves a
 * template for one purpose — the interview reminder is a different purpose with different words.
 * Without it the person is told to use email, which is better than a code that never arrives.
 */
type Delivery = "delivered" | "logged" | "failed";

async function deliver(
  channel: SignatureChannel,
  destination: string,
  copy: { readonly subject: string; readonly text: string; readonly html: string },
  values: { readonly code: string; readonly propertyTitle: string },
): Promise<Delivery> {
  if (channel === "email") {
    if (!process.env.RESEND_API_KEY?.trim()) {
      // `sendEmail` writes the subject — which carries the code — to the server log.
      await sendEmail({ to: destination, ...copy });

      return "logged";
    }

    return (await sendEmail({ to: destination, ...copy })) ? "delivered" : "failed";
  }

  if (channel === "sms") {
    /*
     * El mismo texto del correo, en una línea. Sin enlace, por la misma razón: un mensaje de firma
     * con algo que pulsar enseña a aceptar phishing, y en SMS es peor todavía porque no hay remitente
     * que se pueda verificar.
     */
    return (await sendSms({
      to: destination,
      body: `${values.code} es tu código para firmar el contrato de ${values.propertyTitle}. Vence en ${OTP_MINUTES} minutos y solo sirve una vez. No lo compartas.`,
    }))
      ? "delivered"
      : "failed";
  }

  const template = process.env.WHATSAPP_OTP_TEMPLATE?.trim();
  if (!template) {
    console.warn("WHATSAPP_OTP_TEMPLATE is not set: the signature code cannot go over WhatsApp");

    return "failed";
  }

  return (await sendWhatsApp({
    parameters: signatureCodeWhatsAppParameters(values),
    template,
    locale: process.env.WHATSAPP_TEMPLATE_LOCALE?.trim() || "es_CO",
    to: destination,
  }))
    ? "delivered"
    : "failed";
}

/**
 * The code is right, so this party has signed.
 *
 * Everything kept here exists to answer a challenge later: the clause they accepted and when, the
 * exact moment, the masked channel the code went to, the address and the browser it came from, and
 * above all the **hash of the file they signed**. That last one is what makes a later alteration
 * detectable, and it is why nothing needs to be cleaned up when a contract is replaced.
 */
export async function confirmSignature(
  applicationId: string,
  input: unknown,
): Promise<SignatureActionResult> {
  const context = await partyOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };

  if (hasSigned(context.application.contract, context.party)) {
    return { ok: false, message: "Ya firmaste este contrato." };
  }

  const parsed = signatureConfirmSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el código." };
  }

  /*
   * El dibujo es obligatorio para las dos partes siempre que haya dónde estamparlo, y se exige
   * **antes** de mirar el código: un trazo que falta no es un código equivocado, así que no debe
   * gastar uno de los cinco intentos ni matar el reto que la persona acaba de pedir.
   */
  const mustDraw = strokeRequired(context.application.contract, context.party);
  const stroke = parsed.data.stroke ?? "";
  if (mustDraw && !stroke) {
    return { ok: false, message: "Dibuja tu firma antes de confirmar el código." };
  }

  const reference = adminDb().collection(CHALLENGES).doc(challengeId(applicationId, context.party));
  const snapshot = await reference.get();
  const stored = snapshot.data();

  const challenge = stored
    ? {
        party: stored.party as ContractParty,
        codeHash: String(stored.codeHash ?? ""),
        channel: stored.channel as SignatureChannel,
        sentTo: String(stored.sentTo ?? ""),
        issuedAt: String(stored.issuedAt ?? ""),
        attempts: Number(stored.attempts ?? 0),
        documentHash: String(stored.documentHash ?? ""),
      }
    : null;

  /*
   * Whether it may be answered at all, before looking at whether it is right: checking the two in
   * the other order is how an expired code gets accepted because it happened to match.
   */
  const problem = challengeProblem(challenge, context.party, context.hash, Date.now());
  if (problem !== "none") {
    return { ok: false, message: challengeProblemMessage(problem) ?? "Pide un código nuevo." };
  }

  const expected = await hashCode(parsed.data.code, String(stored?.salt ?? ""));
  if (!equalInConstantTime(expected, challenge!.codeHash)) {
    // The counter only means something if a wrong code costs an attempt.
    await reference.update({ attempts: FieldValue.increment(1) });
    const left = OTP_MAX_ATTEMPTS - (challenge!.attempts + 1);

    return {
      ok: false,
      message:
        left > 0
          ? `El código no es correcto. Te ${left === 1 ? "queda 1 intento" : `quedan ${left} intentos`}.`
          : "El código no es correcto y se agotaron los intentos. Pide uno nuevo.",
    };
  }

  /*
   * El trazo. Se guarda como archivo en el bucket y no dentro del documento: un PNG en base64 son
   * decenas de kilobytes que se leerían en cada render de la página, y Firestore tiene un tope de
   * 1 MB por documento que dos firmas y un contrato largo pueden rozar.
   */
  let strokePath = "";
  // Sin PDF no hay dónde estampar, así que un trazo sobre una foto no se guarda: sería un archivo
  // que nada lee. Ese es también el único caso en que no se exige.
  if (stroke && canStamp(context.application.contract?.document ?? null)) {
    strokePath = `contracts/${applicationId}/strokes/${context.party}-${Date.now()}.png`;
    try {
      await adminStorage()
        .bucket()
        .file(strokePath)
        .save(Buffer.from(stroke.slice(stroke.indexOf(",") + 1), "base64"), {
          contentType: "image/png",
          resumable: false,
        });
    } catch (error) {
      console.error("could not save the stroke:", error instanceof Error ? error.message : error);
      strokePath = "";

      /*
       * Con el dibujo obligatorio, firmar sin trazo sería prometer un estampado que no está: se
       * devuelve el fallo y **no se escribe la firma**. El reto sigue en pie — un código correcto
       * no gasta intentos y no se ha borrado — así que reintentar funciona sin pedir otro código.
       */
      if (mustDraw) {
        return {
          ok: false,
          message: "No pudimos guardar tu firma dibujada. Inténtalo de nuevo en un momento.",
        };
      }
    }
  }

  const profile = await getProfile(context.uid);
  const requestHeaders = await headers();

  const signature: ContractSignature = {
    party: context.party,
    uid: context.uid,
    fullName: profile?.fullName ?? "",
    documentId: `${context.application.dossier.documentType} ${context.application.dossier.documentNumber}`,
    signedAt: new Date().toISOString(),
    acceptedClauseAt: String(stored?.acceptedClauseAt ?? ""),
    clauseVersion: Number(stored?.clauseVersion ?? SIGNATURE_CLAUSE_VERSION),
    documentHash: context.hash,
    channel: challenge!.channel,
    sentTo: challenge!.sentTo,
    /*
     * `x-forwarded-for` carries the client address through Vercel's proxy; the first entry is the
     * caller. Empty rather than a guess when it is absent: evidence that was invented is worse
     * than evidence that is missing.
     */
    ip: (requestHeaders.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "",
    userAgent: (requestHeaders.get("user-agent") ?? "").slice(0, 200),
    strokePath,
  };

  // Any earlier signature by this party over an older file is replaced, not stacked.
  const kept = (context.application.contract?.signatures ?? []).filter(
    (each) => each.party !== context.party,
  );

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      "contract.signatures": [...kept, signature],
      updatedAt: FieldValue.serverTimestamp(),
    });

  // The challenge is spent. Leaving it would leave a usable code behind a signature.
  await reference.delete().catch(() => undefined);

  const contract = {
    ...context.application.contract!,
    signatures: [...kept, signature],
  };
  const other: ContractParty = context.party === "landlord" ? "tenant" : "landlord";
  const otherUid =
    other === "landlord" ? context.application.landlordUid : context.application.tenantUid;
  const [otherProfile] = await Promise.all([getProfile(otherUid)]);

  const bothSigned = contractState(contract) === "signed";

  /*
   * El PDF que se descargan, generado una sola vez cuando las dos firmas están. Su hash es propio:
   * estampar cambia los bytes, así que hashear esto como "el documento firmado" invalidaría las
   * firmas que muestra. Si falla, se registra y el proceso sigue — el contrato está firmado de
   * todos modos, y este artefacto se puede volver a generar.
   */
  if (bothSigned) {
    const stamped = await stampContract({
      applicationId,
      contract,
      signatures: [...kept, signature],
    });

    if (stamped) {
      await adminDb()
        .collection("applications")
        .doc(applicationId)
        .update({
          "contract.stamped": { ...stamped, generatedAt: new Date().toISOString() },
          updatedAt: FieldValue.serverTimestamp(),
        });
    }
  }

  await notify({
    recipientUid: otherUid,
    recipientEmail: otherProfile?.email ?? null,
    type: bothSigned ? "contract_signed" : "contract_ready",
    applicationId,
    stage: "contract_signature",
    propertyTitle: context.application.propertyTitle,
    actorName: profile?.fullName ?? "",
    detail: bothSigned
      ? ""
      : `${CONTRACT_PARTY_LABELS[context.party]} ya firmó. Falta tu firma para continuar.`,
  });

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}
