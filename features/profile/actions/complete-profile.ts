"use server";

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { requireUser } from "@/shared/auth/session";
import { adminAuth, adminDb } from "@/shared/firebase/admin";
import { DEFAULT_USER_ROLE } from "../domain/colombia";
import { toE164 } from "@/shared/phone/countries";
import { completeProfileSchema, validateBirthDate } from "../validations/profile";

export type CompleteProfileResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly message?: string;
      readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
    };

/**
 * Crea el perfil del usuario autenticado y fija su rol como custom claim.
 *
 * Una Server Action es un endpoint público: autentica, valida con Zod y toma el `uid` y el
 * correo **de la sesión**, nunca del formulario.
 */
export async function completeProfile(formData: FormData): Promise<CompleteProfileResult> {
  const user = await requireUser();

  const parsed = completeProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: {
      country: formData.get("phone.country"),
      national: formData.get("phone.national"),
    },
    gender: formData.get("gender"),
    address: {
      line: formData.get("address.line"),
      city: formData.get("address.city"),
      department: formData.get("address.department"),
    },
    birthDate: formData.get("birthDate"),
    acceptsTerms: formData.get("acceptsTerms") === "true",
  });

  if (!parsed.success) {
    // No devuelvas el error crudo de Zod: incluye los valores enviados.
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  // La edad se valida contra el reloj del servidor, no contra el del navegador.
  const birthDate = validateBirthDate(parsed.data.birthDate, new Date());
  if (!birthDate.ok) {
    return { ok: false, fieldErrors: { birthDate: [birthDate.error] } };
  }

  // El indicativo se resuelve en el servidor: el cliente manda el ISO, no el `+57`.
  const e164 = toE164(parsed.data.phone.country, parsed.data.phone.national);
  if (!e164) {
    return { ok: false, fieldErrors: { phone: ["Selecciona un país válido"] } };
  }

  const profileRef = adminDb.collection("users").doc(user.uid);

  const existing = await profileRef.get();
  if (existing.exists) {
    return { ok: false, message: "Tu perfil ya está creado." };
  }

  await profileRef.set({
    fullName: parsed.data.fullName,
    // El correo sale de la sesión verificada, no del formulario.
    email: user.email,
    phone: e164,
    phoneCountry: parsed.data.phone.country,
    gender: parsed.data.gender,
    address: {
      line: parsed.data.address.line,
      city: parsed.data.address.city,
      department: parsed.data.address.department,
    },
    birthDate: parsed.data.birthDate,
    // El onboarding ya no pregunta el rol: toda cuenta nace con el menos privilegiado.
    role: DEFAULT_USER_ROLE,
    // Registro del consentimiento (Ley 1581): cuándo lo otorgó.
    termsAcceptedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  // El rol vive en custom claims: las Security Rules lo leen de ahí y el cliente no lo
  // puede falsificar. El token del navegador conserva el claim viejo hasta que se refresque.
  await adminAuth.setCustomUserClaims(user.uid, { role: DEFAULT_USER_ROLE });

  return { ok: true };
}
