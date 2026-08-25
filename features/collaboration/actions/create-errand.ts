"use server";

import { revalidatePath } from "next/cache";

import { getOwnedProperty, publicLocationLabel } from "@/features/property";
import { requireUser } from "@/shared/auth/session";
import { MY_PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { adminAuth, adminDb } from "@/shared/firebase/admin";
import { toE164 } from "@/shared/phone/countries";

import { toInstant, validateSlot } from "@/features/application/client";

import { announceErrand } from "./errand";
import { getErrandFor } from "../data/errand";
import { collaboratorSchema, errandSchema } from "../validations/errand";

export type CreateErrandResult =
  | { readonly ok: true; readonly errandId: string }
  | { readonly ok: false; readonly error: string };

/**
 * Finds or creates the collaborator behind a phone number.
 *
 * **This is where the `no_account` blocker went.** Inviting used to require the collaborator to
 * already have an account, found by email — which for a sporadic figure meant signing up, verifying
 * an address and completing a profile before they could be asked to open a door once. Now the
 * landlord types a name and a number and the account is made for them: a real Firebase user with no
 * email, no password and no profile, whose only way in is the code sent to that phone.
 *
 * `collaboratorPhones/{e164}` is the reservation that makes the number unique and resolvable in one
 * `get`, exactly as `propertySlugs/{slug}` does for a listing's URL. One person is one collaborator
 * across the whole product, so the same phone working for two landlords is one account with two
 * errands — not two identities that can disagree.
 */
async function resolveCollaborator(name: string, e164: string): Promise<string> {
  const phones = adminDb().collection("collaboratorPhones").doc(e164);
  const existing = await phones.get();
  const known = existing.data()?.uid;

  if (typeof known === "string") return known;

  const created = await adminAuth().createUser({ displayName: name });
  await adminAuth().setCustomUserClaims(created.uid, { role: "collaborator" });

  const now = new Date();
  await adminDb().collection("collaborators").doc(created.uid).set({
    name,
    phone: e164,
    createdAt: now,
    updatedAt: now,
  });
  await phones.set({ uid: created.uid, createdAt: now });

  return created.uid;
}

/**
 * The landlord hands out an errand.
 *
 * Order, as everywhere: authenticate → validate → **authorize against the real data** → business
 * invariants → write → announce. The authorization is `getOwnedProperty`, so the property has to be
 * theirs: without that check a landlord could attach an errand to somebody else's listing and, in
 * doing so, hand a stranger's address to a person of their choosing.
 *
 * The collaborator's name and phone, and the property's title and area, are **copied onto the
 * errand**. That is the tenant-dossier snapshot rule again: the collaborator's own document is not
 * readable by the landlord, and a listing that is later edited or deleted must not blank an errand
 * that was already done.
 */
export async function createErrand(input: unknown): Promise<CreateErrandResult> {
  const user = await requireUser();

  const details = errandSchema.safeParse(input);
  const who = collaboratorSchema.safeParse(input);

  if (!details.success || !who.success) {
    return { ok: false, error: "Revisa los datos del encargo." };
  }

  /*
   * Same rule the interview and the visit use: a time in the past is not an appointment, and one a
   * year out is a typo in the year. Re-checked here against the **server's** clock — a browser's is
   * whatever the person set it to, which is why the schema does not try to own this.
   */
  const dueAt = toInstant(details.data.day, details.data.time);
  const slot = validateSlot(dueAt, new Date());
  if (!slot.ok) return { ok: false, error: slot.error };

  const property = await getOwnedProperty(details.data.propertyId, user.uid);
  if (!property) return { ok: false, error: "Ese inmueble no es tuyo." };

  const e164 = toE164(who.data.phoneCountry, who.data.phoneNational.replace(/\D/g, ""));
  if (!e164) return { ok: false, error: "Revisa el número del colaborador." };

  try {
    const collaboratorUid = await resolveCollaborator(who.data.name, e164);
    const now = new Date();

    const reference = await adminDb().collection("errands").add({
      landlordUid: user.uid,
      collaboratorUid,
      collaboratorName: who.data.name,
      collaboratorPhone: e164,
      propertyId: property.id,
      propertyTitle: property.title,
      propertyArea: publicLocationLabel(property.area),
      type: details.data.type,
      title: details.data.title,
      description: details.data.description,
      dueAt,
      createdAt: now,
      updatedAt: now,
    });

    /*
     * Announced after the write, never before: a message about an errand that failed to save sends
     * somebody to a property for a job that does not exist. `announceErrand` never throws — both
     * senders answer `false` rather than raising — so a Twilio outage costs the message and not the
     * errand, which the landlord can see was created.
     */
    const errand = await getErrandFor(reference.id, user.uid);
    if (errand) await announceErrand(errand);

    // The landlord lands back on their listings, which is where the errand was started from.
    revalidatePath(MY_PROPERTIES_ROUTE);

    return { ok: true, errandId: reference.id };
  } catch (error) {
    console.error("[errand] could not create:", error);

    return { ok: false, error: "No pudimos crear el encargo. Inténtalo otra vez." };
  }
}
