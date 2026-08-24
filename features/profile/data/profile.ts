import "server-only";

import { cache } from "react";

import type { UserRole } from "@/shared/auth/session";
import type { Gender } from "../domain/profile";
import type { Department } from "@/shared/geo/colombia";
import { adminDb } from "@/shared/firebase/admin";

/** The shape the UI consumes: serializable, no `Timestamp`. */
export type Profile = {
  readonly fullName: string;
  readonly email: string;
  /** E.164, e.g. `+573001234567`. */
  readonly phone: string;
  /** ISO of the chosen country: `+1` is shared by several, it cannot be derived from the number. */
  readonly phoneCountry: string;
  /**
   * Absent when the person did not answer, which is a complete profile: gender is sensitive data
   * and art. 6 of Ley 1581 forbids obliging anybody to authorise it. It used to be part of the
   * completeness check below, which meant declining to give it locked the account out of the whole
   * product.
   */
  readonly gender: Gender | null;
  readonly address: {
    readonly line: string;
    readonly city: string;
    readonly department: Department;
  };
  /** `YYYY-MM-DD`. */
  readonly birthDate: string;
  readonly role: UserRole;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * The user's profile, or `null` if they have not completed onboarding yet.
 *
 * Cached per request: the guard and the screen that uses it need the same read. If the
 * document exists but is incomplete it returns `null`, so the guard sends the user back to
 * finish it instead of rendering a screen full of holes.
 */
export const getProfile = cache(async (uid: string): Promise<Profile | null> => {
  const snapshot = await adminDb().collection("users").doc(uid).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data() ?? {};
  const address = (data.address ?? {}) as Record<string, unknown>;

  const fullName = asString(data.fullName);
  const email = asString(data.email);
  const phone = asString(data.phone);
  const phoneCountry = asString(data.phoneCountry);
  const gender = asString(data.gender);
  const birthDate = asString(data.birthDate);
  const line = asString(address.line);
  const city = asString(address.city);
  const department = asString(address.department);
  const role = asString(data.role);

  // A half-filled profile counts as missing: better to go back to the form than to render
  // a screen with empty fields.
  if (
    !fullName ||
    !email ||
    !phone ||
    !phoneCountry ||
    !birthDate ||
    !line ||
    !city ||
    !department ||
    !role
  ) {
    return null;
  }

  return {
    fullName,
    email,
    phone,
    phoneCountry,
    gender: gender as Gender | null,
    address: {
      line,
      city,
      department: department as Department,
    },
    birthDate,
    role: role as UserRole,
  };
});

export async function hasProfile(uid: string): Promise<boolean> {
  return (await getProfile(uid)) !== null;
}
