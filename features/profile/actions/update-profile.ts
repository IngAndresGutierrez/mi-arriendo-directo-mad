"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { HOME_ROUTE, SETTINGS_ROUTE, TENANT_PROFILE_ROUTE } from "@/shared/auth/routes";
import { requireUser } from "@/shared/auth/session";
import { adminDb } from "@/shared/firebase/admin";
import { toE164 } from "@/shared/phone/countries";

import { accountDetailsSchema, validateBirthDate } from "../validations/profile";

export type UpdateProfileResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly message?: string;
      readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
    };

/**
 * Corrects the account details of whoever is asking — a new phone, a move, a misspelt name.
 *
 * It writes under the session's own uid, so there is no shape of this call that edits someone
 * else's profile. Three fields are deliberately not touched: the **email**, which comes from the
 * verified session and not from a form; the **role**, which is a custom claim and changing it
 * here would let anyone promote themselves; and `termsAcceptedAt`, which records when consent
 * was given and would be a lie if it moved every time a name is corrected.
 */
export async function updateProfile(formData: FormData): Promise<UpdateProfileResult> {
  const user = await requireUser();

  const parsed = accountDetailsSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: {
      country: formData.get("phone.country"),
      national: formData.get("phone.national"),
    },
    // Absent and empty are the same answer: the field was left blank.
    gender: formData.get("gender") || null,
    address: {
      line: formData.get("address.line"),
      city: formData.get("address.city"),
      department: formData.get("address.department"),
    },
    birthDate: formData.get("birthDate"),
    locale: formData.get("locale") || null,
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const age = validateBirthDate(parsed.data.birthDate, new Date());
  if (!age.ok) {
    return { ok: false, fieldErrors: { birthDate: [age.error] } };
  }

  const e164 = toE164(parsed.data.phone.country, parsed.data.phone.national);
  if (!e164) {
    return { ok: false, fieldErrors: { "phone.national": ["Revisa el número."] } };
  }

  await adminDb()
    .collection("users")
    .doc(user.uid)
    .update({
      fullName: parsed.data.fullName,
      phone: e164,
      phoneCountry: parsed.data.phone.country,
      /*
       * **Clearing it deletes the field, and that is the revocation.**
       *
       * Gender is sensitive data nobody is obliged to authorise (Ley 1581 art. 6), and an
       * authorisation is revocable (art. 8, lit. e). Writing `null` would leave the key sitting on
       * the document — data we were asked to stop holding, held. `FieldValue.delete()` is what
       * makes emptying the select mean what the person meant by it.
       */
      gender: parsed.data.gender ?? FieldValue.delete(),
      address: {
        line: parsed.data.address.line,
        city: parsed.data.address.city,
        department: parsed.data.address.department,
      },
      birthDate: parsed.data.birthDate,
      /*
       * **Cleared the same way `gender` is, and for a plainer reason.** An absent `locale` means
       * "not decided", which `allowsLocale` answers with Spanish — the product's own language. A
       * stored `null` would be a third state meaning the same thing as absent, and the day somebody
       * writes `locale === null ? ... : ...` the two stop agreeing.
       */
      locale: parsed.data.locale ?? FieldValue.delete(),
    });

  revalidatePath(TENANT_PROFILE_ROUTE);
  // Las dos pantallas que editan estos datos son puertas del mismo documento, así que la que
  // no se usó esta vez tiene que dejar de servir lo que había en caché.
  revalidatePath(SETTINGS_ROUTE);
  revalidatePath(HOME_ROUTE);

  return { ok: true };
}
