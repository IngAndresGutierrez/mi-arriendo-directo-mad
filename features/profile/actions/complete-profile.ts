"use server";

import { headers } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { requireUser } from "@/shared/auth/session";
import { adminAuth, adminDb } from "@/shared/firebase/admin";
import { CONSENTS_SUBCOLLECTION, type ConsentKind } from "@/shared/legal/documents";
import { DEFAULT_USER_ROLE } from "../domain/profile";
import { toE164 } from "@/shared/phone/countries";
import { completeProfileSchema, validateBirthDate } from "../validations/profile";

export type CompleteProfileResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly message?: string;
      readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
    };

/** Cap on what is stored from the header: a user agent is a string somebody else controls. */
const MAX_USER_AGENT = 400;

/**
 * Where the request came from, for the consent record.
 *
 * Both may be absent — a proxy that strips the header, a runtime that does not set it — and an
 * absent one is not an error. Decreto 1074 de 2015 (art. 2.2.2.25.2.4) asks the Responsable to be
 * able to prove the authorisation; the ip and the user agent are what make that proof more than
 * "our database says so", the same way the electronic signature already keeps them.
 *
 * `x-forwarded-for` is a list when it has passed through more than one hop, and the **first**
 * entry is the client. It is attacker-controllable, so this is evidence and never a control:
 * nothing is authorised or denied on the strength of it.
 */
async function requestOrigin(): Promise<{ ip: string | null; userAgent: string | null }> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");

  return {
    ip: forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip") || null,
    userAgent: headerList.get("user-agent")?.slice(0, MAX_USER_AGENT) || null,
  };
}

/**
 * Creates the authenticated user's profile and sets their role as a custom claim.
 *
 * A Server Action is a public endpoint: authenticate, validate with Zod, and take the `uid`
 * and the email **from the session**, never from the form.
 *
 * **The profile and the authorisation to process it are written in one batch**, and that is not
 * tidiness. Split into two writes, one of them can succeed alone — and the half that survives is
 * a document full of somebody's personal data with no record of anybody having authorised it,
 * which is the one state Ley 1581 leaves no defence for.
 */
export async function completeProfile(formData: FormData): Promise<CompleteProfileResult> {
  const user = await requireUser();

  const parsed = completeProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: {
      country: formData.get("phone.country"),
      national: formData.get("phone.national"),
    },
    // Absent and empty are the same answer here: the field was not filled in. An unanswered
    // sensitive field must not become the string "" in the database.
    gender: formData.get("gender") || null,
    address: {
      line: formData.get("address.line"),
      city: formData.get("address.city"),
      department: formData.get("address.department"),
    },
    birthDate: formData.get("birthDate"),
    acceptsTerms: formData.get("acceptsTerms") === "true",
    authorizesDataTreatment: formData.get("authorizesDataTreatment") === "true",
    termsVersion: formData.get("termsVersion"),
    privacyVersion: formData.get("privacyVersion"),
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

  const origin = await requestOrigin();
  const batch = adminDb().batch();

  batch.set(profileRef, {
    fullName: parsed.data.fullName,
    // The email comes from the verified session, not from the form.
    email: user.email,
    phone: e164,
    phoneCountry: parsed.data.phone.country,
    /*
     * Omitted rather than stored as `null` when it was not answered. Gender is sensitive data
     * nobody is obliged to authorise, and the cheapest way not to hold a piece of personal data
     * is not to hold it — the same reasoning `payoutShape` applies to the holder's document
     * number. An absent field also reads unambiguously as "not given", which `null` beside a
     * "prefer_not_to_say" option would not.
     */
    ...(parsed.data.gender ? { gender: parsed.data.gender } : {}),
    address: {
      line: parsed.data.address.line,
      city: parsed.data.address.city,
      department: parsed.data.address.department,
    },
    birthDate: parsed.data.birthDate,
    // Onboarding no longer asks for the role: every account starts with the least privileged one.
    role: DEFAULT_USER_ROLE,
    /*
     * Kept, and it now means the narrower thing its name says: when the *terms* were accepted.
     * Every account created before consents were recorded has this field and nothing else, and
     * `withLegacyConsent` reads it as an authorisation to both documents at version 1 — which is
     * what it was, since one checkbox covered both. Removing it would strand those accounts.
     */
    termsAcceptedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  // One document per authorisation, in the subcollection no client can write to.
  const consents: readonly ConsentKind[] = ["terms", "privacy"];
  const versions: Readonly<Record<ConsentKind, number>> = {
    terms: parsed.data.termsVersion,
    privacy: parsed.data.privacyVersion,
  };

  for (const kind of consents) {
    batch.set(profileRef.collection(CONSENTS_SUBCOLLECTION).doc(), {
      kind,
      version: versions[kind],
      grantedAt: FieldValue.serverTimestamp(),
      ip: origin.ip,
      userAgent: origin.userAgent,
    });
  }

  await batch.commit();

  // The role lives in custom claims: Security Rules read it from there and the client
  // cannot forge it. The browser token keeps the old claim until it is refreshed.
  await adminAuth().setCustomUserClaims(user.uid, { role: DEFAULT_USER_ROLE });

  return { ok: true };
}
