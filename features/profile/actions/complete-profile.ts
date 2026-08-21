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
 * Creates the authenticated user's profile and sets their role as a custom claim.
 *
 * A Server Action is a public endpoint: authenticate, validate with Zod, and take the `uid`
 * and the email **from the session**, never from the form.
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
    // Never return Zod's raw error: it includes the submitted values.
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  // Age is validated against the server clock, not the browser's.
  const birthDate = validateBirthDate(parsed.data.birthDate, new Date());
  if (!birthDate.ok) {
    return { ok: false, fieldErrors: { birthDate: [birthDate.error] } };
  }

  // The dial code is resolved on the server: the client sends the ISO, not the `+57`.
  const e164 = toE164(parsed.data.phone.country, parsed.data.phone.national);
  if (!e164) {
    return { ok: false, fieldErrors: { phone: ["Selecciona un país válido"] } };
  }

  const profileRef = adminDb().collection("users").doc(user.uid);

  const existing = await profileRef.get();
  if (existing.exists) {
    return { ok: false, message: "Tu perfil ya está creado." };
  }

  await profileRef.set({
    fullName: parsed.data.fullName,
    // The email comes from the verified session, not from the form.
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
    // Onboarding no longer asks for the role: every account starts with the least privileged one.
    role: DEFAULT_USER_ROLE,
    // Consent record (Law 1581): when it was granted.
    termsAcceptedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  // The role lives in custom claims: Security Rules read it from there and the client
  // cannot forge it. The browser token keeps the old claim until it is refreshed.
  await adminAuth().setCustomUserClaims(user.uid, { role: DEFAULT_USER_ROLE });

  return { ok: true };
}
